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

export async function createStandard(formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_standards").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/standards");
}

export async function updateStandardName(id: string, formData: FormData) {
  const supabase = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("plan_standards").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/standards");
}

export async function toggleStandardActive(id: string, isActive: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_standards").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/standards");
}

export async function deleteStandard(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_standards").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/standards");
}
