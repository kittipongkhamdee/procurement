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

type DraftActivityLite = { name: string; budget: number };

/** กิจกรรมของร่างโครงการที่ "สมบูรณ์" แล้ว = มีกิจกรรมและผลรวมงบกิจกรรมเท่ากับงบร่าง (ผู้ดูแลระบบกรอกวงเงินครบแล้ว) */
async function loadFinalDraftActivities(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  draftId: string,
  draftBudget: number,
): Promise<{ hasActivities: boolean; final: DraftActivityLite[] | null }> {
  const { data } = await supabase
    .from("plan_draft_activities")
    .select("name, budget, sort_order")
    .eq("draft_project_id", draftId)
    .order("sort_order");
  const acts = (data ?? []).map((a) => ({ name: a.name, budget: Number(a.budget ?? 0) }));
  if (acts.length === 0) return { hasActivities: false, final: null };
  const total = acts.reduce((sum, a) => sum + a.budget, 0);
  return { hasActivities: true, final: Math.abs(total - draftBudget) < 0.01 ? acts : null };
}

/** ชื่อ/งบกิจกรรมมาจากร่างโครงการ (แก้ไม่ได้) — ผู้รับผิดชอบกิจกรรมเอามาจากที่ครูส่งมา (จับคู่ตามชื่อก่อน แล้วตามลำดับ) */
function activitiesFromDraft(draftActs: DraftActivityLite[], submitted: ActivityRow[]): ActivityRow[] {
  return draftActs.map((d, i) => {
    const match =
      submitted.find((s) => s.name.trim() === d.name.trim()) ?? (submitted.length === draftActs.length ? submitted[i] : undefined);
    return {
      name: d.name,
      responsible: Array.isArray(match?.responsible) ? match.responsible : [],
      budget: d.budget as unknown as string,
    };
  });
}

function parseActivitiesJson(formData: FormData): ActivityRow[] {
  try {
    const parsed = JSON.parse(String(formData.get("activities_json") ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    .select("created_by, status, name, budget_year_id, file_url_word, file_url_pdf, admin_group_id, budget_source_id, budget_amount, activities, draft_project_id")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) throw new Error("ไม่พบข้อเสนอโครงการ");
  if (!isAdmin && proposal.created_by !== user.id) throw new Error("ไม่มีสิทธิ์ทำรายการนี้");
  if (proposal.status !== "รอเห็นชอบ") throw new Error('ทำรายการได้เฉพาะข้อเสนอที่สถานะ "รอเห็นชอบ" เท่านั้น');

  return { supabase, proposal, isAdmin };
}

const BUDGET_MISMATCH_MESSAGE = (target: number, total: number) =>
  `งบประมาณรวมของกิจกรรมย่อย (${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท) ไม่เท่ากับงบที่กำหนดไว้ (${target.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท) กรุณาแก้ไขให้ยอดรวมตรงกันก่อนบันทึก`;

const DUPLICATE_PROPOSAL_MESSAGE =
  "โครงการนี้ได้ส่งข้อเสนอโครงการไปแล้ว 1 โครงการส่งได้ 1 รายการ ไม่สามารถส่งซ้ำได้ (หากต้องการแก้ไข ให้ไปแก้ที่รายการเดิม)";

function normalizeProposalName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 1 โครงการส่งข้อเสนอได้ 1 รายการต่อปีงบประมาณ — เช็กชื่อซ้ำ (ไม่สนช่องว่าง/ตัวพิมพ์เล็กใหญ่) ยกเว้นรายการของตัวเองตอนแก้ไข */
async function hasDuplicateProposal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  budgetYearId: string | null,
  name: string,
  excludeId?: string,
) {
  let query = supabase.from("plan_project_proposals").select("id, name");
  query = budgetYearId ? query.eq("budget_year_id", budgetYearId) : query.is("budget_year_id", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  const target = normalizeProposalName(name);
  return (data ?? []).some((p) => normalizeProposalName(p.name) === target);
}

export async function createProposal(formData: FormData): Promise<{ error?: string } | void> {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // ชื่อโครงการต้องเลือกจากร่างโครงการเท่านั้น — ใช้ชื่อ/กลุ่มบริหาร/แหล่งเงิน/งบจากร่างโครงการเป็นหลัก ไม่เชื่อค่าที่พิมพ์มาจากฟอร์ม
  const budgetYearId = str(formData, "budget_year_id");
  const draftProjectId = str(formData, "draft_project_id");
  if (!draftProjectId) return { error: "กรุณาเลือกโครงการจากร่างโครงการ (พิมพ์ชื่อโครงการเองไม่ได้)" };
  const { data: draft } = await supabase
    .from("plan_draft_projects")
    .select("id, name, budget_year_id, admin_group_id, budget_source_id, budget")
    .eq("id", draftProjectId)
    .maybeSingle();
  if (!draft || draft.budget_year_id !== budgetYearId) {
    return { error: "ไม่พบร่างโครงการที่เลือกในปีงบประมาณนี้ กรุณาเลือกใหม่" };
  }
  const name = draft.name.trim();
  if (!name) return;

  if (await hasDuplicateProposal(supabase, budgetYearId, name)) return { error: DUPLICATE_PROPOSAL_MESSAGE };
  // ร่างหนึ่งผูกได้กับข้อเสนอเดียว
  const { data: draftTaken } = await supabase
    .from("plan_project_proposals")
    .select("id")
    .eq("draft_project_id", draftProjectId)
    .maybeSingle();
  if (draftTaken) return { error: DUPLICATE_PROPOSAL_MESSAGE };

  const { data: budgetYear } = await supabase
    .from("plan_budget_years")
    .select("year")
    .eq("id", budgetYearId ?? "")
    .maybeSingle();

  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  // ครูต้องกดยืนยันงบประมาณที่ได้รับอีกครั้งตอนเสนอโครงการ
  if (String(formData.get("budget_confirmed") ?? "") !== "yes") {
    return { error: "กรุณากดยืนยันงบประมาณที่ได้รับก่อนส่งข้อเสนอโครงการ" };
  }

  // ร่างโครงการที่มีกิจกรรมย่อย: ชื่อ/งบกิจกรรมใช้ตามร่างเสมอ (ตกลงกันแล้วที่ประชุมคณะจัดทำร่างโครงการ) ครูกรอกได้เฉพาะผู้รับผิดชอบ
  const draftBudgetForCheck = Number(draft.budget ?? 0);
  const draftActs = await loadFinalDraftActivities(supabase, draftProjectId, draftBudgetForCheck);
  if (draftActs.hasActivities && !draftActs.final) {
    return { error: "ร่างโครงการนี้ยังกำหนดงบรายกิจกรรมไม่ครบ (ผลรวมกิจกรรมไม่เท่างบโครงการ) กรุณาแจ้งผู้ดูแลระบบให้ตรวจสอบก่อน" };
  }

  const hasActivities = draftActs.final ? true : String(formData.get("has_activities") ?? "yes") !== "no";

  let activities: ActivityRow[] = [];
  let budgetAmount = 0;
  if (draftActs.final) {
    activities = activitiesFromDraft(draftActs.final, parseActivitiesJson(formData));
    budgetAmount = draftBudgetForCheck;
  } else if (hasActivities) {
    activities = parseActivitiesJson(formData);
    activities = activities
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        ...a,
        budget: Number(a.budget) || 0,
      })) as unknown as ActivityRow[];
    const draftBudget = Number(draft.budget ?? 0);
    const activitiesTotal = activities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    // งบที่กำหนดไว้ในร่างโครงการ: งบรวมกิจกรรมย่อยต้องเท่ากับงบนั้นพอดี
    if (Math.abs(activitiesTotal - draftBudget) >= 0.01) {
      return { error: BUDGET_MISMATCH_MESSAGE(draftBudget, activitiesTotal) };
    }
    budgetAmount = draftBudget;
  } else {
    budgetAmount = Number(draft.budget ?? 0);
  }

  const baseName = sanitizeFileNamePart(budgetYear ? `${name}_${budgetYear.year}` : name);
  const fileUrlWord = await renameProposalFile(supabase, str(formData, "file_url_word"), baseName);
  const fileUrlPdf = await renameProposalFile(supabase, str(formData, "file_url_pdf"), baseName);

  const { error } = await supabase.from("plan_project_proposals").insert({
    created_by: user.id,
    proposer_name: profile?.full_name ?? null,
    budget_year_id: budgetYearId,
    draft_project_id: draftProjectId,
    standard: str(formData, "standard"),
    admin_group_id: draft.admin_group_id ?? str(formData, "admin_group_id"),
    name,
    responsible,
    objectives: listField(formData, "objectives_json"),
    strategy_alignment: str(formData, "strategy_alignment"),
    activities,
    budget_amount: budgetAmount,
    budget_source_id: draft.budget_source_id ?? str(formData, "budget_source_id"),
    file_url_word: fileUrlWord,
    file_url_pdf: fileUrlPdf,
    indicators_quantity: indicatorsField(formData, "indicators_quantity_json"),
    indicators_quality: indicatorsField(formData, "indicators_quality_json"),
  });
  if (error) {
    // ส่งพร้อมกันสองคำขอ: ดัชนี unique ในฐานข้อมูลกันซ้ำไว้อีกชั้น
    if (error.code === "23505") return { error: DUPLICATE_PROPOSAL_MESSAGE };
    throw new Error(error.message);
  }
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

export async function updateProposal(id: string, formData: FormData): Promise<{ error?: string } | void> {
  const { supabase, proposal, isAdmin } = await requireEditableProposal(id);
  // ครู (ไม่ใช่ผู้ดูแลระบบ) แก้กลุ่มงาน แหล่งเงิน วิธีกรอกงบ และงบรวมก้อนเดียวไม่ได้ — ใช้ค่าเดิมในฐานข้อมูลเสมอ ไม่เชื่อค่าจากฟอร์ม
  const lockBudget = !isAdmin;

  // ครูแก้ชื่อโครงการเองไม่ได้ (ชื่อมาจากร่างโครงการ) — เฉพาะผู้ดูแลระบบแก้ได้
  const name = lockBudget ? proposal.name : str(formData, "name");
  if (!name) return;
  if (await hasDuplicateProposal(supabase, proposal.budget_year_id, name, id)) {
    return { error: DUPLICATE_PROPOSAL_MESSAGE };
  }

  const { data: budgetYear } = await supabase
    .from("plan_budget_years")
    .select("year")
    .eq("id", proposal.budget_year_id ?? "")
    .maybeSingle();

  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  const existingActivities = (proposal.activities as unknown as unknown[] | null) ?? [];
  const hasActivities = lockBudget
    ? existingActivities.length > 0
    : String(formData.get("has_activities") ?? "yes") !== "no";

  // ครู: ถ้าร่างโครงการที่ผูกอยู่กำหนดกิจกรรม+งบครบแล้ว ชื่อ/งบกิจกรรมใช้ตามร่างเสมอ แก้เองไม่ได้ (เหลือแก้ผู้รับผิดชอบได้)
  let finalDraftActs: DraftActivityLite[] | null = null;
  if (lockBudget && proposal.draft_project_id) {
    const { data: linkedDraft } = await supabase
      .from("plan_draft_projects")
      .select("budget")
      .eq("id", proposal.draft_project_id)
      .maybeSingle();
    if (linkedDraft) {
      finalDraftActs = (await loadFinalDraftActivities(supabase, proposal.draft_project_id, Number(linkedDraft.budget ?? 0))).final;
    }
  }

  let activities: ActivityRow[] = [];
  let budgetAmount = 0;
  if (finalDraftActs) {
    activities = activitiesFromDraft(finalDraftActs, parseActivitiesJson(formData));
    budgetAmount = finalDraftActs.reduce((sum, a) => sum + a.budget, 0);
  } else if (hasActivities) {
    activities = parseActivitiesJson(formData);
    activities = activities
      .filter((a) => a.name.trim() !== "")
      .map((a) => ({
        ...a,
        budget: Number(a.budget) || 0,
      })) as unknown as ActivityRow[];
    const lockedBudgetAmount = formData.get("locked_budget_amount");
    const activitiesTotal = activities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);
    if (lockBudget) {
      // ครูแก้ไขได้เฉพาะการแบ่งงบรายกิจกรรม — ยอดรวมต้องเท่ากับงบที่กำหนดไว้เดิมพอดี
      const target = Number(proposal.budget_amount ?? 0);
      if (Math.abs(activitiesTotal - target) >= 0.01) return { error: BUDGET_MISMATCH_MESSAGE(target, activitiesTotal) };
      budgetAmount = target;
    } else {
      budgetAmount = lockedBudgetAmount !== null ? Number(lockedBudgetAmount) || 0 : activitiesTotal;
    }
  } else {
    budgetAmount = lockBudget ? Number(proposal.budget_amount ?? 0) : Number(formData.get("project_budget") ?? 0) || 0;
  }

  const baseName = sanitizeFileNamePart(budgetYear ? `${name}_${budgetYear.year}` : name);
  const fileUrlWord = await replaceProposalFile(supabase, proposal.file_url_word, str(formData, "file_url_word"), baseName);
  const fileUrlPdf = await replaceProposalFile(supabase, proposal.file_url_pdf, str(formData, "file_url_pdf"), baseName);

  const { error } = await supabase
    .from("plan_project_proposals")
    .update({
      standard: str(formData, "standard"),
      admin_group_id: lockBudget ? proposal.admin_group_id : str(formData, "admin_group_id"),
      name,
      responsible,
      objectives: listField(formData, "objectives_json"),
      strategy_alignment: str(formData, "strategy_alignment"),
      activities,
      budget_amount: budgetAmount,
      budget_source_id: lockBudget ? proposal.budget_source_id : str(formData, "budget_source_id"),
      file_url_word: fileUrlWord,
      file_url_pdf: fileUrlPdf,
      indicators_quantity: indicatorsField(formData, "indicators_quantity_json"),
      indicators_quality: indicatorsField(formData, "indicators_quality_json"),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: DUPLICATE_PROPOSAL_MESSAGE };
    throw new Error(error.message);
  }
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

  const { data: proposal } = await supabase
    .from("plan_project_proposals")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();

  // ถ้าเคยอนุมัติจนสร้างโครงการจริงไปแล้ว ต้องลบโครงการนั้นทิ้งไปด้วย ไม่งั้นโครงการจะค้างอยู่ที่หน้าโครงการ/
  // คลังเอกสาร ทั้งที่ข้อเสนอถูกย้อนสถานะแล้ว (ลบไม่ได้ถ้ามีสัญญา/เบิกจ่าย/เอกสารอนุมัติจัดซื้อผูกอยู่แล้ว — กันข้อมูลจริงหาย)
  if (proposal?.project_id) {
    const { error: deleteError } = await supabase.from("plan_projects").delete().eq("id", proposal.project_id);
    if (deleteError) {
      throw new Error(
        "ย้อนสถานะไม่ได้ เนื่องจากโครงการนี้มีสัญญา/การเบิกจ่าย/เอกสารอนุมัติจัดซื้อผูกอยู่แล้ว กรุณาลบข้อมูลเหล่านั้นก่อน",
      );
    }
  }

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
  revalidatePath("/projects");
  revalidatePath("/documents");
}

export async function deleteProposal(id: string) {
  const { supabase } = await requireEditableProposal(id);
  const { error } = await supabase.from("plan_project_proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}
