"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export async function setUserRole(formData: FormData) {
  const supabase = await createClient();

  const targetUserId = String(formData.get("user_id") ?? "");
  const newRole = String(formData.get("role") ?? "") as Enums<"proc_user_role">;

  const { error } = await supabase.rpc("proc_admin_set_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

export async function updateUserFullName(userId: string, formData: FormData) {
  const supabase = await createClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return;

  const { error } = await supabase.from("proc_profiles").update({ full_name: fullName }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath("/project-proposals");
}
