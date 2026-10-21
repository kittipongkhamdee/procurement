// การใช้งบโครงการ — นิยามเดียวใช้ทุกหน้า (เมนูโครงการ / บัญชีรับ-จ่ายเงิน > งบโครงการ / แดชบอร์ด)
// - งบประมาณ = ผลรวมงบกิจกรรม (ไม่มีกิจกรรม = งบของโครงการ)
// - อนุมัติแล้ว = บันทึกขออนุมัติที่ ผอ. อนุมัติ (proc_approvals.status = "อนุมัติ", requested_amount)
// - จ่ายจริง = รายการจ่ายในบัญชีรับ-จ่ายเงินที่ผูกโครงการ (fin_transactions kind = "pay")
// - คงเหลือ = งบประมาณ − อนุมัติแล้ว

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type Spending = { approved: number; paid: number };

export function projectBudget(projectBudget: number | null | undefined, activities: { budget: number | null }[] | null | undefined) {
  const acts = activities ?? [];
  return acts.length > 0 ? acts.reduce((s, a) => s + Number(a.budget ?? 0), 0) : Number(projectBudget ?? 0);
}

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").replace(/^กิจกรรม\s*/, "");

/** อนุมัติแล้ว/จ่ายจริง แยกโครงการ และแยกกิจกรรม (อนุมัติจับคู่ด้วยชื่อกิจกรรม เพราะบันทึกขออนุมัติเก็บชื่อ ไม่ได้เก็บ id) */
export async function loadProjectSpending(supabase: SupabaseClient<Database>, projectIds: string[]) {
  const byProject = new Map<string, Spending>();
  const byActivityName = new Map<string, number>(); // key = `${projectId}|${ชื่อกิจกรรม}`
  const paidByActivity = new Map<string, number>();
  if (projectIds.length === 0) return { byProject, approvedForActivity: () => 0, paidByActivity };
  const [{ data: approvals }, { data: pays }] = await Promise.all([
    supabase.from("proc_approvals").select("project_id, activity_name, requested_amount").eq("status", "อนุมัติ").in("project_id", projectIds),
    supabase.from("fin_transactions").select("project_id, activity_id, amount").eq("kind", "pay").in("project_id", projectIds),
  ]);
  const get = (id: string) => byProject.get(id) ?? (byProject.set(id, { approved: 0, paid: 0 }), byProject.get(id)!);
  for (const a of approvals ?? []) {
    if (!a.project_id) continue;
    const amt = Number(a.requested_amount ?? 0);
    get(a.project_id).approved += amt;
    const key = `${a.project_id}|${norm(a.activity_name)}`;
    byActivityName.set(key, (byActivityName.get(key) ?? 0) + amt);
  }
  for (const p of pays ?? []) {
    if (!p.project_id) continue;
    const amt = Number(p.amount ?? 0);
    get(p.project_id).paid += amt;
    if (p.activity_id) paidByActivity.set(p.activity_id, (paidByActivity.get(p.activity_id) ?? 0) + amt);
  }
  return {
    byProject,
    approvedForActivity: (projectId: string, activityName: string) => byActivityName.get(`${projectId}|${norm(activityName)}`) ?? 0,
    paidByActivity,
  };
}
