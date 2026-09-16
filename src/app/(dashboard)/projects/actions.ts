"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return supabase;
}

type ActivityRow = { name: string; budget: string; responsible: string[] };

export async function createProject(formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;
  const hasActivities = String(formData.get("has_activities") ?? "yes") !== "no";
  const directBudget = hasActivities ? 0 : Number(formData.get("project_budget") ?? 0);

  if (!name || !budget_year_id || !admin_group_id) return;

  const { data: project, error } = await supabase
    .from("plan_projects")
    .insert({ name, budget_year_id, admin_group_id, budget_source_id, budget: directBudget })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (hasActivities) {
    let activityRows: ActivityRow[] = [];
    try {
      activityRows = JSON.parse(String(formData.get("activities_json") ?? "[]"));
    } catch {
      activityRows = [];
    }

    const rowsToInsert = activityRows
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        project_id: project.id,
        name: a.name.trim(),
        budget: a.budget ? Number(a.budget) : 0,
        responsible: Array.isArray(a.responsible) ? a.responsible : [],
      }));

    if (rowsToInsert.length > 0) {
      const { error: activitiesError } = await supabase.from("plan_activities").insert(rowsToInsert);
      if (activitiesError) throw new Error(activitiesError.message);
    }
  }

  revalidatePath("/projects");
}

export async function updateProject(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget_year_id = String(formData.get("budget_year_id") ?? "");
  const admin_group_id = String(formData.get("admin_group_id") ?? "");
  const budget_source_id = String(formData.get("budget_source_id") ?? "") || null;

  if (!name || !budget_year_id || !admin_group_id) return;

  const { error } = await supabase
    .from("plan_projects")
    .update({ name, budget_year_id, admin_group_id, budget_source_id })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

// แก้ไขเฉพาะงบประมาณโครงการโดยตรง (ใช้เมื่อโครงการไม่มีกิจกรรมย่อย) — แยกออกมาจาก updateProject
// เพื่อให้หน้า "การจัดสรรเงิน" เรียกได้โดยไม่ต้องส่งข้อมูลฟิลด์อื่นของโครงการมาด้วย
export async function updateProjectBudget(projectId: string, budget: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_projects").update({ budget }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  revalidatePath("/fund-allocation");
}

// ตารางอื่นที่อ้างอิง plan_projects.id ด้วย FK แบบ NO ACTION (ห้ามลบถ้ายังมีแถวอ้างอิงอยู่) — เช็คก่อน
// ลบจริงแล้วโยน error ข้อความไทยที่บอกสาเหตุชัดเจน แทนปล่อยให้ Postgres โยน foreign key violation ดิบๆ
// ออกไป ซึ่งฝั่ง client แสดงเป็น "Minified React error" ที่อ่านไม่รู้เรื่อง
async function findProjectBlockingLabels(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const [purchaseRequests, contracts, approvals, allowanceDisbursements, projectDisbursements, projectReports] =
    await Promise.all([
      supabase.from("proc_purchase_requests").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("proc_contracts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("proc_approvals").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("proc_allowance_disbursements").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("proc_project_disbursements").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("proc_project_reports").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    ]);

  const labels: string[] = [];
  if ((purchaseRequests.count ?? 0) > 0) labels.push("ใบขอซื้อ/ขอจ้าง");
  if ((contracts.count ?? 0) > 0) labels.push("สัญญา");
  if ((approvals.count ?? 0) > 0) labels.push("บันทึกขออนุมัติ");
  if ((allowanceDisbursements.count ?? 0) > 0) labels.push("การเบิกค่าตอบแทน");
  if ((projectDisbursements.count ?? 0) > 0) labels.push("การเบิกจ่ายโครงการ");
  if ((projectReports.count ?? 0) > 0) labels.push("รายงานผลโครงการ");
  return labels;
}

// คืนค่า { error } แทนการ throw — ข้อความ error ที่ throw จาก Server Action ถูก Next.js ปิดบัง
// (redact) ในโปรดักชัน ฝั่ง client จะเห็นแค่ "Minified React error #441" อ่านไม่รู้เรื่อง แทนข้อความ
// จริงที่ตั้งใจให้ผู้ใช้เห็น (พิสูจน์แล้วจาก Vercel runtime logs — server throw ข้อความไทยถูกต้อง
// แต่ client ไม่เคยได้รับ) จึงต้องส่งข้อความ error กลับเป็นค่า return ปกติแทน
export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const supabase = await requireAdmin();

  const blockingLabels = await findProjectBlockingLabels(supabase, projectId);
  if (blockingLabels.length > 0) {
    return { error: `ลบไม่ได้ เพราะโครงการนี้มี${blockingLabels.join(", ")}อ้างอิงอยู่ กรุณาลบรายการที่เกี่ยวข้องก่อน` };
  }

  const { error } = await supabase.from("plan_projects").delete().eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/projects");
  return {};
}

export async function createActivity(projectId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  if (!name) return;

  const { error } = await supabase.from("plan_activities").insert({
    project_id: projectId,
    name,
    budget,
    responsible,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function updateActivity(activityId: string, formData: FormData) {
  const supabase = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const budget = Number(formData.get("budget") ?? 0);
  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  const { error } = await supabase
    .from("plan_activities")
    .update({ name, budget, responsible })
    .eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}

export async function deleteActivity(activityId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_activities").delete().eq("id", activityId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
}
