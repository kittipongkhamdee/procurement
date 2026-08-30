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

  const { error } = await supabase.from("plan_project_proposals").insert({
    created_by: user.id,
    proposer_name: profile?.full_name ?? null,
    budget_year_id: str(formData, "budget_year_id"),
    admin_group_id: str(formData, "admin_group_id"),
    name,
    project_type: str(formData, "project_type") ?? "ใหม่",
    responsible,
    strategy_alignment: str(formData, "strategy_alignment"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
    rationale: str(formData, "rationale"),
    objectives: str(formData, "objectives"),
    target_quantity: str(formData, "target_quantity"),
    target_quality: str(formData, "target_quality"),
    success_indicators: str(formData, "success_indicators"),
    procedures: str(formData, "procedures"),
    budget_amount: Number(formData.get("budget_amount") ?? 0),
    budget_source_id: str(formData, "budget_source_id"),
    expected_results: str(formData, "expected_results"),
    evaluation_method: str(formData, "evaluation_method"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/project-proposals");
}

export async function updateProposalStatus(id: string, status: "เห็นชอบ" | "ไม่เห็นชอบ" | "รอพิจารณา", note?: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_project_proposals")
    .update({ status, status_note: note?.trim() || null })
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
