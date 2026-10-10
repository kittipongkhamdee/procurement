"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return supabase;
}

// อนุญาตให้ admin แก้ไขร่างโครงการได้เสมอ ส่วนผู้ใช้อื่นแก้ไขได้เฉพาะตอนที่ admin เปิด
// "เปิดการแก้ไขให้ทุกคน" ไว้สำหรับปีงบประมาณนั้น (plan_budget_years.draft_projects_open_edit) —
// เพิ่ม/แก้ไขร่างโครงการเท่านั้น การลบยังคงจำกัดเฉพาะ admin เสมอ (ดู deleteDraftProject)
async function requireDraftEditor(budgetYearId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const { data: profile } = await supabase.from("proc_profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role === "admin") return supabase;
  const { data: year } = await supabase
    .from("plan_budget_years")
    .select("draft_projects_open_edit")
    .eq("id", budgetYearId)
    .maybeSingle();
  if (!year?.draft_projects_open_edit) throw new Error("ขณะนี้ยังไม่เปิดให้แก้ไขร่างโครงการ กรุณาติดต่อผู้ดูแลระบบ");
  return supabase;
}

export async function upsertStudentCount(budgetYearId: string, gradeKey: string, studentCount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_student_counts")
    .upsert(
      { budget_year_id: budgetYearId, grade_key: gradeKey, student_count: studentCount },
      { onConflict: "budget_year_id,grade_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertRevenueRate(
  budgetYearId: string,
  itemKey: string,
  gradeKey: string,
  ratePerStudent: number,
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_revenue_rates")
    .upsert(
      { budget_year_id: budgetYearId, item_key: itemKey, grade_key: gradeKey, rate_per_student: ratePerStudent },
      { onConflict: "budget_year_id,item_key,grade_key" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertSchoolIncome(budgetYearId: string, amount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_school_income")
    .upsert({ budget_year_id: budgetYearId, amount }, { onConflict: "budget_year_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

export async function upsertGroupAllocation(budgetYearId: string, adminGroupId: string, allocatedAmount: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_group_allocations")
    .upsert(
      { budget_year_id: budgetYearId, admin_group_id: adminGroupId, allocated_amount: allocatedAmount },
      { onConflict: "budget_year_id,admin_group_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// คัดลอกโครงการจากปีงบประมาณเดิม (plan_projects + plan_activities) มาเป็น "ร่างโครงการ"
// (plan_draft_projects) สำหรับปีงบประมาณใหม่ที่เลือกไว้ในหน้านี้ — ยังไม่ใช่โครงการจริงและไม่ใช่
// ข้อเสนอโครงการ เป็นแค่ข้อมูลตั้งต้นให้ admin แก้ไข/เพิ่ม/ลบ ชื่อ/กลุ่มบริหาร/แหล่งงบ/งบประมาณ
// ก่อนที่ครูจะไปเลือกใช้ตอนสร้างข้อเสนอโครงการจริงที่เมนู "เสนอโครงการ" ต่อไป
type PrevActivity = { name: string | null; budget: number; sort_order: number };

// แปลงกิจกรรมของโครงการปีก่อนเป็นแถวกิจกรรมของร่าง — กิจกรรมที่ไม่มีชื่อได้ชื่อ "กิจกรรมที่ N"
function buildDraftActivityRows(draftId: string, activities: PrevActivity[] | undefined, keepBudget: boolean) {
  // โครงการที่ไม่มีกิจกรรมย่อย: ระบบเดิมเก็บงบไว้ในกิจกรรมเดียวที่ไม่มีชื่อ — ไม่คัดลอกเป็นกิจกรรมของร่าง
  if (activities && activities.length === 1 && !activities[0].name?.trim()) return [];
  return [...(activities ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a, i) => ({
      draft_project_id: draftId,
      name: a.name?.trim() || `กิจกรรมที่ ${i + 1}`,
      budget: keepBudget ? Number(a.budget ?? 0) : 0,
      sort_order: i,
    }));
}

export async function copyProjectsToDraft(targetBudgetYearId: string, projectIds: string[]) {
  const supabase = await requireAdmin();
  if (projectIds.length === 0) return { copied: 0, skipped: 0 };

  const { data: projects, error: fetchError } = await supabase
    .from("plan_projects")
    .select("id, name, admin_group_id, budget_source_id, budget, plan_activities(name, budget, sort_order)")
    .in("id", projectIds);
  if (fetchError) throw new Error(fetchError.message);
  if (!projects || projects.length === 0) return { copied: 0, skipped: 0 };

  // กันคัดลอกซ้ำ: ข้ามโครงการที่มีร่างโครงการชื่อเดียวกัน+กลุ่มบริหารเดียวกันอยู่แล้วในปีนี้
  const { data: existing } = await supabase
    .from("plan_draft_projects")
    .select("name, admin_group_id")
    .eq("budget_year_id", targetBudgetYearId);
  const existingKeys = new Set((existing ?? []).map((e) => `${e.name.trim()}|${e.admin_group_id ?? ""}`));
  const fresh = projects.filter((p) => !existingKeys.has(`${p.name.trim()}|${p.admin_group_id ?? ""}`));
  const skipped = projects.length - fresh.length;
  if (fresh.length === 0) return { copied: 0, skipped };

  const rows = fresh.map((p) => {
    const activities = (p.plan_activities as unknown as { budget: number }[]) ?? [];
    const budget =
      activities.length > 0 ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
    return {
      budget_year_id: targetBudgetYearId,
      name: p.name,
      admin_group_id: p.admin_group_id,
      budget_source_id: p.budget_source_id,
      source_project_id: p.id,
      budget,
    };
  });

  const { data: inserted, error } = await supabase.from("plan_draft_projects").insert(rows).select("id, source_project_id");
  if (error) throw new Error(error.message);

  // คัดลอกกิจกรรมย่อยของโครงการเดิมมาเป็นกิจกรรมของร่างด้วย (ชื่อ + งบเดิมเป็นค่าตั้งต้น แก้ไขได้ภายหลัง)
  const activityRows = (inserted ?? []).flatMap((d) => {
    const src = fresh.find((p) => p.id === d.source_project_id);
    return buildDraftActivityRows(d.id, src?.plan_activities as unknown as PrevActivity[] | undefined, true);
  });
  if (activityRows.length > 0) {
    const { error: actError } = await supabase.from("plan_draft_activities").insert(activityRows);
    if (actError) throw new Error(actError.message);
  }
  revalidatePath("/fund-allocation");
  return { copied: rows.length, skipped };
}

// ล็อกแก้ไขร่างโครงการหมดอายุอัตโนมัติหลังไม่มีการบันทึก/ยกเลิกภายในเวลานี้ (กันกรณีปิดแท็บทิ้งไว้
// ระหว่างแก้ไข ไม่ให้ร่างโครงการนั้นถูกล็อกค้างตลอดไป)
const EDIT_LOCK_MINUTES = 10;

async function getDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, fallbackEmail: string | null) {
  const { data: profile } = await supabase.from("proc_profiles").select("full_name").eq("user_id", userId).maybeSingle();
  return profile?.full_name ?? fallbackEmail ?? "ผู้ใช้";
}

// เพิ่มร่างโครงการเปล่าให้แก้ไขต่อได้ทันที — ล็อกให้ผู้สร้างแก้ไขต่อได้เลยโดยไม่มีคนอื่นแย่งแก้ไขระหว่างนั้น
// คืนแถวที่สร้างเพื่อให้ฝั่งหน้าเว็บเปิดโหมดแก้ไขต่อได้เลย
export async function createDraftProject(budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const myName = user ? await getDisplayName(supabase, user.id, user.email ?? null) : "ผู้ใช้";
  const { data, error } = await supabase
    .from("plan_draft_projects")
    .insert({
      budget_year_id: budgetYearId,
      name: "โครงการใหม่",
      editing_by: user?.id ?? null,
      editing_by_name: myName,
      editing_at: new Date().toISOString(),
    })
    .select("id, name, admin_group_id, budget_source_id, budget, editing_by, editing_by_name, editing_at")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
  return data;
}

// จองสิทธิ์แก้ไขร่างโครงการแถวหนึ่ง — กันไม่ให้อีกคนกดแก้ไขแถวเดียวกันพร้อมกัน จนกว่าจะบันทึก/ยกเลิก
// (หรือจนล็อกหมดอายุ) ใช้ UPDATE เงื่อนไขเดียวกันแบบ atomic กันแย่งกันจองพร้อมกันพอดี
export async function acquireDraftEditLock(id: string, budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const myName = await getDisplayName(supabase, user.id, user.email ?? null);

  const staleThreshold = new Date(Date.now() - EDIT_LOCK_MINUTES * 60 * 1000).toISOString();
  const { data: updated, error } = await supabase
    .from("plan_draft_projects")
    .update({ editing_by: user.id, editing_by_name: myName, editing_at: new Date().toISOString() })
    .eq("id", id)
    .or(`editing_by.is.null,editing_by.eq.${user.id},editing_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) {
    const { data: row } = await supabase.from("plan_draft_projects").select("editing_by_name").eq("id", id).maybeSingle();
    throw new Error(`ขณะนี้ ${row?.editing_by_name ?? "ผู้ใช้อื่น"} กำลังแก้ไขรายการนี้อยู่ กรุณาลองใหม่อีกครั้ง`);
  }
  revalidatePath("/fund-allocation");
}

// ปล่อยสิทธิ์แก้ไข (ตอนกดยกเลิก) — ให้คนอื่นกดแก้ไขแถวนี้ต่อได้ทันที
export async function releaseDraftEditLock(id: string, budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const { error } = await supabase
    .from("plan_draft_projects")
    .update({ editing_by: null, editing_by_name: null, editing_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// ยกเลิกตอนเพิ่มร่างโครงการใหม่ — ลบแถวเปล่า "โครงการใหม่" ที่เพิ่งสร้างโดยผู้กดเอง (ยังไม่ได้แก้ชื่อ/งบ) ทิ้ง
// ไม่ให้ค้างเป็นแถวขยะ ถ้าไม่ตรงเงื่อนไขนี้จะไม่ลบ แค่ปล่อยล็อกแก้ไข
export async function discardNewDraftProject(id: string, budgetYearId: string) {
  const supabase = await requireDraftEditor(budgetYearId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  const { data: deleted } = await supabase
    .from("plan_draft_projects")
    .delete()
    .eq("id", id)
    .eq("name", "โครงการใหม่")
    .eq("budget", 0)
    .eq("editing_by", user.id)
    .select("id");
  if (!deleted || deleted.length === 0) {
    await supabase
      .from("plan_draft_projects")
      .update({ editing_by: null, editing_by_name: null, editing_at: null })
      .eq("id", id);
    revalidatePath("/fund-allocation");
    return { deleted: false };
  }
  revalidatePath("/fund-allocation");
  return { deleted: true };
}

// แก้ไขร่างโครงการแบบอินไลน์ (ชื่อ/กลุ่มบริหาร/แหล่งงบ/งบประมาณ) — ส่งเฉพาะฟิลด์ที่เปลี่ยน พร้อมปล่อย
// สิทธิ์แก้ไขที่จองไว้ (บันทึกสำเร็จ = แก้ไขเสร็จแล้ว)
export async function updateDraftProject(
  id: string,
  budgetYearId: string,
  fields: { name?: string; admin_group_id?: string | null; budget_source_id?: string | null; budget?: number },
) {
  const supabase = await requireDraftEditor(budgetYearId);
  const { error } = await supabase
    .from("plan_draft_projects")
    .update({ ...fields, editing_by: null, editing_by_name: null, editing_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// การลบร่างโครงการจำกัดเฉพาะ admin เสมอ ไม่ว่าจะเปิดการแก้ไขให้ทุกคนหรือไม่ก็ตาม
export async function deleteDraftProject(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("plan_draft_projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}

// admin เปิด/ปิดให้ทุกคนเพิ่ม/แก้ไขร่างโครงการได้ สำหรับปีงบประมาณที่ระบุ
export async function setDraftEditOpen(budgetYearId: string, open: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("plan_budget_years")
    .update({ draft_projects_open_edit: open })
    .eq("id", budgetYearId);
  if (error) throw new Error(error.message);
  revalidatePath("/fund-allocation");
}


type DraftActivityInput = { id?: string; name: string; budget: number };

// บันทึกร่างโครงการหนึ่งรายการจากหน้าเทียบงบ (ชื่อ/กลุ่ม/แหล่งงบ/โครงการปีก่อนที่จับคู่ + กิจกรรมย่อย)
// - activities เป็น array ที่มีรายการ: งบโครงการ = ผลรวมกิจกรรมเสมอ (กิจกรรมที่ไม่ส่งมา = ถูกลบ)
// - activities เป็น array ว่าง/null: ไม่มีกิจกรรม ใช้งบที่ส่งมาเป็นงบโครงการ
// ปล่อยสิทธิ์แก้ไขที่จองไว้ตอนบันทึกสำเร็จ — คืน { error } แทนการ throw เพราะ production ซ่อนข้อความ error ของ Server Action
export async function saveDraftProject(
  id: string,
  budgetYearId: string,
  input: {
    name: string;
    admin_group_id: string | null;
    budget_source_id: string | null;
    source_project_id: string | null;
    budget: number;
    activities: DraftActivityInput[] | null;
  },
): Promise<{ error?: string }> {
  let supabase;
  try {
    supabase = await requireDraftEditor(budgetYearId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ไม่มีสิทธิ์แก้ไข" };
  }
  const name = input.name.trim();
  if (!name) return { error: "กรุณากรอกชื่อโครงการ" };
  const activities = (input.activities ?? []).map((a) => ({ ...a, name: a.name.trim(), budget: Number(a.budget) }));
  if (activities.some((a) => !a.name)) return { error: "กรุณากรอกชื่อกิจกรรมให้ครบ" };
  if (activities.some((a) => !Number.isFinite(a.budget) || a.budget < 0)) return { error: "กรุณากรอกงบกิจกรรมให้ถูกต้อง" };
  const budget =
    activities.length > 0 ? activities.reduce((sum, a) => sum + a.budget, 0) : Number(input.budget);
  if (!Number.isFinite(budget) || budget < 0) return { error: "กรุณากรอกจำนวนเงินให้ถูกต้อง" };

  const { data: draft } = await supabase
    .from("plan_draft_projects")
    .select("id")
    .eq("id", id)
    .eq("budget_year_id", budgetYearId)
    .maybeSingle();
  if (!draft) return { error: "ไม่พบร่างโครงการนี้" };

  // จัดการกิจกรรมก่อนบันทึกตัวโครงการ: ลบที่ถูกเอาออก แล้ว upsert ที่เหลือ/เพิ่มใหม่
  const { data: existing, error: existingError } = await supabase
    .from("plan_draft_activities")
    .select("id")
    .eq("draft_project_id", id);
  if (existingError) return { error: existingError.message };
  const existingIds = new Set((existing ?? []).map((a) => a.id));
  const keepIds = new Set(activities.map((a) => a.id).filter((x): x is string => !!x && existingIds.has(x)));
  const removeIds = [...existingIds].filter((x) => !keepIds.has(x));
  if (removeIds.length > 0) {
    const { error } = await supabase.from("plan_draft_activities").delete().in("id", removeIds);
    if (error) return { error: error.message };
  }
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    if (a.id && existingIds.has(a.id)) {
      const { error } = await supabase
        .from("plan_draft_activities")
        .update({ name: a.name, budget: a.budget, sort_order: i, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("plan_draft_activities")
        .insert({ draft_project_id: id, name: a.name, budget: a.budget, sort_order: i });
      if (error) return { error: error.message };
    }
  }

  const { error } = await supabase
    .from("plan_draft_projects")
    .update({
      name,
      admin_group_id: input.admin_group_id,
      budget_source_id: input.budget_source_id,
      source_project_id: input.source_project_id,
      budget,
      editing_by: null,
      editing_by_name: null,
      editing_at: null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/fund-allocation");
  return {};
}

// ดึงชื่อกิจกรรมจากโครงการปีก่อนมาเป็นกิจกรรมของร่าง (งบกิจกรรมเริ่มที่ 0 ให้กรอกวงเงินปีนี้เอง) —
// ทำเฉพาะร่างที่ยังไม่มีกิจกรรม ไม่แตะงบโครงการเดิมของร่าง และผูกร่างกับโครงการปีก่อนไว้ด้วย
export async function copyActivitiesFromPrevious(
  budgetYearId: string,
  pairs: { draftId: string; projectId: string }[],
): Promise<{ copied: number; skipped: number; error?: string }> {
  let supabase;
  try {
    supabase = await requireDraftEditor(budgetYearId);
  } catch (e) {
    return { copied: 0, skipped: 0, error: e instanceof Error ? e.message : "ไม่มีสิทธิ์แก้ไข" };
  }
  if (pairs.length === 0) return { copied: 0, skipped: 0 };

  const { data: drafts } = await supabase
    .from("plan_draft_projects")
    .select("id, plan_draft_activities(id)")
    .eq("budget_year_id", budgetYearId)
    .in("id", pairs.map((p) => p.draftId));
  const emptyDraftIds = new Set(
    (drafts ?? []).filter((d) => ((d.plan_draft_activities as unknown as unknown[]) ?? []).length === 0).map((d) => d.id),
  );
  const todo = pairs.filter((p) => emptyDraftIds.has(p.draftId));
  const skipped = pairs.length - todo.length;
  if (todo.length === 0) return { copied: 0, skipped };

  const { data: projects, error: projError } = await supabase
    .from("plan_projects")
    .select("id, plan_activities(name, budget, sort_order)")
    .in("id", todo.map((p) => p.projectId));
  if (projError) return { copied: 0, skipped, error: projError.message };

  const rows = todo.flatMap((p) => {
    const proj = projects?.find((x) => x.id === p.projectId);
    return buildDraftActivityRows(p.draftId, proj?.plan_activities as unknown as PrevActivity[] | undefined, false);
  });
  if (rows.length > 0) {
    const { error } = await supabase.from("plan_draft_activities").insert(rows);
    if (error) return { copied: 0, skipped, error: error.message };
  }
  for (const p of todo) {
    await supabase.from("plan_draft_projects").update({ source_project_id: p.projectId }).eq("id", p.draftId).is("source_project_id", null);
  }
  revalidatePath("/fund-allocation");
  return { copied: new Set(rows.map((r) => r.draft_project_id)).size, skipped };
}

// สร้างร่างโครงการปีนี้จากโครงการปีก่อนที่ยังไม่มีร่าง — ชื่อ/กลุ่ม/แหล่งงบเหมือนเดิม งบและงบกิจกรรมเริ่มที่ 0
// (ให้กรอกวงเงินปีนี้เอง) พร้อมผูกกับโครงการปีก่อนและดึงชื่อกิจกรรมมาให้
export async function createDraftFromProject(budgetYearId: string, projectId: string): Promise<{ error?: string }> {
  let supabase;
  try {
    supabase = await requireDraftEditor(budgetYearId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ไม่มีสิทธิ์แก้ไข" };
  }
  const { data: project, error: projError } = await supabase
    .from("plan_projects")
    .select("id, name, admin_group_id, budget_source_id, plan_activities(name, budget, sort_order)")
    .eq("id", projectId)
    .maybeSingle();
  if (projError || !project) return { error: projError?.message ?? "ไม่พบโครงการปีก่อน" };

  const { data: dup } = await supabase
    .from("plan_draft_projects")
    .select("id")
    .eq("budget_year_id", budgetYearId)
    .eq("source_project_id", projectId)
    .limit(1);
  if (dup && dup.length > 0) return { error: "โครงการนี้มีร่างปีนี้ที่จับคู่ไว้แล้ว" };

  const { data: created, error } = await supabase
    .from("plan_draft_projects")
    .insert({
      budget_year_id: budgetYearId,
      name: project.name,
      admin_group_id: project.admin_group_id,
      budget_source_id: project.budget_source_id,
      source_project_id: project.id,
      budget: 0,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "สร้างร่างโครงการไม่สำเร็จ" };

  const rows = buildDraftActivityRows(created.id, project.plan_activities as unknown as PrevActivity[], false);
  if (rows.length > 0) {
    const { error: actError } = await supabase.from("plan_draft_activities").insert(rows);
    if (actError) return { error: actError.message };
  }
  revalidatePath("/fund-allocation");
  return {};
}
