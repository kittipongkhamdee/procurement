"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

// สิทธิ์บางตัวมี "สถานะผู้ใช้งาน" (ป้ายในกำหนดสถานะผู้ใช้งาน) ชื่อตรงกันที่ระบบใช้เป็นเงื่อนไขจริง
// (เช่นปุ่มอนุมัติ/เห็นชอบโครงการเช็คป้ายนี้ ดู requireAdminOrGroup ใน approvals/project-proposals)
// — ตั้ง role นี้แล้วติดป้ายชื่อเดียวกันให้อัตโนมัติ กันแอดมินลืมไปติดป้ายเพิ่มเองอีกจุด
const ROLE_DEFAULT_GROUP_LABEL: Partial<Record<Enums<"proc_user_role">, string>> = {
  director: "ผู้อำนวยการ",
  deputy_director: "รองผู้อำนวยการ",
};

export async function setUserRole(formData: FormData) {
  const supabase = await createClient();

  const targetUserId = String(formData.get("user_id") ?? "");
  const newRole = String(formData.get("role") ?? "") as Enums<"proc_user_role">;

  const { error } = await supabase.rpc("proc_admin_set_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });

  if (error) throw new Error(error.message);

  const groupLabel = ROLE_DEFAULT_GROUP_LABEL[newRole];
  if (groupLabel) {
    let { data: group } = await supabase.from("proc_user_groups").select("id").eq("name", groupLabel).maybeSingle();
    if (!group) {
      const { data: newGroup, error: groupError } = await supabase
        .from("proc_user_groups")
        .insert({ name: groupLabel })
        .select("id")
        .single();
      if (groupError) throw new Error(groupError.message);
      group = newGroup;
    }

    const { data: existingMembership } = await supabase
      .from("proc_user_group_members")
      .select("group_id")
      .eq("user_id", targetUserId)
      .eq("group_id", group.id)
      .maybeSingle();
    if (!existingMembership) {
      const { error: memberError } = await supabase
        .from("proc_user_group_members")
        .insert({ user_id: targetUserId, group_id: group.id });
      if (memberError) throw new Error(memberError.message);
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/settings");
}

export async function approveUser(userId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("proc_admin_approve_user", { target_user_id: userId });

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
