import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { downloadFromStorage } from "@/lib/storage";
import { ProjectReportDocument, type ProjectReportPdfData, type ProjectReportPhoto } from "./project-report-document";

const BUCKET = "procurement-files";

/** เดารูปแบบไฟล์จากนามสกุล — Google Drive ref ไม่มีนามสกุลแนบมา จึงถือว่าเป็น jpg (นามสกุลที่ react-pdf รองรับ) เป็นค่าเริ่มต้น */
function inferImageFormat(ref: string): "png" | "jpg" {
  const ext = ref.split(".").pop()?.toLowerCase();
  return ext === "png" ? "png" : "jpg";
}

export async function buildProjectReportPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ProjectReportPdfData; fileLabel: string } | null> {
  const { data: r, error } = await supabase
    .from("proc_project_reports")
    .select(
      "responsible_name, period_start, period_end, location, background, objectives, activities_done, quantity_goal, quantity_actual, quality_result, satisfaction_percent, budget_approved, budget_used, highlights, problems, recommendations, photo_refs, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !r) return null;

  const project = r.plan_projects as unknown as { name: string } | null;
  const photoRefs = ((r.photo_refs as unknown as string[]) ?? []).slice(0, 4);
  const photos: ProjectReportPhoto[] = await Promise.all(
    photoRefs.map(async (ref) => ({
      data: await downloadFromStorage(supabase, ref, BUCKET),
      format: inferImageFormat(ref),
    })),
  );

  const data: ProjectReportPdfData = {
    project_name: project?.name ?? null,
    responsible_name: r.responsible_name,
    period_start: r.period_start,
    period_end: r.period_end,
    location: r.location,
    background: r.background,
    objectives: (r.objectives as unknown as string[]) ?? [],
    activities_done: (r.activities_done as unknown as string[]) ?? [],
    quantity_goal: r.quantity_goal,
    quantity_actual: r.quantity_actual,
    quality_result: r.quality_result,
    satisfaction_percent: r.satisfaction_percent,
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
