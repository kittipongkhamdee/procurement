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
  return parsed.filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
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

/** ฟิลด์ของรายงานที่ใช้ร่วมกันทั้งตอนสร้างใหม่และแก้ไข (ไม่รวม project_id/uploaded_by ซึ่งจัดการแยกต่างหาก) */
function reportFields(formData: FormData) {
  const notImplemented = formData.get("not_implemented") === "on";
  return {
    not_implemented: notImplemented,
    not_implemented_reason: notImplemented
      ? str(formData, "not_implemented_reason")
      : null,
    responsible_name: str(formData, "responsible_name"),
    period_start: str(formData, "period_start"),
    period_end: str(formData, "period_end"),
    location: str(formData, "location"),
    background: str(formData, "background"),
    objectives: listField(formData, "objectives_json"),
    activities_done: listField(formData, "activities_done_json"),
    indicator_results_quantity: indicatorResultsField(
      formData,
      "indicator_results_quantity_json",
    ),
    indicator_results_quality: indicatorResultsField(
      formData,
      "indicator_results_quality_json",
    ),
    satisfaction_percent: num(formData, "satisfaction_percent"),
    budget_approved: num(formData, "budget_approved"),
    budget_used: num(formData, "budget_used"),
    highlights: listField(formData, "highlights_json"),
    problems: listField(formData, "problems_json"),
    recommendations: listField(formData, "recommendations_json"),
    photo_refs: listField(formData, "photo_refs_json"),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return { supabase, user };
}

async function getRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role ?? null;
}

/** โครงการหนึ่งควรมีรายงานสรุปเดียว — กันไม่ให้เผลอบันทึกซ้ำ (excludeReportId ไว้ยกเว้นตัวเองตอนแก้ไข) */
async function assertNoDuplicateReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  excludeReportId?: string,
) {
  let query = supabase
    .from("proc_project_reports")
    .select("id")
    .eq("project_id", projectId);
  if (excludeReportId) query = query.neq("id", excludeReportId);
  const { data: existing } = await query.maybeSingle();
  if (existing)
    throw new Error(
      "โครงการนี้มีรายงานสรุปอยู่แล้ว กรุณาแก้ไขรายงานเดิมแทนการเพิ่มรายงานใหม่",
    );
}

export async function createProjectReport(formData: FormData) {
  const { supabase, user } = await requireUser();

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) throw new Error("กรุณาเลือกโครงการ");

  const notImplemented = formData.get("not_implemented") === "on";
  if (notImplemented && !str(formData, "not_implemented_reason")) {
    throw new Error("กรุณากรอกเหตุผลที่ไม่ได้ดำเนินการ");
  }

  await assertNoDuplicateReport(supabase, projectId);

  const { error } = await supabase.from("proc_project_reports").insert({
    project_id: projectId,
    uploaded_by: user.id,
    ...reportFields(formData),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/project-reports");
}

export async function updateProjectReport(id: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: report } = await supabase
    .from("proc_project_reports")
    .select("uploaded_by, photo_refs, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new Error("ไม่พบรายงานนี้");

  const role = await getRole(supabase, user.id);
  const isOwner = report.uploaded_by === user.id;
  if (role !== "admin" && !isOwner)
    throw new Error(
      "คุณไม่มีสิทธิ์แก้ไขรายงานนี้ ผู้ที่แก้ไขได้คือเจ้าของรายงานหรือผู้ดูแลระบบเท่านั้น",
    );

  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) throw new Error("กรุณาเลือกโครงการ");

  const notImplemented = formData.get("not_implemented") === "on";
  if (notImplemented && !str(formData, "not_implemented_reason")) {
    throw new Error("กรุณากรอกเหตุผลที่ไม่ได้ดำเนินการ");
  }

  if (projectId !== report.project_id) {
    await assertNoDuplicateReport(supabase, projectId, id);
  }

  const newPhotoRefs = listField(formData, "photo_refs_json");
  const oldPhotoRefs = (report.photo_refs as unknown as string[]) ?? [];
  const removedRefs = oldPhotoRefs.filter((r) => !newPhotoRefs.includes(r));

  const { error } = await supabase
    .from("proc_project_reports")
    .update({ project_id: projectId, ...reportFields(formData) })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // ลบเฉพาะรูปที่ถูกเอาออกจากรายงานจริงๆ ไม่แตะรูปที่ยังเก็บไว้
  await Promise.all(
    removedRefs.map((r) => deleteFromStorage(supabase, r, BUCKET)),
  );

  revalidatePath("/project-reports");
}

export async function extractBackgroundFromProposalFile(
  filePath: string,
): Promise<string> {
  const supabase = await createClient();
  return extractProjectBackgroundFromFile(supabase, filePath);
}

export async function deleteProjectReport(
  id: string,
  ref: string | null,
  photoRefs: string[],
) {
  const { supabase, user } = await requireUser();

  const { data: report } = await supabase
    .from("proc_project_reports")
    .select("uploaded_by")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new Error("ไม่พบรายงานนี้");

  const role = await getRole(supabase, user.id);
  if (role !== "admin" && report.uploaded_by !== user.id) {
    throw new Error(
      "คุณไม่มีสิทธิ์ลบรายงานนี้ ผู้ที่ลบได้คือเจ้าของรายงานหรือผู้ดูแลระบบเท่านั้น",
    );
  }

  await deleteFromStorage(supabase, ref, BUCKET);
  await Promise.all(
    photoRefs.map((r) => deleteFromStorage(supabase, r, BUCKET)),
  );
  const { error } = await supabase
    .from("proc_project_reports")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-reports");
}
