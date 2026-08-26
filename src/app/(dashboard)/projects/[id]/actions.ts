"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;

  if (!name || !budget_year_id || !admin_group_id) return;

  const { error } = await supabase
    .from("plan_projects")
    .update({ name, budget_year_id, admin_group_id, budget_source_id })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createActivity(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = String(formData.get("responsible") ?? "").trim() || null;

  if (!name) return;

  const { error } = await supabase.from("plan_activities").insert({
    project_id: projectId,
    name,
    budget,
    responsible,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateActivity(projectId: string, activityId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = String(formData.get("responsible") ?? "").trim() || null;

  const { error } = await supabase
    .from("plan_activities")
    .update({ name, budget, responsible })
    .eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteActivity(projectId: string, activityId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_activities").delete().eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
