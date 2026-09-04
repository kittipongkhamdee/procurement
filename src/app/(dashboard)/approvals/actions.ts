"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildApprovalPdfData, renderApprovalPdfBuffer } from "@/lib/pdf/build-approval-pdf";

const PDF_BUCKET = "procurement-documents";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return { supabase, user };
}

/** อนุญาตให้ผู้ดูแลระบบ หรือผู้ที่มีสถานะผู้ใช้งานตามชื่อที่ระบุ (เช่น "ผู้อำนวยการ") ทำรายการได้ —
 * แพทเทิร์นเดียวกับ requireAdminOrGroup ใน project-proposals/actions.ts */
async function requireAdminOrGroup(groupName: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") return { supabase, signerName: profile.full_name ?? user.email ?? "" };

  const { data: membership } = await supabase
    .from("proc_user_group_members")
    .select("group_id, proc_user_groups!inner(name)")
    .eq("user_id", user.id)
    .eq("proc_user_groups.name", groupName)
    .maybeSingle();
  if (!membership) throw new Error(`เฉพาะผู้ดูแลระบบหรือผู้มีสถานะ "${groupName}" เท่านั้น`);
  return { supabase, signerName: profile?.full_name ?? user.email ?? "" };
}

type ItemInput = { name: string; qty: string; unitPrice: string; note: string };
type SummaryItemInput = { label: string; amount: string; note: string };

/** ปีงบประมาณไทย: ต.ค. - ก.ย. นับชื่อปีตาม พ.ศ. ของปีที่ปีงบประมาณสิ้นสุด (เช่น ต.ค. 2569 - ก.ย. 2570 คือ
 * ปีงบประมาณ 2570) */
function thaiFiscalYear(isoDate: string): number {
  const [year, month] = isoDate.slice(0, 10).split("-").map(Number);
  const gregorianFiscalYear = month >= 10 ? year + 1 : year;
  return gregorianFiscalYear + 543;
}

/** เลขที่หนังสือถัดไปของปีงบประมาณนั้น รูปแบบ "<ลำดับ>/<ปีงบประมาณ>" — นับจากจำนวนเลขสูงสุดที่ยัง
 * มีอยู่จริงในตาราง proc_approvals ของปีงบประมาณนั้นแล้ว +1 (ถ้าลบบันทึกที่มีเลขสูงสุดออก เลขถัดไป
 * จะย้อนกลับมาใช้เลขนั้นซ้ำได้ตามที่ผู้ใช้ต้องการ) */
async function nextDocNumber(supabase: Awaited<ReturnType<typeof createClient>>, docDate: string) {
  const fiscalYear = thaiFiscalYear(docDate);
  const suffix = `/${fiscalYear}`;
  const { data } = await supabase.from("proc_approvals").select("doc_number").ilike("doc_number", `%${suffix}`);

  let maxSeq = 0;
  (data ?? []).forEach((row) => {
    const n = parseInt(String(row.doc_number ?? "").split("/")[0], 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  });

  return `${maxSeq + 1}${suffix}`;
}

async function generatePdf(supabase: Awaited<ReturnType<typeof createClient>>, approvalId: string) {
  // best-effort: บันทึกหลักถูกบันทึกไปแล้ว การสร้าง PDF ล่วงหน้าล้มเหลวไม่ควรทำให้ทั้งการบันทึกล้มเหลวตาม
  // (หน้า [id]/pdf ยังพิมพ์สดได้เสมอ)
  try {
    const pdfResult = await buildApprovalPdfData(supabase, approvalId);
    if (pdfResult) {
      const buffer = await renderApprovalPdfBuffer(pdfResult.data);
      const path = `approvals/${approvalId}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (!uploadError) {
        await supabase.from("proc_approvals").update({ approval_pdf_url: path }).eq("id", approvalId);
      }
    }
  } catch {
    // ignored — see comment above
  }
}

export async function createApproval(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requestedAmount = Number(formData.get("requested_amount") ?? 0);

  const summaryItemsRaw = String(formData.get("summary_items_json") ?? "[]");
  let summaryItems: SummaryItemInput[] = [];
  try {
    summaryItems = JSON.parse(summaryItemsRaw);
  } catch {
    summaryItems = [];
  }

  const docDate = String(formData.get("doc_date") ?? "");
  const docNumber = docDate ? await nextDocNumber(supabase, docDate) : null;

  const { data: approval, error } = await supabase
    .from("proc_approvals")
    .insert({
      doc_number: docNumber,
      doc_date: docDate,
      subject: String(formData.get("subject") ?? ""),
      addressed_to: String(formData.get("addressed_to") ?? ""),
      department: String(formData.get("department") ?? "").trim() || null,
      activity_name: String(formData.get("activity_name") ?? "").trim() || null,
      plan_date_text: String(formData.get("plan_date_text") ?? "").trim() || null,
      project_id: String(formData.get("project_id") ?? "") || null,
      fund_type: String(formData.get("fund_type") ?? "") || null,
      budget: formData.get("budget") ? Number(formData.get("budget")) : null,
      requested_amount: requestedAmount,
      remaining: formData.get("remaining") ? Number(formData.get("remaining")) : null,
      summary_items: summaryItems
        .filter((s) => s.label.trim() !== "")
        .map((s) => ({ label: s.label, amount: s.amount ? Number(s.amount) : null, note: s.note || null })),
      requested_by_name: String(formData.get("requested_by_name") ?? "") || null,
      requested_by_position: String(formData.get("requested_by_position") ?? "") || null,
      group_name: String(formData.get("group_name") ?? "").trim() || null,
      budget_year_text: String(formData.get("budget_year_text") ?? "").trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const itemsRaw = String(formData.get("items_json") ?? "[]");
  let items: ItemInput[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  const rowsToInsert = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name.trim() !== "")
    .map(({ item, index }) => ({
      approval_id: approval.id,
      seq: index + 1,
      name: item.name,
      qty: item.qty ? Number(item.qty) : null,
      unit_price: item.unitPrice ? Number(item.unitPrice) : null,
      note: item.note || null,
    }));

  if (rowsToInsert.length > 0) {
    const { error: itemsError } = await supabase.from("proc_approval_items").insert(rowsToInsert);
    if (itemsError) throw new Error(itemsError.message);
  }

  await generatePdf(supabase, approval.id);

  revalidatePath("/approvals");
}

export async function updateApproval(id: string, formData: FormData) {
  const supabase = await createClient();

  // แก้ไขไม่ได้ถ้ารองผู้อำนวยการเสนอความเห็นแล้ว (ไม่ว่าเห็นควรหรือไม่ — ทั้งสองกรณีเลื่อนสถานะเป็น
  // "รออนุมัติ" ส่งต่อให้ผู้อำนวยการแล้ว) หรือผู้อำนวยการอนุมัติแล้ว — ถ้าผู้อำนวยการ "ไม่อนุมัติ"
  // ยังแก้ไขได้ (แก้แล้วจะย้อนสถานะเป็น "รอเสนอ" ใหม่ด้านล่าง)
  const { data: current } = await supabase
    .from("proc_approvals")
    .select("status, deputy_decision")
    .eq("id", id)
    .maybeSingle();
  if (!current) throw new Error("ไม่พบบันทึกนี้");
  const editable = current.status === "ไม่อนุมัติ" || (current.status === "รออนุมัติ" && current.deputy_decision === null);
  if (!editable) throw new Error("รายการนี้มีผู้เห็นชอบแล้ว ไม่สามารถแก้ไขได้");

  const requestedAmount = Number(formData.get("requested_amount") ?? 0);

  const summaryItemsRaw = String(formData.get("summary_items_json") ?? "[]");
  let summaryItems: SummaryItemInput[] = [];
  try {
    summaryItems = JSON.parse(summaryItemsRaw);
  } catch {
    summaryItems = [];
  }

  const { error } = await supabase
    .from("proc_approvals")
    .update({
      doc_number: String(formData.get("doc_number") ?? "").trim() || null,
      doc_date: String(formData.get("doc_date") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      addressed_to: String(formData.get("addressed_to") ?? ""),
      department: String(formData.get("department") ?? "").trim() || null,
      activity_name: String(formData.get("activity_name") ?? "").trim() || null,
      plan_date_text: String(formData.get("plan_date_text") ?? "").trim() || null,
      project_id: String(formData.get("project_id") ?? "") || null,
      fund_type: String(formData.get("fund_type") ?? "") || null,
      budget: formData.get("budget") ? Number(formData.get("budget")) : null,
      requested_amount: requestedAmount,
      remaining: formData.get("remaining") ? Number(formData.get("remaining")) : null,
      summary_items: summaryItems
        .filter((s) => s.label.trim() !== "")
        .map((s) => ({ label: s.label, amount: s.amount ? Number(s.amount) : null, note: s.note || null })),
      requested_by_name: String(formData.get("requested_by_name") ?? "") || null,
      requested_by_position: String(formData.get("requested_by_position") ?? "") || null,
      group_name: String(formData.get("group_name") ?? "").trim() || null,
      budget_year_text: String(formData.get("budget_year_text") ?? "").trim() || null,
      // แก้ไขบันทึกแล้วย้อนสถานะเป็น "รอเสนอ" ใหม่เสมอ (ล้างความเห็น/การอนุมัติเดิมทิ้ง เผื่อเป็นการ
      // แก้ไขหลังผู้อำนวยการ "ไม่อนุมัติ" มา)
      status: "รออนุมัติ",
      deputy_decision: null,
      deputy_decided_by_name: null,
      deputy_decided_at: null,
      deputy_note: null,
      approved_by_name: null,
      approved_at: null,
      approve_note: null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  const itemsRaw = String(formData.get("items_json") ?? "[]");
  let items: ItemInput[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  const { error: deleteItemsError } = await supabase.from("proc_approval_items").delete().eq("approval_id", id);
  if (deleteItemsError) throw new Error(deleteItemsError.message);

  const rowsToInsert = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name.trim() !== "")
    .map(({ item, index }) => ({
      approval_id: id,
      seq: index + 1,
      name: item.name,
      qty: item.qty ? Number(item.qty) : null,
      unit_price: item.unitPrice ? Number(item.unitPrice) : null,
      note: item.note || null,
    }));

  if (rowsToInsert.length > 0) {
    const { error: itemsError } = await supabase.from("proc_approval_items").insert(rowsToInsert);
    if (itemsError) throw new Error(itemsError.message);
  }

  await generatePdf(supabase, id);

  revalidatePath("/approvals");
}

export async function deleteApproval(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_approvals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}

export async function updateApprovalStatus(id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) {
  const { supabase, signerName } = await requireAdminOrGroup("ผู้อำนวยการ");
  const { error } = await supabase
    .from("proc_approvals")
    .update({
      status: decision,
      approved_by_name: signerName.trim() || null,
      approved_at: new Date().toISOString(),
      approve_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "รออนุมัติ");
  if (error) throw new Error(error.message);
  await generatePdf(supabase, id);
  revalidatePath("/approvals");
}

/** ย้อนสถานะกลับเป็น "รออนุมัติ" เผื่อกดอนุมัติ/ไม่อนุมัติผิด — แอดมินหรือผู้อำนวยการเองย้อนได้ */
export async function resetApprovalStatus(id: string) {
  const { supabase } = await requireAdminOrGroup("ผู้อำนวยการ");
  const { error } = await supabase
    .from("proc_approvals")
    .update({ status: "รออนุมัติ", approved_by_name: null, approved_at: null, approve_note: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await generatePdf(supabase, id);
  revalidatePath("/approvals");
}

export async function updateDeputyDecision(id: string, decision: "ควร" | "ไม่ควร", note?: string) {
  const { supabase, signerName } = await requireAdminOrGroup("รองผู้อำนวยการ");
  const { error } = await supabase
    .from("proc_approvals")
    .update({
      deputy_decision: decision,
      deputy_decided_by_name: signerName.trim() || null,
      deputy_decided_at: new Date().toISOString(),
      deputy_note: decision === "ไม่ควร" ? note?.trim() || null : null,
    })
    .eq("id", id)
    .is("deputy_decision", null);
  if (error) throw new Error(error.message);
  await generatePdf(supabase, id);
  revalidatePath("/approvals");
}

/** ย้อนความเห็นของรองผู้อำนวยการกลับเป็นค่าว่าง เผื่อกดผิด — แอดมินหรือรองผู้อำนวยการเองย้อนได้ */
export async function resetDeputyDecision(id: string) {
  const { supabase } = await requireAdminOrGroup("รองผู้อำนวยการ");
  const { error } = await supabase
    .from("proc_approvals")
    .update({ deputy_decision: null, deputy_decided_by_name: null, deputy_decided_at: null, deputy_note: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await generatePdf(supabase, id);
  revalidatePath("/approvals");
}
