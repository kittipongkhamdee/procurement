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

// สร้างโครงการแบบง่าย (ไม่มีกิจกรรมย่อย) ให้แท็บ "จัดโครงการ" กดเพิ่มแถวได้ทันทีแล้วแก้ไขทีหลัง
export async function createSimpleProject(budgetYearId: string, adminGroupId: string, budgetSourceId: string | null) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_projects")
    .insert({ name: "โครงการใหม่", budget_year_id: budgetYearId, admin_group_id: adminGroupId, budget_source_id: budgetSourceId, budget: 0 });
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  revalidatePath("/projects");
}

// แก้ไขชื่อ/กลุ่มบริหาร/แหล่งงบประมาณของโครงการแบบอินไลน์ (แยกจาก updateProject ใน projects/actions.ts
// เพราะที่นี่ไม่มีฟอร์มกิจกรรมย่อยมาด้วย)
export async function updateProjectFields(
  projectId: string,
  fields: { name?: string; admin_group_id?: string; budget_source_id?: string | null },
) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_projects").update(fields).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  revalidatePath("/projects");
}
