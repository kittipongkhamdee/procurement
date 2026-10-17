"use server";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) (/supplies/urgent) — ตาราง proc_urgent_reports
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkApprovalBudget } from "@/lib/approval-budget";
import { assignDocNumber, docNumberTaken, isAdminUser } from "@/lib/doc-number-server";

type Result = { error?: string; id?: string; docNo?: string | null };
const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const recordDate = str("record_date");
  const purchaseDate = str("purchase_date");
  const receiptDate = str("receipt_date") || null;
  const amount = Number(str("amount"));
  if (!str("subject")) return { error: "กรุณากรอกเรื่อง (รายการที่ซื้อ/จ้าง)" };
  if (!str("work_text")) return { error: "กรุณากรอกรายการที่ได้ดำเนินการ" };
  if (!purchaseDate) return { error: "กรุณาเลือกวันที่ดำเนินการ" };
  if (!recordDate) return { error: "กรุณาเลือกวันที่รายงาน" };
  if (recordDate < purchaseDate) return { error: "วันที่รายงานต้องไม่ก่อนวันที่ดำเนินการ" };
  if (receiptDate && receiptDate > recordDate) return { error: "วันที่ใบเสร็จต้องไม่หลังวันที่รายงาน" };
  if (!(amount > 0)) return { error: "จำนวนเงินต้องมากกว่า 0" };
  return {
    docNoInput: str("doc_no"),
    fields: {
      doc_type: str("doc_type") === "จ้าง" ? "จ้าง" : "ซื้อ",
      approval_id: str("approval_id") || null,
      record_date: recordDate,
      purchase_date: purchaseDate,
      subject: str("subject"),
      reason: str("reason") || null,
      work_text: str("work_text"),
      amount: Math.round(amount * 100) / 100,
      payee: str("payee") || null,
      receipt_book: str("receipt_book") || null,
      receipt_no: str("receipt_no") || null,
      receipt_date: receiptDate,
      responsible_name: str("responsible_name") || null,
      responsible_position: str("responsible_position") || null,
      admin_group: str("admin_group") || null,
      project_id: str("project_id") || null,
      activity_id: str("activity_id") || null,
    },
  };
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
  const docNo = admin && parsed.docNoInput ? parsed.docNoInput : await assignDocNumber(supabase, "urgent", parsed.fields.record_date);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("proc_urgent_reports")
    .insert({ ...parsed.fields, doc_no: docNo, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
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
  return done();
}

export async function deleteUrgent(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_urgent_reports").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}
