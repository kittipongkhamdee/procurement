"use server";

// Server actions สำหรับ "ตรวจสอบพัสดุประจำปี" (ระเบียบกระทรวงการคลังฯ ข้อ 213) — ผูกกับ
// asset_items/asset_conditions เดิม เพิ่มตารางใหม่ 3 ตัว (asset_audit_rounds/asset_audit_inspectors/
// asset_audit_items) ดู migration asset_annual_audit_tables
//
// สิทธิ์เขียนแบ่งเป็น 2 ระดับ: การจัดการรอบ (สร้าง/ส่งรายงาน/ลบ) เฉพาะ requireAssetStaff() เดิม
// (admin/เจ้าหน้าที่พัสดุ) — ส่วนการบันทึกผลตรวจนับรายรายการ (updateAuditItemResult) ต้องเปิดให้
// "ผู้ตรวจสอบ" ที่ได้รับแต่งตั้งในรอบนั้นด้วย (ตามระเบียบมักเป็นครู ไม่ใช่เจ้าหน้าที่พัสดุ — แยกหน้าที่
// กัน) จึงใช้ requireAuditAccess() แทน ทั้งสองฟังก์ชันพึ่ง RLS ของฐานข้อมูลเป็นด่านจริงอยู่ดี
// (asset_is_staff() / asset_is_audit_inspector()) โค้ดฝั่งนี้แค่คืนข้อความ error ที่อ่านง่ายกว่า

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/asset-audits";

async function requireAssetStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "supply_officer") {
    throw new Error("เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่พัสดุเท่านั้น");
  }
  return { supabase, userId: user?.id ?? null };
}

async function requireAuditAccess(roundId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";
  const [{ data: profile }, { data: inspector }] = await Promise.all([
    supabase.from("proc_profiles").select("role").eq("user_id", userId).maybeSingle(),
    supabase.from("asset_audit_inspectors").select("id").eq("audit_round_id", roundId).eq("user_id", userId).maybeSingle(),
  ]);
  const isStaff = profile?.role === "admin" || profile?.role === "supply_officer";
  if (!isStaff && !inspector) {
    throw new Error("เฉพาะเจ้าหน้าที่พัสดุหรือผู้ตรวจสอบที่ได้รับแต่งตั้งในรอบนี้เท่านั้น");
  }
  return { supabase, userId, isStaff };
}

export async function createAuditRound(formData: FormData) {
  const { supabase, userId } = await requireAssetStaff();

  const fiscalYear = Number(formData.get("fiscal_year") ?? 0);
  const startDate = String(formData.get("start_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  if (!fiscalYear || !startDate || !dueDate) {
    throw new Error("กรอกข้อมูลให้ครบ (ปีงบประมาณ/วันเริ่มตรวจ/วันครบกำหนด)");
  }

  const inspectorIds = formData.getAll("inspector_user_id").map(String).filter(Boolean);
  const inspectorNames = formData.getAll("inspector_full_name").map(String);
  if (inspectorIds.length === 0) {
    throw new Error("กรุณาเลือกผู้ตรวจสอบพัสดุอย่างน้อย 1 คน");
  }

  const { data: round, error } = await supabase
    .from("asset_audit_rounds")
    .insert({
      fiscal_year: fiscalYear,
      appointment_doc_ref: String(formData.get("appointment_doc_ref") ?? "").trim() || null,
      appointment_date: String(formData.get("appointment_date") ?? "").trim() || null,
      start_date: startDate,
      due_date: dueDate,
      status: "in_progress",
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: inspectorsError } = await supabase.from("asset_audit_inspectors").insert(
    inspectorIds.map((user_id, i) => ({
      audit_round_id: round.id,
      user_id,
      full_name_snapshot: inspectorNames[i] ?? "",
      sort_order: i,
    })),
  );
  if (inspectorsError) throw new Error(inspectorsError.message);

  // snapshot ผลตรวจนับล่วงหน้าจากทุกรายการใน asset_items ปัจจุบัน — สภาพตามบัญชี ณ วันเริ่มตรวจ
  // (book_condition_id) ต้องคงที่ตลอดรอบ แม้ภายหลังมีคนแก้ทะเบียนจริงต่อ ไม่ให้ผลตรวจเพี้ยนตาม
  const { data: items, error: itemsError } = await supabase.from("asset_items").select("id, condition_id");
  if (itemsError) throw new Error(itemsError.message);

  if (items && items.length > 0) {
    const { error: auditItemsError } = await supabase.from("asset_audit_items").insert(
      items.map((it) => ({
        audit_round_id: round.id,
        item_id: it.id,
        book_condition_id: it.condition_id,
      })),
    );
    if (auditItemsError) throw new Error(auditItemsError.message);
  }

  revalidatePath(PATH);
  return round.id;
}

export async function updateAuditItemResult(auditItemId: string, roundId: string, formData: FormData) {
  const { supabase, userId } = await requireAuditAccess(roundId);

  const found = formData.get("found") === "true";
  const actualConditionId = String(formData.get("actual_condition_id") ?? "").trim() || null;
  const actualLocation = String(formData.get("actual_location") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const { error } = await supabase
    .from("asset_audit_items")
    .update({
      found,
      actual_condition_id: found ? actualConditionId : null,
      actual_location: found ? actualLocation : null,
      note,
      inspected_by: userId,
      inspected_at: new Date().toISOString(),
    })
    .eq("id", auditItemId);
  if (error) throw new Error(error.message);
  revalidatePath(`${PATH}/${roundId}`);
}

export async function submitAuditReport(roundId: string, formData: FormData) {
  const { supabase, userId } = await requireAssetStaff();
  const reportNote = String(formData.get("report_note") ?? "").trim() || null;

  const { error } = await supabase
    .from("asset_audit_rounds")
    .update({
      status: "submitted",
      report_note: reportNote,
      submitted_by: userId,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", roundId);
  if (error) throw new Error(error.message);
  revalidatePath(`${PATH}/${roundId}`);
}

export async function reopenAuditRound(roundId: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase
    .from("asset_audit_rounds")
    .update({
      status: "in_progress",
      deputy_acknowledged_by: null,
      deputy_acknowledged_at: null,
      acknowledged_by: null,
      acknowledged_at: null,
    })
    .eq("id", roundId);
  if (error) throw new Error(error.message);
  revalidatePath(`${PATH}/${roundId}`);
}

export async function saveAuditReportNote(roundId: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const reportNote = String(formData.get("report_note") ?? "").trim() || null;
  const { error } = await supabase.from("asset_audit_rounds").update({ report_note: reportNote }).eq("id", roundId);
  if (error) throw new Error(error.message);
  revalidatePath(`${PATH}/${roundId}`);
}

// รับทราบผล 2 ระดับ คล้ายเห็นชอบ/อนุมัติโครงการ (endorseProposal/approveProposal ใน
// project-proposals/actions.ts): รองผู้อำนวยการรับทราบก่อน (submitted -> acknowledged_deputy)
// แล้วส่งต่อให้ผู้อำนวยการรับทราบขั้นสุดท้าย (acknowledged_deputy -> acknowledged) — RLS
// (asset_audit_rounds_ack_deputy / asset_audit_rounds_ack_director) เป็นด่านจริงที่บังคับลำดับ
// ขั้นนี้อยู่แล้ว โค้ดฝั่งนี้แค่คืนข้อความ error ที่อ่านง่ายกว่าเวลาข้ามขั้นตอนหรือผิดสิทธิ์
export async function acknowledgeAuditReport(roundId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (profile?.role === "deputy_director") {
    const { error } = await supabase
      .from("asset_audit_rounds")
      .update({
        status: "acknowledged_deputy",
        deputy_acknowledged_by: user?.id ?? null,
        deputy_acknowledged_at: new Date().toISOString(),
      })
      .eq("id", roundId)
      .eq("status", "submitted");
    if (error) throw new Error(error.message);
  } else if (profile?.role === "director") {
    const { error } = await supabase
      .from("asset_audit_rounds")
      .update({ status: "acknowledged", acknowledged_by: user?.id ?? null, acknowledged_at: new Date().toISOString() })
      .eq("id", roundId)
      .eq("status", "acknowledged_deputy");
    if (error) throw new Error(error.message);
  } else {
    throw new Error("เฉพาะผู้อำนวยการหรือรองผู้อำนวยการเท่านั้นที่รับทราบผลรายงานได้");
  }

  revalidatePath(`${PATH}/${roundId}`);
}

export async function deleteAuditRound(roundId: string) {
  const { supabase } = await requireAssetStaff();
  const { data: round } = await supabase.from("asset_audit_rounds").select("status").eq("id", roundId).maybeSingle();
  if (round?.status === "submitted" || round?.status === "acknowledged_deputy" || round?.status === "acknowledged") {
    throw new Error("ลบไม่ได้เพราะส่งรายงานผลการตรวจสอบไปแล้ว");
  }
  const { error } = await supabase.from("asset_audit_rounds").delete().eq("id", roundId);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
