import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { downloadFromStorage } from "@/lib/storage";
import { computeStats } from "@/app/(dashboard)/evaluations/stats";
import { interpretScore, type Criterion } from "@/app/(dashboard)/evaluations/interpret";
import { ProjectReportDocument, type ProjectReportPdfData } from "./project-report-document";

const BUCKET = "procurement-files";

/** เดารูปแบบไฟล์จากนามสกุล — Google Drive ref ไม่มีนามสกุลแนบมา จึงถือว่าเป็น jpg (นามสกุลที่ react-pdf รองรับ) เป็นค่าเริ่มต้น */
function inferImageFormat(ref: string): "png" | "jpg" {
  const ext = ref.split(".").pop()?.toLowerCase();
  return ext === "png" ? "png" : "jpg";
}

/** คำนวณสดจากคำตอบแบบ Likert ของแบบประเมินออนไลน์ที่ผูกกับโครงการ (ตัวเดียวกับปุ่ม "ดึงจากแบบ
 * ประเมินออนไลน์" ในฟอร์ม) — ไม่ได้เก็บค่านี้ไว้ในฐานข้อมูล คำนวณใหม่ทุกครั้งที่สร้างรายงาน จึงอาจ
 * ไม่ตรงกับ satisfaction_percent เป๊ะๆ ถ้าครูแก้ตัวเลขร้อยละเองหลังดึงมาแล้ว */
async function loadSatisfactionSurveySummary(
  supabase: SupabaseClient<Database>,
  projectId: string | null,
): Promise<ProjectReportPdfData["satisfaction_survey_summary"]> {
  if (!projectId) return null;
  const { data: forms } = await supabase
    .from("eval_forms")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_template", false);
  const formIds = (forms ?? []).map((f) => f.id);
  if (formIds.length === 0) return null;

  const { data: questions } = await supabase
    .from("eval_questions")
    .select("id")
    .in("form_id", formIds)
    .eq("question_type", "likert");
  const questionIds = (questions ?? []).map((q) => q.id);
  if (questionIds.length === 0) return null;

  const [{ data: answers }, { data: criteriaRows }] = await Promise.all([
    supabase.from("eval_answers").select("answer_value").in("question_id", questionIds),
    supabase.from("eval_criteria").select("min_score, max_score, label").in("form_id", formIds),
  ]);
  const values = (answers ?? []).map((a) => Number(a.answer_value)).filter((n) => !Number.isNaN(n));
  if (values.length === 0) return null;

  const { avg, sd } = computeStats(values);
  const label = interpretScore(avg, (criteriaRows ?? []) as Criterion[]);
  return { avg, sd, count: values.length, label };
}

export async function buildProjectReportPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ProjectReportPdfData; fileLabel: string } | null> {
  const { data: r, error } = await supabase
    .from("proc_project_reports")
    .select(
      "project_id, not_implemented, not_implemented_reason, responsible_name, period_start, period_end, location, background, objectives, activities_done, indicator_results_quantity, indicator_results_quality, satisfaction_percent, budget_approved, budget_used, highlights, problems, recommendations, photo_refs, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !r) return null;

  const project = r.plan_projects as unknown as { name: string } | null;
  const photoRefs = ((r.photo_refs as unknown as string[]) ?? []).slice(0, 4);
  const [photos, proposal, satisfactionSurveySummary] = await Promise.all([
    Promise.all(
      photoRefs.map(async (ref) => ({
        data: await downloadFromStorage(supabase, ref, BUCKET),
        format: inferImageFormat(ref),
      })),
    ),
    r.project_id
      ? supabase
          .from("plan_project_proposals")
          .select("strategy_alignment, standard")
          .eq("project_id", r.project_id)
          .maybeSingle()
          .then((res) => res.data)
      : Promise.resolve(null),
    loadSatisfactionSurveySummary(supabase, r.project_id),
  ]);

  const data: ProjectReportPdfData = {
    project_name: project?.name ?? null,
    strategy_alignment: proposal?.strategy_alignment ?? null,
    standard: proposal?.standard ?? null,
    not_implemented: r.not_implemented,
    not_implemented_reason: r.not_implemented_reason,
    responsible_name: r.responsible_name,
    period_start: r.period_start,
    period_end: r.period_end,
    location: r.location,
    background: r.background,
    objectives: (r.objectives as unknown as string[]) ?? [],
    activities_done: (r.activities_done as unknown as string[]) ?? [],
    indicator_results_quantity:
      (r.indicator_results_quantity as unknown as { indicator: string; target: string; actual: string }[]) ?? [],
    indicator_results_quality:
      (r.indicator_results_quality as unknown as { indicator: string; target: string; actual: string }[]) ?? [],
    satisfaction_percent: r.satisfaction_percent,
    satisfaction_survey_summary: satisfactionSurveySummary,
    budget_approved: r.budget_approved,
    budget_used: r.budget_used,
    highlights: (r.highlights as unknown as string[]) ?? [],
    problems: (r.problems as unknown as string[]) ?? [],
    recommendations: (r.recommendations as unknown as string[]) ?? [],
    photos,
  };

  return { data, fileLabel: `รายงานโครงการ-${project?.name ?? id}` };
}

export async function renderProjectReportPdfBuffer(data: ProjectReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ProjectReportDocument data={data} />);
}
