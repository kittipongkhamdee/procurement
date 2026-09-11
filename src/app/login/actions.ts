"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// แปลข้อความ error จาก Supabase Auth (ภาษาอังกฤษ) เป็นภาษาไทย เพื่อแสดงในป๊อปอัปฝั่งหน้า login
function translateAuthError(message: string) {
  if (message.includes("Invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (message.includes("Email not confirmed")) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
  if (message.includes("Too many requests")) return "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง";
  return message;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  // รองผู้อำนวยการ/ผู้อำนวยการ เข้าสู่ระบบแล้วพาไปหน้า "ผู้บริหาร" เป็นหน้าแรกแทนแดชบอร์ด เพราะเป็น
  // หน้าที่รวมรายการรอดำเนินการที่เกี่ยวข้องกับบทบาทนี้โดยตรง (แอดมินยังเข้าแดชบอร์ดตามเดิม เพราะ
  // แอดมินใช้งานหลายเมนูไม่ได้ผูกกับบทบาทเดียว)
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", data.user!.id)
    .maybeSingle();

  if (profile?.role === "deputy_director" || profile?.role === "director") {
    redirect("/executive");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
