"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    redirect(`/login/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/");
  }

  redirect("/login?notice=" + encodeURIComponent("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"));
}
