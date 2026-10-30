// แอดมินบันทึกการเห็นชอบ/อนุมัติ "แทน" รองผู้อำนวยการ/ผู้อำนวยการ — ตัวช่วยฝั่งเซิร์ฟเวอร์ที่ใช้ร่วมกันทุกขั้นตอนอนุมัติในระบบ
// (บันทึกขออนุมัติ, ข้อเสนอโครงการ, สัญญายืมเงิน, ยืมเงินระหว่างประเภทเงิน ฯลฯ) — ฝั่งหน้าจอใช้ components/admin-proxy-panel.tsx
//
// หลักการ (ผู้ใช้กำหนด ต.ค. 2569): แอดมินกดแทนได้เมื่อท่านไม่สะดวกกดในระบบ และ "ข้ามขั้นตอนก่อนหน้าได้" แต่ต้องบันทึกให้ตรวจสอบย้อนหลังได้
//   - ชื่อผู้พิจารณา = ชื่อผู้ลงนามของตำแหน่งนั้นตามหน้าตั้งค่า (approval_signer_deputy / approval_signer_director)
//     ต่อท้ายด้วย "(แอดมิน <ชื่อแอดมิน> บันทึกแทน: <เหตุผล/ช่องทางที่ได้รับความเห็น>)" — ไม่ลงเป็นการกดของท่านเอง
//   - ทำได้เฉพาะแอดมินตัวจริง (ไม่นับแอดมินที่สลับไปทำงานในบทบาทอื่น)
// ขั้นตอนอนุมัติใหม่ในอนาคตต้องมีทางบันทึกแทนแบบนี้ด้วย (ดู CLAUDE.md)

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ProxyRole = "deputy" | "director";

const SIGNER_KEY: Record<ProxyRole, string> = { deputy: "approval_signer_deputy", director: "approval_signer_director" };
const ROLE_LABEL: Record<ProxyRole, string> = { deputy: "รองผู้อำนวยการ", director: "ผู้อำนวยการ" };

/** ต้องเป็นแอดมินตัวจริงที่ใช้บทบาทแอดมินอยู่ — คืนชื่อแอดมิน (ไว้ต่อท้ายข้อความ "บันทึกแทน") */
export async function requireProxyAdmin(supabase: Supabase): Promise<{ userId: string; adminName: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const { data: profile } = await supabase.from("proc_profiles").select("role, real_role, full_name").eq("user_id", user.id).maybeSingle();
  if ((profile?.real_role ?? profile?.role) !== "admin" || profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกแทนได้");
  return { userId: user.id, adminName: (profile?.full_name ?? user.email ?? "").trim() };
}

/** ชื่อที่จะบันทึกเป็นผู้พิจารณา: signer = ชื่อผู้ลงนามของตำแหน่ง, byName = signer + (แอดมิน … บันทึกแทน: เหตุผล) */
export async function proxyNames(supabase: Supabase, role: ProxyRole, adminName: string, reason?: string | null) {
  const { data } = await supabase.from("proc_app_settings").select("value").eq("key", SIGNER_KEY[role]).maybeSingle();
  const signer = data?.value?.trim() || ROLE_LABEL[role];
  const why = reason?.trim().slice(0, 120);
  return { signer, byName: `${signer} (แอดมิน ${adminName} บันทึกแทน${why ? `: ${why}` : ""})` };
}
