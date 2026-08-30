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

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim() || null;
}

type ActivityRow = {
  name: string;
  period: string;
  responsible: string[];
  compensation: string;
  service: string;
  material: string;
};
type EvaluationRow = { type: string; indicator: string; target: string; method: string; tool: string };

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
  activities = activities.filter((a) => a.name.trim() !== "");

  const budgetAmount = activities.reduce(
    (sum, a) => sum + (Number(a.compensation) || 0) + (Number(a.service) || 0) + (Number(a.material) || 0),
    0,
  );

  let evaluationItems: EvaluationRow[] = [];
  try {
    evaluationItems = JSON.parse(String(formData.get("evaluation_items_json") ?? "[]"));
  } catch {
    evaluationItems = [];
  }
  evaluationItems = evaluationItems.filter((e) => e.indicator.trim() !== "");

  const { error } = await supabase.from("plan_project_proposals").insert({
    created_by: user.id,
    proposer_name: profile?.full_name ?? null,
    budget_year_id: str(formData, "budget_year_id"),
    standard: str(formData, "standard"),
    admin_group_id: str(formData, "admin_group_id"),
    name,
    project_type: str(formData, "project_type") ?? "ใหม่",
    responsible,
    strategy_alignment: str(formData, "strategy_alignment"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
    location: str(formData, "location"),
    rationale: str(formData, "rationale"),
    objectives: str(formData, "objectives"),
    target_quantity: str(formData, "target_quantity"),
    target_quality: str(formData, "target_quality"),
    activities,
    budget_amount: budgetAmount,
    budget_source_id: str(formData, "budget_source_id"),
    risk_factors: str(formData, "risk_factors"),
    risk_mitigation: str(formData, "risk_mitigation"),
    evaluation_items: evaluationItems,
    expected_results: str(formData, "expected_results"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function endorseProposal(
  id: string,
  decision: "เห็นชอบ" | "ไม่เห็นชอบ",
  signerName: string,
  note?: string,
) {
  const supabase = await requireAdmin();
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

export async function approveProposal(
  id: string,
  decision: "อนุมัติแล้ว" | "ไม่อนุมัติ",
  signerName: string,
  note?: string,
) {
  const supabase = await requireAdmin();
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
