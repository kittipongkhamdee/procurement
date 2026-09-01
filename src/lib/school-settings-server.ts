import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCHOOL_SETTINGS, type SchoolSettings } from "@/lib/school-settings";

/** เวอร์ชัน Server Component ของ useSchoolSettings — ใช้ในหน้า login/สมัครสมาชิกที่เป็น
 * Server Component (await ได้ตรงๆ ไม่ต้องพึ่ง client-side fetch) */
export async function getSchoolSettings(): Promise<SchoolSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("proc_school_settings").select("school_name, logo_url").eq("id", true).maybeSingle();
  if (!data) return DEFAULT_SCHOOL_SETTINGS;
  return { schoolName: data.school_name, logoUrl: data.logo_url };
}
