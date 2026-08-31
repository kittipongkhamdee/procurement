"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";

const BUCKET = "procurement-files";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function num(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : Number(v);
}

export async function createProjectReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) throw new Error("กรุณาเลือกโครงการ");

  const objectives = (String(formData.get("objectives_json") ?? "[]") &&
    JSON.parse(String(formData.get("objectives_json") ?? "[]"))) as string[];

  const { error } = await supabase.from("proc_project_reports").insert({
    project_id: projectId,
    uploaded_by: user?.id ?? null,
    responsible_name: str(formData, "responsible_name"),
    period_start: str(formData, "period_start"),
    period_end: str(formData, "period_end"),
    background: str(formData, "background"),
    objectives: objectives.filter((o) => o.trim() !== ""),
    quantity_goal: str(formData, "quantity_goal"),
    quantity_actual: str(formData, "quantity_actual"),
    quality_result: str(formData, "quality_result"),
    satisfaction_percent: num(formData, "satisfaction_percent"),
    budget_approved: num(formData, "budget_approved"),
    budget_used: num(formData, "budget_used"),
    highlights: str(formData, "highlights"),
    problems: str(formData, "problems"),
    recommendations: str(formData, "recommendations"),
    reporter_name: str(formData, "reporter_name"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/project-reports");
}

export async function deleteProjectReport(id: string, ref: string | null) {
  const supabase = await createClient();
  await deleteFromStorage(supabase, ref, BUCKET);
  const { error } = await supabase.from("proc_project_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-reports");
}
