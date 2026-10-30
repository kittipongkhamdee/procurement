"use server";

// ยืมเงินระหว่างประเภทเงิน (/finance/ledger/fund-loans) — บันทึกได้เฉพาะเจ้าหน้าที่การเงิน/แอดมิน (RLS fin_can_write)
// บันทึกการยืม 1 ครั้ง = ผู้ให้ยืม 1 ประเภท → ผู้ยืมได้หลายประเภท (เช่น ค่าเครื่องแบบ + ค่าอุปกรณ์การเรียน)
// ระบบสร้างรายการรับ-จ่ายคู่กันให้เอง (fin_transactions.fund_role) — ลบการยืม/การส่งใช้ = ลบรายการที่สร้างไว้ด้วย (cascade)

import { dbFail } from "@/lib/action-log";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { proxyNames, requireProxyAdmin } from "@/lib/approval-proxy";
import { isAdminUser } from "@/lib/doc-number-server";
import { DOC_FORMAT_KEYS, docFormatsFrom, effect, fiscalYearOf, fundDoc, fundRef, POCKETS, round2, POCKET_LABEL, type FinTxn, type Pocket } from "@/lib/finance-ledger";

type Result = { error?: string; id?: string };
type Supabase = Awaited<ReturnType<typeof createClient>>;
const PATHS = ["/finance", "/finance/ledger/fund-loans"];
const NO_RIGHT = "ไม่มีสิทธิ์ — บันทึกได้เฉพาะเจ้าหน้าที่การเงินหรือผู้ดูแลระบบ";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const asPocket = (v: string): Pocket => ((POCKETS as string[]).includes(v) ? (v as Pocket) : "bank");
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function revalidate() {
  for (const p of PATHS) revalidatePath(p);
}

async function canWrite(supabase: Supabase) {
  const { data } = await supabase.rpc("fin_can_write");
  return !!data;
}

/** ยอดคงเหลือของประเภทเงินในช่องหนึ่ง ณ สิ้นวัน date (ยอดยกมาต้นปีงบ + รายการในปีงบจนถึงวันนั้น) */
async function pocketBalance(supabase: Supabase, typeId: string, pocket: Pocket, date: string) {
  const fy = fiscalYearOf(date);
  const [{ data: op }, { data: tx }] = await Promise.all([
    supabase.from("fin_opening_balances").select("cash, bank, gov").eq("fiscal_year", fy).eq("money_type_id", typeId).maybeSingle(),
    supabase.from("fin_transactions").select("kind, from_pocket, to_pocket, amount").eq("fiscal_year", fy).eq("money_type_id", typeId).lte("txn_date", date),
  ]);
  let bal = Number(op?.[pocket] ?? 0);
  for (const t of (tx ?? []) as Pick<FinTxn, "kind" | "from_pocket" | "to_pocket" | "amount">[]) bal += effect(t)[pocket];
  return round2(bal);
}

/** เลขที่ บง ถัดไปของปีงบ — การยืมและการส่งใช้ใช้ชุดเลขเดียวกัน */
async function nextSeq(supabase: Supabase, fy: number) {
  const [{ data: a }, { data: b }] = await Promise.all([
    supabase.from("fin_fund_loans").select("doc_seq").eq("fiscal_year", fy).order("doc_seq", { ascending: false }).limit(1),
    supabase.from("fin_fund_loan_repays").select("doc_seq").eq("fiscal_year", fy).order("doc_seq", { ascending: false }).limit(1),
  ]);
  return Math.max(a?.[0]?.doc_seq ?? 0, b?.[0]?.doc_seq ?? 0) + 1;
}

async function docFormats(supabase: Supabase) {
  const { data } = await supabase.from("proc_app_settings").select("key, value").in("key", DOC_FORMAT_KEYS);
  return docFormatsFrom(Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])));
}

async function typeNames(supabase: Supabase, ids: string[]) {
  const { data } = await supabase.from("fin_money_types").select("id, name").in("id", ids);
  return new Map((data ?? []).map((x) => [x.id, x.name as string]));
}

export async function saveFundLoan(fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const date = str("loan_date");
  const lender = str("lender_type_id");
  const pocket = asPocket(str("pocket"));
  let lines: { borrower_type_id: string; amount: number }[] = [];
  try {
    lines = (JSON.parse(str("lines") || "[]") as { borrower_type_id: string; amount: number }[])
      .map((l) => ({ borrower_type_id: String(l.borrower_type_id ?? ""), amount: round2(Number(l.amount) || 0) }))
      .filter((l) => l.borrower_type_id || l.amount);
  } catch {
    return { error: "ข้อมูลรายการผู้ยืมไม่ถูกต้อง" };
  }
  if (!date) return { error: "กรุณาระบุวันที่ยืม" };
  if (date > today()) return { error: "วันที่ยืมลงล่วงหน้าไม่ได้" };
  if (!lender) return { error: "กรุณาเลือกประเภทเงินที่ให้ยืม" };
  if (lines.length === 0) return { error: "กรุณาเพิ่มประเภทเงินที่ยืมอย่างน้อย 1 รายการ" };
  if (lines.some((l) => !l.borrower_type_id)) return { error: "กรุณาเลือกประเภทเงินที่ยืมให้ครบ" };
  if (lines.some((l) => !(l.amount > 0))) return { error: "จำนวนเงินต้องมากกว่า 0" };
  if (lines.some((l) => l.borrower_type_id === lender)) return { error: "ประเภทเงินที่ยืมต้องไม่ใช่ประเภทเดียวกับผู้ให้ยืม" };
  if (new Set(lines.map((l) => l.borrower_type_id)).size !== lines.length) return { error: "เลือกประเภทเงินที่ยืมซ้ำกัน — รวมเป็นรายการเดียว" };
  const sum = round2(lines.reduce((s, l) => s + l.amount, 0));
  const bal = await pocketBalance(supabase, lender, pocket, date);
  if (sum > bal) return { error: `ประเภทเงินที่ให้ยืมมี${POCKET_LABEL[pocket]}คงเหลือ ณ วันที่ยืม ${baht(bal)} บาท ไม่พอให้ยืม ${baht(sum)} บาท` };

  const fy = fiscalYearOf(date);
  const seq = await nextSeq(supabase, fy);
  const { data: loan, error } = await supabase
    .from("fin_fund_loans")
    .insert({
      fiscal_year: fy,
      doc_seq: seq,
      loan_date: date,
      lender_type_id: lender,
      pocket,
      semester: str("semester") || null,
      academic_year: str("academic_year") || null,
      memo_no: str("memo_no") || null,
      memo_date: str("memo_date") || null,
      reason: str("reason") || null,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return { error: "เลขที่ บง ชนกับรายการที่บันทึกพร้อมกัน — กรุณากดบันทึกอีกครั้ง" };
  if (error) return dbFail("saveFundLoan", error.message.includes("row-level") ? NO_RIGHT : error.message);
  const { data: saved, error: e2 } = await supabase
    .from("fin_fund_loan_lines")
    .insert(lines.map((l, i) => ({ loan_id: loan.id, borrower_type_id: l.borrower_type_id, amount: l.amount, sort_order: i })))
    .select("id, borrower_type_id, amount");
  const names = await typeNames(supabase, [lender, ...lines.map((l) => l.borrower_type_id)]);
  const doc = fundDoc(seq, fy, await docFormats(supabase)) || null;
  const base = { fiscal_year: fy, txn_date: date, doc_no: doc };
  const rows = (saved ?? []).flatMap((l) => [
    { ...base, kind: "pay", from_pocket: pocket, description: `ให้ยืมเงินแก่รายการ${names.get(l.borrower_type_id) ?? ""}`, amount: l.amount, money_type_id: lender, fund_role: "loan_out", fund_line_id: l.id },
    { ...base, kind: "receive", to_pocket: pocket, description: `รับเงินยืมจาก${names.get(lender) ?? ""}`, amount: l.amount, money_type_id: l.borrower_type_id, fund_role: "loan_in", fund_line_id: l.id },
  ]);
  const e3 = e2 ?? (await supabase.from("fin_transactions").insert(rows)).error;
  if (e3) {
    await supabase.from("fin_fund_loans").delete().eq("id", loan.id);
    return { error: e3.message };
  }
  revalidate();
  return { id: loan.id };
}

/** แก้เฉพาะข้อมูลบันทึกข้อความ (ภาคเรียน ปีการศึกษา เลขที่/วันที่บันทึก เหตุผล) — จำนวนเงิน/ประเภทเงินแก้ไม่ได้ ให้ลบแล้วบันทึกใหม่ */
export async function updateFundLoanMemo(id: string, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const { data, error } = await supabase
    .from("fin_fund_loans")
    .update({ semester: str("semester") || null, academic_year: str("academic_year") || null, memo_no: str("memo_no") || null, memo_date: str("memo_date") || null, reason: str("reason") || null })
    .eq("id", id)
    .select("id");
  if (error) return dbFail("updateFundLoanMemo", error.message);
  if (!data?.length) return { error: NO_RIGHT };
  revalidate();
  return { id };
}

export async function deleteFundLoan(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const { data: lines } = await supabase.from("fin_fund_loan_lines").select("id, fin_fund_loan_repays(id)").eq("loan_id", id);
  if ((lines ?? []).some((l) => ((l.fin_fund_loan_repays as unknown as unknown[]) ?? []).length > 0)) return { error: "มีการส่งใช้คืนแล้ว — ลบการส่งใช้คืนทั้งหมดก่อน จึงลบการยืมได้" };
  const { data: cur } = await supabase.from("fin_fund_loans").select("director_approved_at").eq("id", id).maybeSingle();
  if (cur?.director_approved_at && !(await isAdminUser(supabase))) return { error: "ผู้อำนวยการอนุมัติแล้ว — ให้ผู้อำนวยการยกเลิกอนุมัติก่อน จึงลบได้" };
  const { data, error } = await supabase.from("fin_fund_loans").delete().eq("id", id).select("id");
  if (error) return dbFail("deleteFundLoan", error.message);
  if (!data?.length) return { error: NO_RIGHT };
  revalidate();
  return {};
}

export async function saveFundRepay(lineId: string, fd: FormData): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const date = str("repay_date");
  const amount = round2(Number(str("amount")) || 0);
  const pocket = asPocket(str("pocket"));
  const { data: line } = await supabase
    .from("fin_fund_loan_lines")
    .select("id, amount, borrower_type_id, fin_fund_loans(loan_date, lender_type_id, doc_seq, fiscal_year, director_approved_at), fin_fund_loan_repays(amount)")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { error: "ไม่พบรายการยืม" };
  const loan = line.fin_fund_loans as unknown as { loan_date: string; lender_type_id: string; doc_seq: number; fiscal_year: number; director_approved_at: string | null };
  if (!loan.director_approved_at) return { error: "ผู้อำนวยการยังไม่อนุมัติการยืมนี้ — ส่งใช้คืนได้หลังอนุมัติแล้ว" };
  const repaid = ((line.fin_fund_loan_repays as unknown as { amount: number }[]) ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const outstanding = round2(Number(line.amount) - repaid);
  if (!date) return { error: "กรุณาระบุวันที่ส่งใช้คืน" };
  if (date < loan.loan_date) return { error: "วันที่ส่งใช้คืนต้องไม่ก่อนวันที่ยืม" };
  if (date > today()) return { error: "วันที่ส่งใช้คืนลงล่วงหน้าไม่ได้" };
  if (!(amount > 0)) return { error: "จำนวนเงินต้องมากกว่า 0" };
  if (amount > outstanding) return { error: `ส่งใช้คืนได้ไม่เกินยอดค้าง ${baht(outstanding)} บาท` };
  const bal = await pocketBalance(supabase, line.borrower_type_id, pocket, date);
  if (amount > bal) return { error: `ประเภทเงินที่ยืมมี${POCKET_LABEL[pocket]}คงเหลือ ณ วันที่ส่งใช้ ${baht(bal)} บาท ไม่พอส่งใช้คืน ${baht(amount)} บาท` };

  const fy = fiscalYearOf(date);
  const seq = await nextSeq(supabase, fy);
  const { data: rep, error } = await supabase
    .from("fin_fund_loan_repays")
    .insert({ line_id: lineId, fiscal_year: fy, doc_seq: seq, repay_date: date, amount, pocket, note: str("note") || null })
    .select("id")
    .single();
  if (error?.code === "23505") return { error: "เลขที่ บง ชนกับรายการที่บันทึกพร้อมกัน — กรุณากดบันทึกอีกครั้ง" };
  if (error) return dbFail("saveFundRepay", error.message.includes("row-level") ? NO_RIGHT : error.message);
  const names = await typeNames(supabase, [loan.lender_type_id, line.borrower_type_id]);
  const ref = fundRef(loan.doc_seq, loan.fiscal_year, await docFormats(supabase));
  const base = { fiscal_year: fy, txn_date: date, doc_no: fundDoc(seq, fy, await docFormats(supabase)) || null, amount, fund_line_id: lineId, fund_repay_id: rep.id };
  const { error: e2 } = await supabase.from("fin_transactions").insert([
    { ...base, kind: "pay", from_pocket: pocket, description: `ส่งใช้เงินยืมคืน${names.get(loan.lender_type_id) ?? ""} (ตาม ${ref})`, money_type_id: line.borrower_type_id, fund_role: "repay_out" },
    { ...base, kind: "receive", to_pocket: pocket, description: `รับคืนเงินยืมจากรายการ${names.get(line.borrower_type_id) ?? ""} (ตาม ${ref})`, money_type_id: loan.lender_type_id, fund_role: "repay_in" },
  ]);
  if (e2) {
    await supabase.from("fin_fund_loan_repays").delete().eq("id", rep.id);
    return { error: e2.message };
  }
  revalidate();
  return { id: rep.id };
}

export async function deleteFundRepay(id: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await canWrite(supabase))) return { error: NO_RIGHT };
  const { data, error } = await supabase.from("fin_fund_loan_repays").delete().eq("id", id).select("id");
  if (error) return dbFail("deleteFundRepay", error.message);
  if (!data?.length) return { error: NO_RIGHT };
  revalidate();
  return {};
}

/** แอดมินกดอนุมัติ "แทน" ผู้อำนวยการ — ใช้ฟังก์ชันฐานข้อมูลเดิมแล้วแก้ชื่อผู้อนุมัติเป็นชื่อ ผอ. ตามหน้าตั้งค่า + (แอดมิน … บันทึกแทน: เหตุผล) (lib/approval-proxy.ts) */
export async function adminApproveFundLoanOnBehalf(id: string, reason?: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const { adminName } = await requireProxyAdmin(supabase);
    const { data, error } = await supabase.rpc("proc_approve_fund_loan", { p_id: id, p_approve: true });
    if (error) return dbFail("adminApproveFundLoanOnBehalf", error.message);
    if (data) return { error: data };
    const { byName } = await proxyNames(supabase, "director", adminName, reason);
    const { error: e2 } = await supabase.from("fin_fund_loans").update({ director_approved_by_name: byName }).eq("id", id);
    if (e2) return dbFail("adminApproveFundLoanOnBehalf", e2.message);
    revalidate();
    return { id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "บันทึกแทนไม่สำเร็จ" };
  }
}

/** ผู้อำนวยการอนุมัติ / ยกเลิกอนุมัติ (ก่อนมีการส่งใช้คืน) — ผ่านฟังก์ชันฐานข้อมูล (ผอ. ไม่มีสิทธิ์แก้ตารางการเงินตรง) */
export async function approveFundLoan(id: string, approve: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("proc_approve_fund_loan", { p_id: id, p_approve: approve });
  if (error) return dbFail("approveFundLoan", error.message);
  if (data) return { error: data };
  revalidate();
  return { id };
}
