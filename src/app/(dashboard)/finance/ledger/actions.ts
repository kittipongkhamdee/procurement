"use server";

// บัญชีรับ-จ่ายเงิน (/finance/ledger) — บันทึกได้เฉพาะเจ้าหน้าที่การเงิน/แอดมิน (RLS fin_can_write) ทุกคนดูได้
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fiscalYearOf, FIN_SIGNER_KEYS, POCKETS, SOURCE_DATE_FIELDS, SOURCE_LABEL, sourceDoneDate, type DocKind, type Pocket, type SourceKind, type TxnKind } from "@/lib/finance-ledger";

type Result = { error?: string; id?: string; docSeq?: number | null };
const PATH = "/finance/ledger";
const NO_RIGHT = "ไม่มีสิทธิ์ — บันทึกได้เฉพาะเจ้าหน้าที่การเงินหรือผู้ดูแลระบบ";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function canWrite(supabase: Supabase) {
  const { data } = await supabase.rpc("fin_can_write");
  return !!data;
}
function rls(msg: string) {
  return msg.includes("row-level") ? NO_RIGHT : msg;
}
const asPocket = (v: string): Pocket | null => ((POCKETS as string[]).includes(v) ? (v as Pocket) : null);

/** เลขถัดไปของ บค/บจ ในปีงบ */
async function nextSeq(supabase: Supabase, fy: number, kind: DocKind) {
  const { data } = await supabase.from("fin_transactions").select("doc_seq").eq("fiscal_year", fy).eq("doc_kind", kind).order("doc_seq", { ascending: false }).limit(1);
  return (data?.[0]?.doc_seq ?? 0) + 1;
}

export async function suggestDocSeq(date: string, kind: DocKind): Promise<{ seq: number | null; fy: number | null }> {
  if (!date || (kind !== "บค" && kind !== "บจ")) return { seq: null, fy: null };
  const fy = fiscalYearOf(date);
  return { seq: await nextSeq(await createClient(), fy, kind), fy };
}

export async function saveTxn(id: string | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const date = str("txn_date");
  const kind = str("kind") as TxnKind;
  const description = str("description");
  const amount = Math.round((Number(str("amount")) || 0) * 100) / 100;
  const typeId = str("money_type_id");
  if (!date) return { error: "กรุณาระบุวันที่" };
  if (!["receive", "pay", "transfer"].includes(kind)) return { error: "กรุณาเลือกประเภทรายการ" };
  if (!description) return { error: "กรุณาระบุรายการ" };
  if (!(amount > 0)) return { error: "จำนวนเงินต้องมากกว่า 0" };
  if (!typeId) return { error: "กรุณาเลือกประเภทเงิน" };
  const from = kind === "receive" ? null : asPocket(str("from_pocket"));
  const to = kind === "pay" ? null : asPocket(str("to_pocket"));
  if (kind !== "receive" && !from) return { error: "กรุณาเลือกช่องที่จ่าย/โอนออก" };
  if (kind !== "pay" && !to) return { error: "กรุณาเลือกช่องที่รับ/โอนเข้า" };
  if (kind === "transfer" && from === to) return { error: "ช่องต้นทางและปลายทางต้องต่างกัน" };

  const fy = fiscalYearOf(date);
  const docKindRaw = str("doc_kind");
  const docKind = (["บร", "บค", "บจ"].includes(docKindRaw) ? docKindRaw : null) as DocKind | null;
  let docSeq: number | null = null;
  let docNo: string | null = null;
  if (docKind === "บค" || docKind === "บจ") {
    docSeq = Number(str("doc_seq")) || (await nextSeq(supabase, fy, docKind));
    if (!(docSeq > 0)) return { error: "เลขที่เอกสารไม่ถูกต้อง" };
    let q = supabase.from("fin_transactions").select("id").eq("fiscal_year", fy).eq("doc_kind", docKind).eq("doc_seq", docSeq).limit(1);
    if (id) q = q.neq("id", id);
    const { data: dup } = await q;
    if (dup?.length) return { error: `เลขที่ ${docKind} ${docSeq}/${fy} ถูกใช้แล้ว` };
  } else if (docKind === "บร") {
    docNo = str("doc_no") || null;
  } else {
    docNo = str("doc_no") || null;
  }
  const projectId = str("project_id") || null;
  const fields = {
    fiscal_year: fy,
    txn_date: date,
    kind,
    from_pocket: from,
    to_pocket: to,
    doc_kind: docKind,
    doc_seq: docSeq,
    doc_no: docNo,
    description,
    payee: str("payee") || null,
    amount,
    money_type_id: typeId,
    project_id: projectId,
    activity_id: projectId ? str("activity_id") || null : null,
    note: str("note") || null,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await supabase.from("fin_transactions").update(fields).eq("id", id).select("id");
    if (error) return { error: rls(error.message) };
    if (!data?.length) return { error: NO_RIGHT };
    revalidatePath(PATH);
    return { id, docSeq };
  }
  // ผูกงานต้นทาง (ระยะที่ 2) — เฉพาะตอนสร้างรายการใหม่จาก "รอบันทึกจากงานอื่น"
  const sourceKind = str("source_kind") as SourceKind;
  const source = sourceKind in SOURCE_LABEL && str("source_id") ? { source_kind: sourceKind, source_id: str("source_id") } : {};
  if ("source_id" in source) {
    // วันที่จ่าย/รับจริงต้องอยู่หลังงานต้นทางเสร็จสิ้น และไม่ลงล่วงหน้า
    const { table, fields } = SOURCE_DATE_FIELDS[sourceKind];
    const { data: row } = await supabase.from(table).select(fields.join(", ")).eq("id", str("source_id")).maybeSingle();
    if (!row) return { error: "ไม่พบงานต้นทาง" };
    const done = sourceDoneDate(sourceKind, row as unknown as Record<string, unknown>);
    if (done && date < done) return { error: `วันที่ต้องไม่ก่อนวันที่${SOURCE_LABEL[sourceKind]}เสร็จสิ้น (${done.split("-").reverse().join("/")})` };
    if (date > new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })) return { error: "วันที่จ่าย/รับจริงลงล่วงหน้าไม่ได้" };
  }
  const { data, error } = await supabase.from("fin_transactions").insert({ ...fields, ...source }).select("id").single();
  if (error)
    return {
      error: error.message.includes("fin_transactions_doc_seq")
        ? "เลขที่เอกสารซ้ำ ลองบันทึกอีกครั้ง"
        : error.message.includes("fin_transactions_source")
          ? "รายการต้นทางนี้บันทึกในบัญชีรับ-จ่ายแล้ว"
          : rls(error.message),
    };
  revalidatePath(PATH);
  return { id: data.id, docSeq };
}

export async function deleteTxn(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fin_transactions").delete().eq("id", id).select("id");
  if (error) return { error: rls(error.message) };
  if (!data?.length) return { error: NO_RIGHT };
  revalidatePath(PATH);
  return {};
}

// ---------- ตั้งค่า ----------

export async function saveMoneyType(id: string | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const name = str("name");
  if (!name) return { error: "กรุณาระบุชื่อประเภทเงิน" };
  const fields = {
    name,
    category: str("category") || null,
    account_id: str("account_id") || null,
    sort_order: Number(str("sort_order")) || 0,
    is_active: str("is_active") !== "false",
  };
  const { error } = id ? await supabase.from("fin_money_types").update(fields).eq("id", id) : await supabase.from("fin_money_types").insert(fields);
  if (error) return { error: error.message.includes("duplicate") ? `มีประเภทเงิน "${name}" แล้ว` : rls(error.message) };
  revalidatePath(PATH);
  return {};
}

/** ลบประเภทเงินได้เมื่อยังไม่มีรายการ — มีรายการแล้วให้ปิดใช้งานแทน (ทะเบียนเก่ายังต้องอ้างถึง) */
export async function deleteMoneyType(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const { count } = await supabase.from("fin_transactions").select("id", { count: "exact", head: true }).eq("money_type_id", id);
  if (count) return { error: `มีรายการรับ-จ่ายของประเภทนี้แล้ว ${count} รายการ — ลบไม่ได้ ให้ปิดใช้งานแทน` };
  const { error } = await supabase.from("fin_money_types").delete().eq("id", id);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function saveAccount(id: string | null, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const name = str("name");
  if (!name) return { error: "กรุณาระบุชื่อบัญชี" };
  const fields = { name, bank_name: str("bank_name") || null, account_no: str("account_no") || null, sort_order: Number(str("sort_order")) || 0, is_active: str("is_active") !== "false" };
  const { error } = id ? await supabase.from("fin_accounts").update(fields).eq("id", id) : await supabase.from("fin_accounts").insert(fields);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function deleteAccount(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const { error } = await supabase.from("fin_accounts").delete().eq("id", id);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

/** ยอดยกมาต้นปีงบ — rows: [{ money_type_id, cash, bank, gov }] */
export async function saveOpenings(fy: number, rows: { money_type_id: string; cash: number; bank: number; gov: number }[]): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  if (!(fy > 2500)) return { error: "ปีงบประมาณไม่ถูกต้อง" };
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  const payload = rows.map((r) => ({ fiscal_year: fy, money_type_id: r.money_type_id, cash: r2(r.cash), bank: r2(r.bank), gov: r2(r.gov), updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("fin_opening_balances").upsert(payload);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function saveSigners(fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const now = new Date().toISOString();
  const payload = FIN_SIGNER_KEYS.flatMap(({ key }) => [
    { key: `${key}_name`, value: String(fd.get(`${key}_name`) ?? "").trim() || null, updated_at: now },
    { key: `${key}_position`, value: String(fd.get(`${key}_position`) ?? "").trim() || null, updated_at: now },
  ]);
  const { error } = await supabase.from("fin_settings").upsert(payload);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

/** ซ่อนรายการต้นทางจาก "รอบันทึกจากงานอื่น" (เช่น จ่ายด้วยวิธีอื่น/บันทึกรวมกับรายการอื่นแล้ว) */
export async function skipSource(kind: SourceKind, id: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  if (!(kind in SOURCE_LABEL)) return { error: "ประเภทต้นทางไม่ถูกต้อง" };
  const { error } = await supabase.from("fin_source_skips").upsert({ source_kind: kind, source_id: id, reason: reason.trim() || null });
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function unskipSource(kind: SourceKind, id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const { error } = await supabase.from("fin_source_skips").delete().eq("source_kind", kind).eq("source_id", id);
  if (error) return { error: rls(error.message) };
  revalidatePath(PATH);
  return {};
}
