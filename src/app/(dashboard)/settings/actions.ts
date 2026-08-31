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

export async function createBudgetYear(formData: FormData) {
  const supabase = await requireAdmin();
  const year = Number(formData.get("year"));
  const name = String(formData.get("name") ?? "").trim();
  const { error } = await supabase.from("plan_budget_years").insert({
    year,
    name: name || `แผนปฏิบัติการประจำปีงบประมาณ ${year}`,
    is_open: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setCurrentBudgetYear(yearId: string) {
  const supabase = await requireAdmin();
  const { error: closeError } = await supabase
    .from("plan_budget_years")
    .update({ is_open: false })
    .neq("id", yearId);
  if (closeError) throw new Error(closeError.message);
  const { error } = await supabase.from("plan_budget_years").update({ is_open: true }).eq("id", yearId);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function createBudgetSource(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_budget_sources").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function toggleBudgetSourceActive(id: string, isActive: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_budget_sources").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteBudgetSource(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_budget_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createAdminGroup(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_admin_groups").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function updateAdminGroupName(id: string, formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_admin_groups").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function toggleAdminGroupActive(id: string, isActive: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_admin_groups").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function deleteAdminGroup(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_admin_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/projects");
}

export async function createTeacher(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_teachers").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateTeacherName(id: string, formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_teachers").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function toggleTeacherActive(id: string, isActive: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_teachers").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteTeacher(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_teachers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function createUserGroup(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("proc_user_groups").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateUserGroupName(id: string, formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("proc_user_groups").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function toggleUserGroupActive(id: string, isActive: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("proc_user_groups").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deleteUserGroup(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("proc_user_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setUserGroups(userId: string, groupIds: string[]) {
  const supabase = await requireAdmin();
  const { error: deleteError } = await supabase.from("proc_user_group_members").delete().eq("user_id", userId);
  if (deleteError) throw new Error(deleteError.message);
  if (groupIds.length > 0) {
    const { error: insertError } = await supabase
      .from("proc_user_group_members")
      .insert(groupIds.map((group_id) => ({ user_id: userId, group_id })));
    if (insertError) throw new Error(insertError.message);
  }
  revalidatePath("/settings");
}

export async function setGeminiApiKey(formData: FormData) {
  const supabase = await requireAdmin();
  const value = String(formData.get("gemini_api_key") ?? "").trim();
  const { error } = await supabase
    .from("proc_app_settings")
    .upsert({ key: "gemini_api_key", value: value || null, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setGeminiModel(formData: FormData) {
  const supabase = await requireAdmin();
  const value = String(formData.get("gemini_model") ?? "").trim();
  const { error } = await supabase
    .from("proc_app_settings")
    .upsert({ key: "gemini_model", value: value || null, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function setStorageProvider(provider: "supabase" | "google_drive") {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("proc_app_settings")
    .upsert({ key: "storage_provider", value: provider, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
