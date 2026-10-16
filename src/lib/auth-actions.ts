"use server";

// ดึงข้อมูลผู้ใช้ปัจจุบัน (ชื่อ + สิทธิ์) ผ่าน server action — ใช้เส้นทางเดิมที่ใช้อยู่ทั่วระบบ
// (cookie -> server supabase client -> proc_profiles) ไม่พึ่งการอ่าน session ฝั่ง browser
// เพราะการล็อกอินของระบบนี้ทำผ่าน server action ฝั่งเซิร์ฟเวอร์ทั้งหมด browser client จึงไม่เคย
// รับรู้การล็อกอินและอ่าน session เองไม่ได้

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  userId: string;
  displayName: string;
  role: string;
  /** บทบาทจริง ('admin' ขณะแอดมินสลับไปทำงานในบทบาทอื่น) */
  realRole: string;
  status: string;
  avatarUrl: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("full_name, role, real_role, status, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    displayName: profile?.full_name || user.email || "",
    role: profile?.role ?? "",
    realRole: profile?.real_role ?? profile?.role ?? "",
    status: profile?.status ?? "approved",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/** แอดมินสลับไปทำงานในบทบาทอื่น (null = กลับเป็นผู้ดูแลระบบ) — สิทธิ์ทั้งระบบ (RLS) เปลี่ยนตามบทบาทที่สลับทันที */
export async function setActingRole(role: string | null): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("proc_set_acting_role", { new_role: role });
  return error ? { error: error.message } : {};
}
