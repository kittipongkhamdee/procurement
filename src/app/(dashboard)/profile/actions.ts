"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return { supabase, user };
}

// อัปโหลดรูปประจำตัว — ใช้ path คงที่ <user_id>.<ext> แบบเดียวกับโลโก้โรงเรียน (upsert ทับของเดิม
// เสมอ) เติม query string กันแคชเบราว์เซอร์ค้างรูปเก่า ฝั่งหน้าเว็บย่อรูปเป็น thumbnail เล็กแล้วจึง
// ค่อยส่งมาที่นี่ (ดู resizeAvatarFile ใน lib/image-resize.ts)
export async function uploadAvatar(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์รูปภาพ");

  const ext = file.name.split(".").pop();
  const path = `${user.id}${ext ? `.${ext}` : ""}`;
  const { error: uploadError } = await supabase.storage
    .from("procurement-avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("procurement-avatars").getPublicUrl(path);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error } = await supabase
    .from("proc_profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
  return avatarUrl;
}

export async function removeAvatar() {
  const { supabase, user } = await requireUser();

  const { data: files } = await supabase.storage.from("procurement-avatars").list();
  const ownFiles = (files ?? []).filter((f) => f.name.startsWith(user.id)).map((f) => f.name);
  if (ownFiles.length > 0) {
    await supabase.storage.from("procurement-avatars").remove(ownFiles);
  }

  const { error } = await supabase
    .from("proc_profiles")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/profile");
}

export async function changePassword(formData: FormData) {
  const { supabase } = await requireUser();
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (newPassword.length < 6) throw new Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
  if (newPassword !== confirmPassword) throw new Error("รหัสผ่านใหม่และรหัสยืนยันไม่ตรงกัน");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
