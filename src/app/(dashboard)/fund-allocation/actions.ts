"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return supabase;
}

// อนุญาตให้ admin แก้ไขร่างโครงการได้เสมอ ส่วนผู้ใช้อื่นแก้ไขได้เฉพาะตอนที่ admin เปิด
// "เปิดการแก้ไขให้ทุกคน" ไว้สำหรับปีงบประมาณนั้น (plan_budget_years.draft_projects_open_edit) —
// เพิ่ม/แก้ไขร่างโครงการเท่านั้น การลบยังคงจำกัดเฉพาะ admin เสมอ (ดู deleteDraftProject)
async function requireDraftEditor(budgetYearId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const { data: profile } = await supabase.from("proc_profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "admin") return supabase;
  const { data: year } = await supabase
    .from("plan_budget_years")
    .select("draft_projects_open_edit")
    .eq("id", budgetYearId)
    .maybeSingle();
  if (!year?.draft_projects_open_edit) throw new Error("ขณะนี้ยังไม่เปิดให้แก้ไขร่างโครงการ กรุณาติดต่อผู้ดูแลระบบ");
  return supabase;
}

export async function upsertStudentCount(budgetYearId: string, gradeKey: string, studentCount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_student_counts")
    .upsert(
      { budget_year_id: budgetYearId, grade_key: gradeKey, student_count: studentCount },
      { onConflict: "budget_year_id,grade_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertRevenueRate(
  budgetYearId: string,
  itemKey: string,
  gradeKey: string,
  ratePerStudent: number,
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_revenue_rates")
    .upsert(
      { budget_year_id: budgetYearId, item_key: itemKey, grade_key: gradeKey, rate_per_student: ratePerStudent },
      { onConflict: "budget_year_id,item_key,grade_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertSchoolIncome(budgetYearId: string, amount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_school_income")
    .upsert({ budget_year_id: budgetYearId, amount }, { onConflict: "budget_year_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertGroupAllocation(budgetYearId: string, adminGroupId: string, allocatedAmount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_group_allocations")
    .upsert(
      { budget_year_id: budgetYearId, admin_group_id: adminGroupId, allocated_amount: allocatedAmount },
      { onConflict: "budget_year_id,admin_group_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// คัดลอกโครงการจากปีงบประมาณเดิม (plan_projects + plan_activities) มาเป็น "ร่างโครงการ"
// (plan_draft_projects) สำหรับปีงบประมาณใหม่ที่เลือกไว้ในหน้านี้ — ยังไม่ใช่โครงการจริงและไม่ใช่
// ข้อเสนอโครงการ เป็นแค่ข้อมูลตั้งต้นให้ admin แก้ไข/เพิ่ม/ลบ ชื่อ/กลุ่มบริหาร/แหล่งงบ/งบประมาณ
// ก่อนที่ครูจะไปเลือกใช้ตอนสร้างข้อเสนอโครงการจริงที่เมนู "เสนอโครงการ" ต่อไป
export async function copyProjectsToDraft(targetBudgetYearId: string, projectIds: string[]) {
  const supabase = await requireAdmin();
  if (projectIds.length === 0) return;

  const { data: projects, error: fetchError } = await supabase
    .from("plan_projects")
    .select("id, name, admin_group_id, budget_source_id, budget, plan_activities(budget)")
    .in("id", projectIds);
  if (fetchError) throw new Error(fetchError.message);
  if (!projects || projects.length === 0) return;

  const rows = projects.map((p) => {
    const activities = (p.plan_activities as unknown as { budget: number }[]) ?? [];
    const budget =
      activities.length > 0 ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
    return {
      budget_year_id: targetBudgetYearId,
      name: p.name,
      admin_group_id: p.admin_group_id,
      budget_source_id: p.budget_source_id,
      budget,
    };
  });

  const { error } = await supabase.from("plan_draft_projects").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// ล็อกแก้ไขร่างโครงการหมดอายุอัตโนมัติหลังไม่มีการบันทึก/ยกเลิกภายในเวลานี้ (กันกรณีปิดแท็บทิ้งไว้
// ระหว่างแก้ไข ไม่ให้ร่างโครงการนั้นถูกล็อกค้างตลอดไป)
const EDIT_LOCK_MINUTES = 10;

async function getDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, fallbackEmail: string | null) {
  const { data: profile } = await supabase.from("proc_profiles").select("full_name").eq("user_id", userId).maybeSingle();
  return profile?.full_name ?? fallbackEmail ?? "ผู้ใช้";
}

// เพิ่มร่างโครงการเปล่าให้แก้ไขต่อได้ทันที — ล็อกให้ผู้สร้างแก้ไขต่อได้เลยโดยไม่มีคนอื่นแย่งแก้ไขระหว่างนั้น
// คืนแถวที่สร้างเพื่อให้ฝั่งหน้าเว็บเปิดโหมดแก้ไขต่อได้เลย
export async function createDraftProject(budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myName = user ? await getDisplayName(supabase, user.id, user.email ?? null) : "ผู้ใช้";
  const { data, error } = await supabase
    .from("plan_draft_projects")
    .insert({
      budget_year_id: budgetYearId,
      name: "โครงการใหม่",
      editing_by: user?.id ?? null,
      editing_by_name: myName,
      editing_at: new Date().toISOString(),
    })
    .select("id, name, admin_group_id, budget_source_id, budget, editing_by, editing_by_name, editing_at")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  return data;
}

// จองสิทธิ์แก้ไขร่างโครงการแถวหนึ่ง — กันไม่ให้อีกคนกดแก้ไขแถวเดียวกันพร้อมกัน จนกว่าจะบันทึก/ยกเลิก
// (หรือจนล็อกหมดอายุ) ใช้ UPDATE เงื่อนไขเดียวกันแบบ atomic กันแย่งกันจองพร้อมกันพอดี
export async function acquireDraftEditLock(id: string, budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const myName = await getDisplayName(supabase, user.id, user.email ?? null);

  const staleThreshold = new Date(Date.now() - EDIT_LOCK_MINUTES * 60 * 1000).toISOString();
  const { data: updated, error } = await supabase
    .from("plan_draft_projects")
    .update({ editing_by: user.id, editing_by_name: myName, editing_at: new Date().toISOString() })
    .eq("id", id)
    .or(`editing_by.is.null,editing_by.eq.${user.id},editing_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) {
    const { data: row } = await supabase.from("plan_draft_projects").select("editing_by_name").eq("id", id).maybeSingle();
    throw new Error(`ขณะนี้ ${row?.editing_by_name ?? "ผู้ใช้อื่น"} กำลังแก้ไขรายการนี้อยู่ กรุณาลองใหม่อีกครั้ง`);
  }
  revalidatePath("/fund-allocation");
}

// ปล่อยสิทธิ์แก้ไข (ตอนกดยกเลิก) — ให้คนอื่นกดแก้ไขแถวนี้ต่อได้ทันที
export async function releaseDraftEditLock(id: string, budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const { error } = await supabase
    .from("plan_draft_projects")
    .update({ editing_by: null, editing_by_name: null, editing_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// แก้ไขร่างโครงการแบบอินไลน์ (ชื่อ/กลุ่มบริหาร/แหล่งงบ/งบประมาณ) — ส่งเฉพาะฟิลด์ที่เปลี่ยน พร้อมปล่อย
// สิทธิ์แก้ไขที่จองไว้ (บันทึกสำเร็จ = แก้ไขเสร็จแล้ว)
export async function updateDraftProject(
  id: string,
  budgetYearId: string,
  fields: { name?: string; admin_group_id?: string | null; budget_source_id?: string | null; budget?: number },
) {
  const supabase = await requireDraftEditor(budgetYearId);
  const { error } = await supabase
    .from("plan_draft_projects")
    .update({ ...fields, editing_by: null, editing_by_name: null, editing_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// การลบร่างโครงการจำกัดเฉพาะ admin เสมอ ไม่ว่าจะเปิดการแก้ไขให้ทุกคนหรือไม่ก็ตาม
export async function deleteDraftProject(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_draft_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// admin เปิด/ปิดให้ทุกคนเพิ่ม/แก้ไขร่างโครงการได้ สำหรับปีงบประมาณที่ระบุ
export async function setDraftEditOpen(budgetYearId: string, open: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_budget_years")
    .update({ draft_projects_open_edit: open })
    .eq("id", budgetYearId);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}
