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

export async function createProject(formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;

  if (!name || !budget_year_id || !admin_group_id) return;

  const { error } = await supabase.from("plan_projects").insert({
    name,
    budget_year_id,
    admin_group_id,
    budget_source_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}
