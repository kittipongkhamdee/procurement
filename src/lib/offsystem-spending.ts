// รายการตัดงบที่ทำนอกระบบ (เอกสารกระดาษ) — เจ้าหน้าที่บันทึกเป็นข้อมูล นับรวมเป็น "ใช้ไปแล้ว" ของโครงการ/กิจกรรม/แหล่งเงิน
// ร่วมกับบันทึกขออนุมัติที่ ผอ. อนุมัติในระบบ (ตาราง proc_offsystem_spending + proc_offsystem_spending_sources)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const OFFSYSTEM_CATEGORIES = ["ค่าเดินทาง", "ค่าสาธารณูปโภค", "อื่นๆ"] as const;

export type OffsystemRow = {
  id: string;
  project_id: string;
  activity_id: string | null;
  activity_name: string | null;
  amount: number;
  sources: { sourceId: string; amount: number }[];
};

/** รายการนอกระบบ (ทั้งหมดหรือเฉพาะโครงการที่ส่งมา) พร้อมยอดแยกแหล่งเงิน — ไม่มีการแบ่งแหล่งถือว่าใช้แหล่งงบของโครงการ (sources ว่าง) */
export async function loadOffsystemRows(supabase: SupabaseClient<Database>, projectIds?: string[]): Promise<OffsystemRow[]> {
  let q = supabase
    .from("proc_offsystem_spending")
    .select("id, project_id, activity_id, activity_name, amount, proc_offsystem_spending_sources(budget_source_id, amount, sort_order)");
  if (projectIds) {
    if (projectIds.length === 0) return [];
    q = q.in("project_id", projectIds);
  }
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    activity_id: r.activity_id,
    activity_name: r.activity_name,
    amount: Number(r.amount ?? 0),
    sources: [...((r.proc_offsystem_spending_sources as unknown as { budget_source_id: string; amount: number; sort_order: number }[]) ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((x) => ({ sourceId: x.budget_source_id, amount: Number(x.amount ?? 0) })),
  }));
}
