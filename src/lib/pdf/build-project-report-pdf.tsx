import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { ProjectReportDocument, type ProjectReportPdfData } from "./project-report-document";

export async function buildProjectReportPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ProjectReportPdfData; fileLabel: string } | null> {
  const { data: r, error } = await supabase
    .from("proc_project_reports")
    .select(
      "responsible_name, period_start, period_end, background, objectives, quantity_goal, quantity_actual, quality_result, satisfaction_percent, budget_approved, budget_used, highlights, problems, recommendations, reporter_name, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !r) return null;

  const project = r.plan_projects as unknown as { name: string } | null;

  const data: ProjectReportPdfData = {
    project_name: project?.name ?? null,
    responsible_name: r.responsible_name,
    period_start: r.period_start,
    period_end: r.period_end,
    background: r.background,
    objectives: (r.objectives as unknown as string[]) ?? [],
    quantity_goal: r.quantity_goal,
    quantity_actual: r.quantity_actual,
    quality_result: r.quality_result,
    satisfaction_percent: r.satisfaction_percent,
    budget_approved: r.budget_approved,
    budget_used: r.budget_used,
    highlights: r.highlights,
    problems: r.problems,
    recommendations: r.recommendations,
    reporter_name: r.reporter_name,
  };

  return { data, fileLabel: `รายงานโครงการ-${project?.name ?? id}` };
}

export async function renderProjectReportPdfBuffer(data: ProjectReportPdfData): Promise<Buffer> {
  return renderToBuffer(<ProjectReportDocument data={data} />);
}
