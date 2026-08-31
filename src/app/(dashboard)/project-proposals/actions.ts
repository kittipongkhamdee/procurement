"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractProposalFromFile } from "@/lib/ai/extract-proposal";
import { deleteFromStorage, renameStorageFile } from "@/lib/storage";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return supabase;
}

/** อนุญาตให้ผู้ดูแลระบบ หรือผู้ที่มีสถานะผู้ใช้งานตามชื่อที่ระบุ (เช่น "รองผู้อำนวยการ") ทำรายการได้ */
async function requireAdminOrGroup(groupName: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") return { supabase, signerName: profile.full_name ?? user.email ?? "" };

  const { data: membership } = await supabase
    .from("proc_user_group_members")
    .select("group_id, proc_user_groups!inner(name)")
    .eq("user_id", user.id)
    .eq("proc_user_groups.name", groupName)
    .maybeSingle();
  if (!membership) throw new Error(`เฉพาะผู้ดูแลระบบหรือผู้มีสถานะ "${groupName}" เท่านั้น`);
  return { supabase, signerName: profile?.full_name ?? user.email ?? "" };
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

type ActivityRow = {
  name: string;
  responsible: string[];
  budget: string;
};

const PROPOSAL_FILES_BUCKET = "procurement-files";

function indicatorsField(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (r): r is { indicator: string; target: string } =>
      r && typeof r.indicator === "string" && r.indicator.trim() !== "",
  );
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

function sanitizeFileNamePart(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, " ").trim();
}

/** ตั้งชื่อไฟล์ที่อัปโหลดไว้ (ชื่อสุ่ม) ใหม่เป็น "ชื่อโครงการ_ปีงบประมาณ" ถ้าตั้งชื่อไม่สำเร็จ (เช่น ชื่อซ้ำ) จะคงชื่อเดิมไว้ */
async function renameProposalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ref: string | null,
  baseName: string,
) {
  return renameStorageFile(supabase, ref, PROPOSAL_FILES_BUCKET, "project-proposals", baseName);
}

/** เทียบไฟล์เดิมกับค่าที่ส่งมาจากฟอร์มแก้ไข: ถ้าไม่เปลี่ยนก็คงเดิม ถ้าเปลี่ยน/ลบ จะลบไฟล์เก่าออกจาก storage แล้วตั้งชื่อไฟล์ใหม่ (ถ้ามี) */
async function replaceProposalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  existingRef: string | null,
  newRawRef: string | null,
  baseName: string,
) {
  if (newRawRef === existingRef) return existingRef;
  if (existingRef) await deleteFromStorage(supabase, existingRef, PROPOSAL_FILES_BUCKET);
  if (!newRawRef) return null;
  return renameProposalFile(supabase, newRawRef, baseName);
}

/** อนุญาตเฉพาะผู้ดูแลระบบหรือเจ้าของโครงการ และเฉพาะขณะสถานะ "รอเห็นชอบ" เท่านั้น */
async function requireEditableProposal(id: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  const { data: proposal } = await supabase
    .from("plan_project_proposals")
    .select("created_by, status, budget_year_id, file_url_word, file_url_pdf")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) throw new Error("ไม่พบข้อเสนอโครงการ");
  if (!isAdmin && proposal.created_by !== user.id) throw new Error("ไม่มีสิทธิ์ทำรายการนี้");
  if (proposal.status !== "รอเห็นชอบ") throw new Error('ทำรายการได้เฉพาะข้อเสนอที่สถานะ "รอเห็นชอบ" เท่านั้น');

  return { supabase, proposal };
}

export async function createProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = str(formData, "name");
  if (!name) return;

  const budgetYearId = str(formData, "budget_year_id");
  const { data: budgetYear } = await supabase
    .from("plan_budget_years")
    .select("year")
    .eq("id", budgetYearId ?? "")
    .maybeSingle();

  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  const hasActivities = String(formData.get("has_activities") ?? "yes") !== "no";

  let activities: ActivityRow[] = [];
  let budgetAmount = 0;
  if (hasActivities) {
    try {
      activities = JSON.parse(String(formData.get("activities_json") ?? "[]"));
    } catch {
      activities = [];
    }
    activities = activities
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        ...a,
        budget: Number(a.budget) || 0,
      })) as unknown as ActivityRow[];
    budgetAmount = activities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
  } else {
    budgetAmount = Number(formData.get("project_budget") ?? 0) || 0;
  }

  const baseName = sanitizeFileNamePart(budgetYear ? `${name}_${budgetYear.year}` : name);
  const fileUrlWord = await renameProposalFile(supabase, str(formData, "file_url_word"), baseName);
  const fileUrlPdf = await renameProposalFile(supabase, str(formData, "file_url_pdf"), baseName);

  const { error } = await supabase.from("plan_project_proposals").insert({
    created_by: user.id,
    proposer_name: profile?.full_name ?? null,
    budget_year_id: budgetYearId,
    standard: str(formData, "standard"),
    admin_group_id: str(formData, "admin_group_id"),
    name,
    responsible,
    objectives: listField(formData, "objectives_json"),
    strategy_alignment: str(formData, "strategy_alignment"),
    activities,
    budget_amount: budgetAmount,
    budget_source_id: str(formData, "budget_source_id"),
    file_url_word: fileUrlWord,
    file_url_pdf: fileUrlPdf,
    indicators_quantity: indicatorsField(formData, "indicators_quantity_json"),
    indicators_quality: indicatorsField(formData, "indicators_quality_json"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function extractProposalFromUploadedFile(input: {
  filePath: string;
  strategies: string[];
  standards: string[];
  teachers: string[];
}) {
  const { supabase } = await requireUser();
  try {
    const data = await extractProposalFromFile(supabase, input.filePath, {
      strategies: input.strategies,
      standards: input.standards,
      teachers: input.teachers,
    });
    return { ok: true as const, data };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "อ่านไฟล์ด้วย AI ไม่สำเร็จ" };
  }
}

export async function updateProposal(id: string, formData: FormData) {
  const { supabase, proposal } = await requireEditableProposal(id);

  const name = str(formData, "name");
  if (!name) return;

  const { data: budgetYear } = await supabase
    .from("plan_budget_years")
    .select("year")
    .eq("id", proposal.budget_year_id ?? "")
    .maybeSingle();

  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  const hasActivities = String(formData.get("has_activities") ?? "yes") !== "no";

  let activities: ActivityRow[] = [];
  let budgetAmount = 0;
  if (hasActivities) {
    try {
      activities = JSON.parse(String(formData.get("activities_json") ?? "[]"));
    } catch {
      activities = [];
    }
    activities = activities
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        ...a,
        budget: Number(a.budget) || 0,
      })) as unknown as ActivityRow[];
    budgetAmount = activities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
  } else {
    budgetAmount = Number(formData.get("project_budget") ?? 0) || 0;
  }

  const baseName = sanitizeFileNamePart(budgetYear ? `${name}_${budgetYear.year}` : name);
  const fileUrlWord = await replaceProposalFile(supabase, proposal.file_url_word, str(formData, "file_url_word"), baseName);
  const fileUrlPdf = await replaceProposalFile(supabase, proposal.file_url_pdf, str(formData, "file_url_pdf"), baseName);

  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      standard: str(formData, "standard"),
      admin_group_id: str(formData, "admin_group_id"),
      name,
      responsible,
      objectives: listField(formData, "objectives_json"),
      strategy_alignment: str(formData, "strategy_alignment"),
      activities,
      budget_amount: budgetAmount,
      budget_source_id: str(formData, "budget_source_id"),
      file_url_word: fileUrlWord,
      file_url_pdf: fileUrlPdf,
      indicators_quantity: indicatorsField(formData, "indicators_quantity_json"),
      indicators_quality: indicatorsField(formData, "indicators_quality_json"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function deleteProposalFile(id: string, field: "file_url_word" | "file_url_pdf") {
  const supabase = await requireAdmin();
  const { data: proposal } = await supabase
    .from("plan_project_proposals")
    .select("file_url_word, file_url_pdf")
    .eq("id", id)
    .maybeSingle();
  const ref = proposal?.[field];
  if (ref) await deleteFromStorage(supabase, ref, PROPOSAL_FILES_BUCKET);

  const update = field === "file_url_word" ? { file_url_word: null } : { file_url_pdf: null };
  const { error } = await supabase.from("plan_project_proposals").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function endorseProposal(id: string, decision: "เห็นชอบ" | "ไม่เห็นชอบ", note?: string) {
  const { supabase, signerName } = await requireAdminOrGroup("รองผู้อำนวยการ");
  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      status: decision === "เห็นชอบ" ? "รออนุมัติ" : "ไม่เห็นชอบ",
      endorsed_by_name: signerName.trim() || null,
      endorsed_at: new Date().toISOString(),
      endorse_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "รอเห็นชอบ");
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

/** ให้รองผู้อำนวยการยกเลิกการเห็นชอบของตนเองได้ ตราบใดที่ผู้อำนวยการยังไม่ได้กดอนุมัติ/ไม่อนุมัติ */
export async function cancelEndorsement(id: string) {
  const { supabase } = await requireAdminOrGroup("รองผู้อำนวยการ");
  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      status: "รอเห็นชอบ",
      endorsed_by_name: null,
      endorsed_at: null,
      endorse_note: null,
    })
    .eq("id", id)
    .eq("status", "รออนุมัติ");
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

/** เมื่ออนุมัติโครงการแล้ว ให้สร้างโครงการจริง (plan_projects) พร้อมกิจกรรมโดยอัตโนมัติ ถ้ายังไม่เคยสร้างมาก่อน */
async function createProjectFromProposal(supabase: Awaited<ReturnType<typeof createClient>>, proposalId: string) {
  const { data: proposal } = await supabase
    .from("plan_project_proposals")
    .select("project_id, name, budget_year_id, admin_group_id, budget_source_id, budget_amount, activities")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal || proposal.project_id || !proposal.budget_year_id || !proposal.admin_group_id) return;

  const { data: project, error: projectError } = await supabase
    .from("plan_projects")
    .insert({
      name: proposal.name,
      budget_year_id: proposal.budget_year_id,
      admin_group_id: proposal.admin_group_id,
      budget_source_id: proposal.budget_source_id,
      budget: proposal.budget_amount,
    })
    .select("id")
    .single();
  if (projectError || !project) return;

  const activities =
    (proposal.activities as unknown as { name: string; responsible: string[]; budget: number }[] | null) ?? [];
  if (activities.length > 0) {
    await supabase.from("plan_activities").insert(
      activities.map((a) => ({
        project_id: project.id,
        name: a.name,
        budget: Number(a.budget) || 0,
        responsible: a.responsible,
      })),
    );
  }

  await supabase.from("plan_project_proposals").update({ project_id: project.id }).eq("id", proposalId);
}

export async function approveProposal(id: string, decision: "อนุมัติแล้ว" | "ไม่อนุมัติ", note?: string) {
  const { supabase, signerName } = await requireAdminOrGroup("ผู้อำนวยการ");
  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      status: decision,
      approved_by_name: signerName.trim() || null,
      approved_at: new Date().toISOString(),
      approve_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "รออนุมัติ");
  if (error) throw new Error(error.message);

  if (decision === "อนุมัติแล้ว") {
    await createProjectFromProposal(supabase, id);
  }

  revalidatePath("/project-proposals");
  revalidatePath("/projects");
}

export async function resetProposalStatus(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      status: "รอเห็นชอบ",
      endorsed_by_name: null,
      endorsed_at: null,
      endorse_note: null,
      approved_by_name: null,
      approved_at: null,
      approve_note: null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function deleteProposal(id: string) {
  const { supabase } = await requireEditableProposal(id);
  const { error } = await supabase.from("plan_project_proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}
