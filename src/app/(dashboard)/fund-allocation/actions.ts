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

// เพิ่มร่างโครงการเปล่าให้แก้ไขต่อได้ทันที — คืนแถวที่สร้างเพื่อให้ฝั่งหน้าเว็บเปิดโหมดแก้ไขต่อได้เลย
export async function createDraftProject(budgetYearId: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("plan_draft_projects")
    .insert({ budget_year_id: budgetYearId, name: "โครงการใหม่" })
    .select("id, name, admin_group_id, budget_source_id, budget")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  return data;
}

// แก้ไขร่างโครงการแบบอินไลน์ (ชื่อ/กลุ่มบริหาร/แหล่งงบ/งบประมาณ) — ส่งเฉพาะฟิลด์ที่เปลี่ยน
export async function updateDraftProject(
  id: string,
  fields: { name?: string; admin_group_id?: string | null; budget_source_id?: string | null; budget?: number },
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_draft_projects").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function deleteDraftProject(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_draft_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}
