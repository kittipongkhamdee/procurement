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

type ActivityRow = { name: string; budget: string; responsible: string[] };

export async function createProject(formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;
  const hasActivities = String(formData.get("has_activities") ?? "yes") !== "no";
  const directBudget = hasActivities ? 0 : Number(formData.get("project_budget") ?? 0);

  if (!name || !budget_year_id || !admin_group_id) return;

  const { data: project, error } = await supabase
    .from("plan_projects")
    .insert({ name, budget_year_id, admin_group_id, budget_source_id, budget: directBudget })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (hasActivities) {
    let activityRows: ActivityRow[] = [];
    try {
      activityRows = JSON.parse(String(formData.get("activities_json") ?? "[]"));
    } catch {
      activityRows = [];
    }

    const rowsToInsert = activityRows
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        project_id: project.id,
        name: a.name.trim(),
        budget: a.budget ? Number(a.budget) : 0,
        responsible: Array.isArray(a.responsible) ? a.responsible : [],
      }));

    if (rowsToInsert.length > 0) {
      const { error: activitiesError } = await supabase.from("plan_activities").insert(rowsToInsert);
      if (activitiesError) throw new Error(activitiesError.message);
    }
  }

  revalidatePath("/projects");
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;
  const budget = Number(formData.get("project_budget") ?? 0);

  if (!name || !budget_year_id || !admin_group_id) return;

  const { error } = await supabase
    .from("plan_projects")
    .update({ name, budget_year_id, admin_group_id, budget_source_id, budget })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function createActivity(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  if (!name) return;

  const { error } = await supabase.from("plan_activities").insert({
    project_id: projectId,
    name,
    budget,
    responsible,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function updateActivity(activityId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  const { error } = await supabase
    .from("plan_activities")
    .update({ name, budget, responsible })
    .eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function deleteActivity(activityId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_activities").delete().eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}
