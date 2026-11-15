// รับผลกลับจาก Google (OAuth) — แลก code เป็น session แล้วพาเข้าระบบ
// - เข้าสู่ระบบด้วย Google: ต้องเป็นบัญชีที่ "ผูก" กับผู้ใช้ในระบบแล้วเท่านั้น (มีตัวตนแบบอีเมล/รหัสผ่านอยู่ด้วย)
//   บัญชี Google ล้วนที่ไม่เคยผูก (Supabase สร้างผู้ใช้ใหม่ให้) จะถูกออกจากระบบทันที พร้อมบอกวิธีผูก
// - ผูกบัญชีจากหน้าโปรไฟล์ (next=/profile...): ผู้ใช้ล็อกอินอยู่แล้ว ผลคือเพิ่มตัวตน Google เข้าบัญชีเดิม
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function loginError(origin: string, message: string) {
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/?welcome=1";
  // กัน open redirect: อนุญาตเฉพาะเส้นทางภายในเว็บ
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) {
    return next.startsWith("/profile")
      ? NextResponse.redirect(`${origin}/profile?google_error=${encodeURIComponent(oauthError)}`)
      : loginError(origin, `เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${oauthError}`);
  }
  if (!code) return loginError(origin, "ไม่พบข้อมูลยืนยันตัวตนจาก Google กรุณาลองใหม่");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return next.startsWith("/profile")
      ? NextResponse.redirect(`${origin}/profile?google_error=${encodeURIComponent(error?.message ?? "ผูกบัญชีไม่สำเร็จ")}`)
      : loginError(origin, "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่");
  }

  const identities = data.user.identities ?? [];
  const hasPasswordIdentity = identities.some((i) => i.provider === "email");
  if (!hasPasswordIdentity) {
    await supabase.auth.signOut();
    return loginError(
      origin,
      "บัญชี Google นี้ยังไม่ได้ผูกกับผู้ใช้ในระบบ — เข้าสู่ระบบด้วยอีเมล/รหัสผ่านก่อน แล้วไปที่ \"โปรไฟล์ของฉัน\" เพื่อผูกบัญชี Google",
    );
  }

  if (!next.startsWith("/profile")) {
    await supabase.rpc("proc_log_activity", { p_action: "login", p_entity: "ระบบ", p_summary: "เข้าสู่ระบบด้วย Google" }).then(undefined, () => undefined);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
