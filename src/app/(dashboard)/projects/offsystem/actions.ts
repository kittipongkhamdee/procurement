"use server";

// บันทึก/แก้ไข/ลบ "รายการตัดงบนอกระบบ" — เจ้าหน้าที่ (แอดมิน/พัสดุ/การเงิน) บันทึกเป็นข้อมูลเท่านั้น ไม่ผ่านขั้นเห็นชอบ/อนุมัติ
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OFFSYSTEM_CATEGORIES } from "@/lib/offsystem-spending";

export type OffsystemInput = {
  project_id: string;
  activity_id: string | null;
  spend_date: string;
  category: string;
  /** ยอดรวม — ถ้ามีรายการแหล่งเงิน ใช้ผลรวมของแหล่งเงินแทน */
  amount: number;
  ref_doc: string;
  note: string;
  sources: { budget_source_id: string; amount: number }[];
};

const NO_PERMISSION = "เฉพาะแอดมิน เจ้าหน้าที่พัสดุ และเจ้าหน้าที่การเงินเท่านั้นที่บันทึกรายการตัดงบนอกระบบได้";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("proc_profiles").select("role, full_name").eq("user_id", user.id).maybeSingle();
  if (!profile || !["admin", "supply_officer", "finance_officer"].includes(profile.role)) return null;
  return { supabase, user, name: profile.full_name ?? user.email ?? "" };
}

export async function saveOffsystem(id: string | null, input: OffsystemInput): Promise<{ error?: string }> {
  const ctx = await requireStaff();
  if (!ctx) return { error: NO_PERMISSION };
  const { supabase, user, name } = ctx;

  if (!input.project_id) return { error: "กรุณาเลือกโครงการ" };
  if (!input.spend_date) return { error: "กรุณาเลือกวันที่" };
  const sources = input.sources.filter((x) => x.budget_source_id);
  if (sources.some((x) => !Number.isFinite(Number(x.amount)) || Number(x.amount) < 0)) return { error: "จำนวนเงินของแหล่งเงินไม่ถูกต้อง" };
  if (new Set(sources.map((x) => x.budget_source_id)).size !== sources.length) return { error: "เลือกแหล่งเงินซ้ำกัน" };
  const amount = sources.length > 0 ? sources.reduce((s, x) => s + Number(x.amount), 0) : Number(input.amount);
  if (!Number.isFinite(amount) || !(amount > 0)) return { error: "จำนวนเงินต้องมากกว่า 0" };
  const category = (OFFSYSTEM_CATEGORIES as readonly string[]).includes(input.category) ? input.category : "อื่นๆ";

  // ชื่อกิจกรรมเก็บไว้ด้วย (จับคู่ยอดใช้ไปรายกิจกรรมด้วยชื่อเหมือนบันทึกขออนุมัติ) — ต้องเป็นกิจกรรมของโครงการนี้
  let activityName: string | null = null;
  if (input.activity_id) {
    const { data: act } = await supabase.from("plan_activities").select("name, project_id").eq("id", input.activity_id).maybeSingle();
    if (!act || act.project_id !== input.project_id) return { error: "กิจกรรมไม่อยู่ในโครงการที่เลือก" };
    activityName = act.name;
  }

  const fields = {
    project_id: input.project_id,
    activity_id: input.activity_id || null,
    activity_name: activityName,
    spend_date: input.spend_date,
    category,
    amount,
    ref_doc: input.ref_doc.trim() || null,
    note: input.note.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let spendingId = id;
  if (id) {
    const { data, error } = await supabase.from("proc_offsystem_spending").update(fields).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!data?.length) return { error: "ไม่พบรายการ หรือไม่มีสิทธิ์แก้ไข" };
  } else {
    const { data, error } = await supabase
      .from("proc_offsystem_spending")
      .insert({ ...fields, created_by: user.id, created_by_name: name })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "บันทึกไม่สำเร็จ" };
    spendingId = data.id;
  }

  const { error: delError } = await supabase.from("proc_offsystem_spending_sources").delete().eq("spending_id", spendingId as string);
  if (delError) return { error: delError.message };
  if (sources.length > 0) {
    const { error } = await supabase.from("proc_offsystem_spending_sources").insert(
      sources.map((x, k) => ({ spending_id: spendingId as string, budget_source_id: x.budget_source_id, amount: Number(x.amount), sort_order: k })),
    );
    if (error) return { error: error.message };
  }

  await supabase
    .rpc("proc_log_activity", { p_action: id ? "update" : "create", p_entity: "ตัดงบนอกระบบ", p_summary: `${category} ${amount.toLocaleString("th-TH")} บาท${input.ref_doc.trim() ? ` อ้างอิง ${input.ref_doc.trim()}` : ""}` })
    .then(undefined, () => undefined);
  revalidatePath("/projects/offsystem");
  revalidatePath("/projects");
  return {};
}

export async function deleteOffsystem(id: string): Promise<{ error?: string }> {
  const ctx = await requireStaff();
  if (!ctx) return { error: NO_PERMISSION };
  const { data, error } = await ctx.supabase.from("proc_offsystem_spending").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "ไม่พบรายการ หรือไม่มีสิทธิ์ลบ" };
  await ctx.supabase.rpc("proc_log_activity", { p_action: "delete", p_entity: "ตัดงบนอกระบบ", p_summary: "ลบรายการตัดงบนอกระบบ" }).then(undefined, () => undefined);
  revalidatePath("/projects/offsystem");
  revalidatePath("/projects");
  return {};
}
