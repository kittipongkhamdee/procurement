"use server";

// เบิกค่าใช้จ่ายโครงการ (ตาราง 2 ว 119) (/supplies/expense-claims) — proc_expense_claims + items + photos
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";
import { CLAIM_KINDS, claimAmount, type ClaimKind } from "@/lib/expense-claims";

type Result = { error?: string; id?: string };
export type ClaimItemInput = {
  kind: string;
  rate_id: string;
  name: string;
  rate: string;
  units: string;
  people: string;
  days: string;
  amount: string;
  payee: string;
  evidence: string;
  receipt_book: string;
  receipt_no: string;
  receipt_date: string;
};

const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const recordDate = str("record_date");
  const eventDate = str("event_date");
  const eventEnd = str("event_end_date") || null;
  if (!str("doc_no")) return { error: "กรุณากรอกเลขที่" };
  if (!str("event_name")) return { error: "กรุณากรอกชื่องาน/โครงการที่ดำเนินการ" };
  if (!eventDate) return { error: "กรุณาเลือกวันที่ดำเนินการ" };
  if (!recordDate) return { error: "กรุณาเลือกวันที่บันทึก" };
  if (eventEnd && eventEnd < eventDate) return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มดำเนินการ" };
  if (recordDate < (eventEnd ?? eventDate)) return { error: "วันที่บันทึกขอเบิกต้องไม่ก่อนวันที่ดำเนินการเสร็จ" };
  const refDate = str("approval_ref_date") || null;
  if (refDate && refDate > eventDate) return { error: "วันที่บันทึกอนุมัติโครงการต้องไม่หลังวันที่ดำเนินการ" };

  let items: ClaimItemInput[] = [];
  try {
    items = (JSON.parse(str("items_json") || "[]") as ClaimItemInput[]).filter((i) => i.name?.trim());
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (items.length === 0) return { error: "กรุณากรอกรายการอย่างน้อย 1 รายการ" };
  const rows = items.map((i, idx) => {
    // เก็บเฉพาะช่องที่ประเภทนั้นใช้ (ค่าค้างจากประเภทเดิมทิ้งไป)
    const k = CLAIM_KINDS[i.kind as ClaimKind] ?? CLAIM_KINDS.other;
    const calc = {
      kind: i.kind,
      rate: numOrNull(i.rate),
      units: k.units ? numOrNull(i.units) : null,
      people: k.people ? numOrNull(i.people) : null,
      days: k.days ? numOrNull(i.days) : null,
    };
    const amount = claimAmount(calc) ?? Number(i.amount);
    return {
      seq: idx + 1,
      name: i.name.trim(),
      ...calc,
      kind: i.kind || "other",
      rate_id: i.rate_id || null,
      amount,
      payee: i.payee.trim() || null,
      evidence: i.evidence.trim() || null,
      receipt_book: i.receipt_book.trim() || null,
      receipt_no: i.receipt_no.trim() || null,
      receipt_date: i.receipt_date || null,
    };
  });
  if (rows.some((r) => !(r.amount > 0))) return { error: "จำนวนเงินแต่ละรายการต้องมากกว่า 0 (กรอกอัตราหรือจำนวนเงิน)" };
  const amount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return {
    fields: {
      doc_no: str("doc_no"),
      record_date: recordDate,
      event_name: str("event_name"),
      event_date: eventDate,
      event_end_date: eventEnd,
      venue: str("venue") || null,
      admin_group: str("admin_group") || null,
      project_id: str("project_id") || null,
      activity_id: str("activity_id") || null,
      approval_ref: str("approval_ref") || null,
      approval_ref_date: refDate,
      responsible_name: str("responsible_name") || null,
      responsible_position: str("responsible_position") || null,
      fund_source: str("fund_source") || null,
      payment_method: str("payment_method") === "transfer" ? "transfer" : "cash",
      amount,
    },
    rows,
  };
}

/** ล็อกอัตราตามระเบียบ — ประเภทที่มีอัตรากำหนดไว้ต้องเลือกอัตรา และอัตราที่กรอกต้องไม่เกินอัตราสูงสุด */
async function checkRates(supabase: Awaited<ReturnType<typeof createClient>>, rows: NonNullable<ReturnType<typeof parse>["rows"]>) {
  const { data: rates } = await supabase.from("proc_expense_rates").select("id, kind, name, max_rate").eq("is_active", true);
  const list = rates ?? [];
  for (const r of rows) {
    const forKind = list.filter((x) => x.kind === r.kind);
    if (forKind.length === 0) continue;
    const rate = list.find((x) => x.id === r.rate_id);
    if (!rate || rate.kind !== r.kind) return `"${r.name}" ต้องเลือกอัตราตามระเบียบ`;
    if (r.rate == null) return `"${r.name}" ต้องกรอกอัตรา (ไม่เกิน ${Number(rate.max_rate).toLocaleString("th-TH")} บาท)`;
    if (r.rate > Number(rate.max_rate) + 0.005) return `"${r.name}" อัตรา ${r.rate.toLocaleString("th-TH")} บาท เกินอัตราตามระเบียบ (${rate.name} ไม่เกิน ${Number(rate.max_rate).toLocaleString("th-TH")} บาท)`;
  }
  return null;
}

async function replaceItems(supabase: Awaited<ReturnType<typeof createClient>>, claimId: string, rows: NonNullable<ReturnType<typeof parse>["rows"]>) {
  const { error: delError } = await supabase.from("proc_expense_claim_items").delete().eq("claim_id", claimId);
  if (delError) return delError.message;
  const { error } = await supabase.from("proc_expense_claim_items").insert(rows.map((r) => ({ ...r, claim_id: claimId })));
  return error?.message ?? null;
}

function done(id?: string): Result {
  revalidatePath("/supplies/expense-claims");
  return id ? { id } : {};
}

export async function createExpenseClaim(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const rateError = await checkRates(supabase, parsed.rows);
  if (rateError) return { error: rateError };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("proc_expense_claims")
    .insert({ ...parsed.fields, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const itemError = await replaceItems(supabase, data.id, parsed.rows);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return done(data.id);
}

export async function updateExpenseClaim(id: string, formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const rateError = await checkRates(supabase, parsed.rows);
  if (rateError) return { error: rateError };
  const { data, error } = await supabase.from("proc_expense_claims").update(parsed.fields).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  const itemError = await replaceItems(supabase, id, parsed.rows);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return done();
}

export async function deleteExpenseClaim(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: photos } = await supabase.from("proc_expense_claim_photos").select("file_ref").eq("claim_id", id);
  const { data, error } = await supabase.from("proc_expense_claims").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  await Promise.all((photos ?? []).map((p) => deleteFromStorage(supabase, p.file_ref, "procurement-files").catch(() => {})));
  return done();
}

export async function addExpenseClaimPhotos(claimId: string, photos: { category: string; ref: string }[]): Promise<Result> {
  const valid = photos.filter((p) => p.category.trim() && (/^gdrive:[\w-]+$/.test(p.ref) || /^procurement-photos\/[\w.-]+$/.test(p.ref)));
  if (valid.length === 0) return { error: "ไม่มีรูปที่บันทึกได้" };
  const supabase = await createClient();
  const { error } = await supabase.from("proc_expense_claim_photos").insert(valid.map((p) => ({ claim_id: claimId, category: p.category.trim(), file_ref: p.ref })));
  if (error) {
    await Promise.all(valid.map((p) => deleteFromStorage(supabase, p.ref, "procurement-files").catch(() => {})));
    return { error: error.message };
  }
  return done();
}

export async function deleteExpenseClaimPhoto(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_expense_claim_photos").delete().eq("id", id).select("file_ref");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  await deleteFromStorage(supabase, data[0].file_ref, "procurement-files").catch(() => {});
  return done();
}
