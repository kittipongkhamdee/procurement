"use server";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) (/supplies/urgent) — ตาราง proc_urgent_reports
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkApprovalBudget } from "@/lib/approval-budget";
import { parseItemClass } from "@/lib/item-class";
import { docNumberTaken, insertWithDocNumber, isAdminUser } from "@/lib/doc-number-server";

type Result = { error?: string; id?: string; docNo?: string | null };
export type UrgentItemInput = { kind: string; name: string; amount: string; qty?: string; unit?: string; itemClass?: string };
const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const recordDate = str("record_date");
  const purchaseDate = str("purchase_date");
  let items: UrgentItemInput[] = [];
  try {
    items = (JSON.parse(str("items_json") || "[]") as UrgentItemInput[]).filter((i) => i.name?.trim());
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (!str("subject")) return { error: "กรุณากรอกเรื่อง (รายการที่ซื้อ/จ้าง)" };
  if (items.length === 0) return { error: "กรุณากรอกรายการที่ดำเนินการอย่างน้อย 1 รายการ" };
  const rows = items.map((i, idx) => ({
    seq: idx + 1,
    kind: i.kind === "จ้าง" ? "จ้าง" : "ซื้อ",
    name: i.name.trim(),
    amount: Math.round(Number(i.amount) * 100) / 100,
    qty: i.qty ? Number(i.qty) : null,
    unit: i.unit?.trim() || null,
    item_class: parseItemClass(i.itemClass),
  }));
  if (rows.some((r) => !(r.amount > 0))) return { error: "จำนวนเงินแต่ละรายการต้องมากกว่า 0" };
  if (!purchaseDate) return { error: "กรุณาเลือกวันที่ดำเนินการ" };
  if (!recordDate) return { error: "กรุณาเลือกวันที่รายงาน" };
  if (recordDate < purchaseDate) return { error: "วันที่รายงานต้องไม่ก่อนวันที่ดำเนินการ" };
  if (str("receipt_date") && str("receipt_date") > recordDate) return { error: "วันที่ใบเสร็จต้องไม่หลังวันที่รายงาน" };
  const amount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  // ภาพรวมที่ดำเนินการ — ไม่กรอก = รวมชื่อรายการ (เช่น "ซื้อวัสดุ และจ้างจัดทำป้ายไวนิล")
  const workText = str("work_text") || rows.map((r) => `${r.kind === "จ้าง" ? "จ้าง" : "จัดซื้อ"}${r.name}`).join(" และ");
  return {
    rows,
    docNoInput: str("doc_no"),
    fields: {
      // ประเภทสรุปของรายงาน (จ้างล้วน = จ้าง, มีซื้อ = ซื้อ) — PDF ใช้ประเภทของแต่ละรายการ
      doc_type: rows.every((r) => r.kind === "จ้าง") ? "จ้าง" : "ซื้อ",
      approval_id: str("approval_id") || null,
      record_date: recordDate,
      purchase_date: purchaseDate,
      subject: str("subject"),
      reason: str("reason") || null,
      work_text: workText,
      amount,
      payee: str("payee") || null,
      receipt_type: str("receipt_type") || null,
      receipt_book: str("receipt_book") || null,
      receipt_no: str("receipt_no") || null,
      receipt_date: str("receipt_date") || null,
      responsible_name: str("responsible_name") || null,
      responsible_position: str("responsible_position") || null,
      admin_group: str("admin_group") || null,
      register_note: str("register_note") || null,
      project_id: str("project_id") || null,
      activity_id: str("activity_id") || null,
    },
  };
}

async function replaceItems(supabase: Awaited<ReturnType<typeof createClient>>, reportId: string, rows: NonNullable<ReturnType<typeof parse>["rows"]>) {
  const { error: delError } = await supabase.from("proc_urgent_items").delete().eq("report_id", reportId);
  if (delError) return delError.message;
  const { error } = await supabase.from("proc_urgent_items").insert(rows.map((r) => ({ ...r, report_id: reportId })));
  return error?.message ?? null;
}

function done(id?: string): Result {
  revalidatePath("/supplies/urgent");
  return id ? { id } : {};
}

export async function createUrgent(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  if (!parsed.fields.approval_id) return { error: "กรุณาเลือกบันทึกขออนุมัติที่อ้างอิง" };
  const budgetError = await checkApprovalBudget(supabase, parsed.fields.approval_id, parsed.fields.amount, parsed.fields.record_date);
  if (budgetError) return { error: budgetError };
  // เลขที่ออกอัตโนมัติตามรูปแบบที่ตั้งไว้ — แอดมินกำหนดเลขเองได้
  const admin = await isAdminUser(supabase);
  if (admin && parsed.docNoInput && (await docNumberTaken(supabase, "urgent", parsed.docNoInput))) return { error: `เลขที่ ${parsed.docNoInput} ถูกใช้แล้ว` };
  const manual = admin && parsed.docNoInput ? parsed.docNoInput : null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error, docNo } = await insertWithDocNumber<{ id: string }>(supabase, "urgent", parsed.fields.record_date, manual, (no) =>
    supabase
      .from("proc_urgent_reports")
      .insert({ ...parsed.fields, doc_no: no, created_by: user?.id ?? null })
      .select("id")
      .single(),
  );
  if (error || !data) return { error: error?.message ?? "บันทึกไม่สำเร็จ" };
  const itemError = await replaceItems(supabase, data.id, parsed.rows);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return { ...done(data.id), docNo };
}

export async function updateUrgent(id: string, formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  if (!parsed.fields.approval_id) return { error: "กรุณาเลือกบันทึกขออนุมัติที่อ้างอิง" };
  const budgetError = await checkApprovalBudget(supabase, parsed.fields.approval_id, parsed.fields.amount, parsed.fields.record_date, { kind: "urgent", id });
  if (budgetError) return { error: budgetError };
  // เลขที่แก้ได้เฉพาะแอดมิน — ผู้ใช้อื่นส่งมาก็ไม่เปลี่ยน
  const admin = await isAdminUser(supabase);
  if (admin && parsed.docNoInput && (await docNumberTaken(supabase, "urgent", parsed.docNoInput, id))) return { error: `เลขที่ ${parsed.docNoInput} ถูกใช้แล้ว` };
  const docNoPatch = admin ? { doc_no: parsed.docNoInput || null } : {};
  const { data, error } = await supabase.from("proc_urgent_reports").update({ ...parsed.fields, ...docNoPatch }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  const itemError = await replaceItems(supabase, id, parsed.rows);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return done();
}

export async function deleteUrgent(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_urgent_reports").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}
