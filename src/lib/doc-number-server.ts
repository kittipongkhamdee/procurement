// ออกเลขที่เอกสารงานพัสดุฝั่งเซิร์ฟเวอร์ — เลขที่ขึ้นอัตโนมัติตอนบันทึก ผู้ใช้ทั่วไปกรอก/แก้เองไม่ได้ (แก้ได้เฉพาะแอดมิน)
import type { createClient } from "@/lib/supabase/server";
import { DOC_NUMBER_KINDS, docNumberTemplate, nextDocNumber, type DocNumberKind } from "@/lib/doc-numbers";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function isAdminUser(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("proc_profiles").select("role").eq("user_id", user.id).maybeSingle();
  return data?.role === "admin";
}

/** ปีงบประมาณ พ.ศ. ของวันที่ ISO (ต.ค. ขึ้นปีงบใหม่) */
function fiscalYearOf(iso: string) {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

async function existingNumbers(supabase: Supabase, kind: DocNumberKind): Promise<string[]> {
  const rows =
    kind === "purchase" || kind === "hire"
      ? (await supabase.from("proc_purchase_requests").select("doc_no").eq("doc_type", kind === "hire" ? "จ้าง" : "ซื้อ")).data
      : kind === "w119"
        ? (await supabase.from("proc_w119_reports").select("doc_no")).data
        : (await supabase.from("proc_expense_claims").select("doc_no")).data;
  return (rows ?? []).map((r) => r.doc_no ?? "").filter(Boolean);
}

/** เลขที่ถัดไปตามรูปแบบที่ตั้งไว้ (null = รูปแบบว่าง ไม่ออกเลขอัตโนมัติ) */
export async function assignDocNumber(supabase: Supabase, kind: DocNumberKind, recordDate: string): Promise<string | null> {
  const { data } = await supabase.from("proc_app_settings").select("key, value").in("key", DOC_NUMBER_KINDS.map((k) => k.key));
  const template = docNumberTemplate(kind, Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])));
  const next = nextDocNumber(template, fiscalYearOf(recordDate), await existingNumbers(supabase, kind));
  return next || null;
}

/** เลขที่ซ้ำกับรายการอื่นของประเภทเดียวกันหรือไม่ (ใช้ตอนแอดมินแก้เลขเอง) */
export async function docNumberTaken(supabase: Supabase, kind: DocNumberKind, docNo: string, excludeId?: string) {
  const { data } =
    kind === "purchase" || kind === "hire"
      ? await supabase.from("proc_purchase_requests").select("id").eq("doc_no", docNo).eq("doc_type", kind === "hire" ? "จ้าง" : "ซื้อ").neq("id", excludeId ?? "00000000-0000-0000-0000-000000000000").limit(1)
      : kind === "w119"
        ? await supabase.from("proc_w119_reports").select("id").eq("doc_no", docNo).neq("id", excludeId ?? "00000000-0000-0000-0000-000000000000").limit(1)
        : await supabase.from("proc_expense_claims").select("id").eq("doc_no", docNo).neq("id", excludeId ?? "00000000-0000-0000-0000-000000000000").limit(1);
  return (data?.length ?? 0) > 0;
}
