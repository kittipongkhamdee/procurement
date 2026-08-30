"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function createProposal(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = str(formData, "name");
  if (!name) return;

  const responsible = formData.getAll("responsible").map(String).filter(Boolean);

  let activities: ActivityRow[] = [];
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

  const budgetAmount = activities.reduce((sum, a) => sum + (Number(a.budget) || 0), 0);

  const { error } = await supabase.from("plan_project_proposals").insert({
    created_by: user.id,
    proposer_name: profile?.full_name ?? null,
    budget_year_id: str(formData, "budget_year_id"),
    standard: str(formData, "standard"),
    admin_group_id: str(formData, "admin_group_id"),
    name,
    responsible,
    strategy_alignment: str(formData, "strategy_alignment"),
    activities,
    budget_amount: budgetAmount,
    budget_source_id: str(formData, "budget_source_id"),
    file_url_word: str(formData, "file_url_word"),
    file_url_pdf: str(formData, "file_url_pdf"),
  });
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
  const path = proposal?.[field];
  if (path) await supabase.storage.from(PROPOSAL_FILES_BUCKET).remove([path]);

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
  revalidatePath("/project-proposals");
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
  const { supabase } = await requireUser();
  const { error } = await supabase.from("plan_project_proposals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}
