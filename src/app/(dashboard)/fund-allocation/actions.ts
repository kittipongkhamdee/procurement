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
