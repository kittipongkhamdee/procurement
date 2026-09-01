"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { testStorageConnection } from "@/lib/storage";

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

export async function setAiExtractionEnabled(enabled: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("proc_app_settings")
    .upsert({ key: "ai_extraction_enabled", value: enabled ? "true" : "false", updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/project-proposals");
}

export async function setStorageProvider(provider: "supabase" | "google_drive") {
  const supabase = await requireAdmin();
  await testStorageConnection(supabase, provider, "procurement-files");
  const { error } = await supabase
    .from("proc_app_settings")
    .upsert({ key: "storage_provider", value: provider, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

// ชื่อโรงเรียน + โลโก้ — ใช้แทนค่า hardcode เดิม ("โรงเรียนตาเบาวิทยา" / วงกลม "ตว") ทั่วทั้งระบบ
// (แถบเมนู, หน้า login, หน้าทำแบบประเมินสาธารณะ) เก็บในตาราง proc_school_settings แถวเดียว
// อ่านได้แบบ public เพราะต้องแสดงบนหน้าที่ไม่ต้องล็อกอินด้วย ส่วนโลโก้อัปโหลดขึ้น bucket
// procurement-branding ที่เป็น public bucket แยกต่างหาก (ไม่ใช่ bucket เอกสารเดิมที่เป็น private)
export async function setSchoolName(formData: FormData) {
  const supabase = await requireAdmin();
  const schoolName = String(formData.get("school_name") ?? "").trim();
  if (!schoolName) throw new Error("กรุณาระบุชื่อโรงเรียน");
  const { error } = await supabase
    .from("proc_school_settings")
    .update({ school_name: schoolName, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function uploadSchoolLogo(formData: FormData) {
  const supabase = await requireAdmin();
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์โลโก้");

  const ext = file.name.split(".").pop();
  // ใช้ path คงที่ (ไม่สุ่ม) แล้วอัปโหลดแบบ upsert เพื่อให้ URL เดิมใช้ต่อได้เรื่อยๆ ไม่ต้องอัปเดต
  // logo_url ทุกครั้งที่เปลี่ยนโลโก้ — เติม query string กันแคชเบราว์เซอร์ค้างรูปเก่า
  const path = `logo${ext ? `.${ext}` : ""}`;
  const { error: uploadError } = await supabase.storage
    .from("procurement-branding")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("procurement-branding").getPublicUrl(path);
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("proc_school_settings")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
