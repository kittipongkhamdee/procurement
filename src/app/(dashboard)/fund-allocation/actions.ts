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

// คัดลอกโครงการจากปีงบประมาณเดิม (plan_projects + plan_activities) มาเป็น "ข้อเสนอโครงการ" ใหม่
// (plan_project_proposals สถานะเริ่มต้น "รอเห็นชอบ" ตาม default ของตาราง) สำหรับปีงบประมาณใหม่ที่เลือก
// ไว้ในหน้านี้ — เป็นจุดเริ่มต้นให้ไปเข้ากระบวนการเห็นชอบ/อนุมัติต่อที่เมนู "เสนอโครงการ" ตามปกติ
// ไม่เขียนลง plan_projects ตรงๆ
export async function copyProjectsToProposals(targetBudgetYearId: string, projectIds: string[]) {
  const supabase = await requireAdmin();
  if (projectIds.length === 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("full_name")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const { data: projects, error: fetchError } = await supabase
    .from("plan_projects")
    .select("id, name, admin_group_id, budget_source_id, budget, plan_activities(name, budget, responsible)")
    .in("id", projectIds);
  if (fetchError) throw new Error(fetchError.message);
  if (!projects || projects.length === 0) return;

  const rows = projects.map((p) => {
    const activities =
      (p.plan_activities as unknown as { name: string; budget: number; responsible: string[] }[]) ?? [];
    const budgetAmount =
      activities.length > 0 ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
    return {
      created_by: user?.id ?? null,
      proposer_name: profile?.full_name ?? null,
      budget_year_id: targetBudgetYearId,
      admin_group_id: p.admin_group_id,
      name: p.name,
      budget_source_id: p.budget_source_id,
      budget_amount: budgetAmount,
      activities: activities.map((a) => ({
        name: a.name,
        budget: Number(a.budget ?? 0),
        responsible: a.responsible ?? [],
      })),
    };
  });

  const { error } = await supabase.from("plan_project_proposals").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  revalidatePath("/project-proposals");
}
