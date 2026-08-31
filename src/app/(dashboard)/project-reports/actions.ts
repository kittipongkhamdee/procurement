"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";
import { extractProjectBackgroundFromFile } from "@/lib/ai/extract-proposal";

const BUCKET = "procurement-files";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

function num(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "").trim();
  return v === "" ? null : Number(v);
}

function listField(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function indicatorResultsField(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (r): r is { indicator: string; target: string; actual: string } =>
      r && typeof r.indicator === "string" && r.indicator.trim() !== "",
  );
}

export async function createProjectReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) throw new Error("กรุณาเลือกโครงการ");

  const { error } = await supabase.from("proc_project_reports").insert({
    project_id: projectId,
    uploaded_by: user?.id ?? null,
    responsible_name: str(formData, "responsible_name"),
    period_start: str(formData, "period_start"),
    period_end: str(formData, "period_end"),
    location: str(formData, "location"),
    background: str(formData, "background"),
    objectives: listField(formData, "objectives_json"),
    activities_done: listField(formData, "activities_done_json"),
    indicator_results_quantity: indicatorResultsField(formData, "indicator_results_quantity_json"),
    indicator_results_quality: indicatorResultsField(formData, "indicator_results_quality_json"),
    satisfaction_percent: num(formData, "satisfaction_percent"),
    budget_approved: num(formData, "budget_approved"),
    budget_used: num(formData, "budget_used"),
    highlights: listField(formData, "highlights_json"),
    problems: listField(formData, "problems_json"),
    recommendations: listField(formData, "recommendations_json"),
    photo_refs: listField(formData, "photo_refs_json"),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/project-reports");
}

export async function extractBackgroundFromProposalFile(filePath: string): Promise<string> {
  const supabase = await createClient();
  return extractProjectBackgroundFromFile(supabase, filePath);
}

export async function deleteProjectReport(id: string, ref: string | null, photoRefs: string[]) {
  const supabase = await createClient();
  await deleteFromStorage(supabase, ref, BUCKET);
  await Promise.all(photoRefs.map((r) => deleteFromStorage(supabase, r, BUCKET)));
  const { error } = await supabase.from("proc_project_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-reports");
}
