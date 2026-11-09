// แหล่งเงินของกิจกรรมที่แบ่งหลายแหล่ง + ยอดที่ตัดไปแล้วจากบันทึกขออนุมัติที่ ผอ. อนุมัติ (proc_approval_sources)
// ใช้ในฟอร์มบันทึกขออนุมัติ (แสดงยอดคงเหลือของแต่ละแหล่ง) และหน้าโครงการ (ยอดใช้ไป/คงเหลือแยกแหล่ง)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ActivitySourcePlan = { sourceId: string; name: string; allocated: number; used: number };

export const normActivityName = (s: string | null | undefined) =>
  (s ?? "").trim().replace(/\s+/g, " ").replace(/^กิจกรรม\s*/, "");

export async function loadActivitySourcePlans(
  supabase: SupabaseClient<Database>,
  activities: { id: string; project_id: string; name: string | null }[],
): Promise<Map<string, ActivitySourcePlan[]>> {
  const result = new Map<string, ActivitySourcePlan[]>();
  if (activities.length === 0) return result;
  const projectIds = [...new Set(activities.map((a) => a.project_id))];
  const [{ data: splits }, { data: usage }] = await Promise.all([
    supabase
      .from("plan_activity_sources")
      .select("activity_id, budget_source_id, amount, sort_order, plan_budget_sources(name)")
      .in("activity_id", activities.map((a) => a.id)),
    supabase
      .from("proc_approval_sources")
      .select("budget_source_id, amount, proc_approvals!inner(project_id, activity_name, status)")
      .eq("proc_approvals.status", "อนุมัติ")
      .in("proc_approvals.project_id", projectIds),
  ]);
  const used = new Map<string, number>(); // `${projectId}|${ชื่อกิจกรรม}|${sourceId}`
  for (const u of usage ?? []) {
    const ap = u.proc_approvals as unknown as { project_id: string | null; activity_name: string | null } | null;
    if (!ap?.project_id) continue;
    const key = `${ap.project_id}|${normActivityName(ap.activity_name)}|${u.budget_source_id}`;
    used.set(key, (used.get(key) ?? 0) + Number(u.amount ?? 0));
  }
  const byActivity = new Map<string, typeof splits>();
  for (const sp of splits ?? []) {
    const list = byActivity.get(sp.activity_id) ?? [];
    list.push(sp);
    byActivity.set(sp.activity_id, list);
  }
  for (const a of activities) {
    const list = [...(byActivity.get(a.id) ?? [])].sort((x, y) => x.sort_order - y.sort_order);
    if (list.length === 0) continue;
    result.set(
      a.id,
      list.map((sp) => ({
        sourceId: sp.budget_source_id,
        name: (sp.plan_budget_sources as unknown as { name: string } | null)?.name ?? "แหล่งเงิน",
        allocated: Number(sp.amount ?? 0),
        used: used.get(`${a.project_id}|${normActivityName(a.name)}|${sp.budget_source_id}`) ?? 0,
      })),
    );
  }
  return result;
}
