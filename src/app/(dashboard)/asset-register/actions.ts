"use server";

// Server actions สำหรับ "ทะเบียนคุมทรัพย์สิน" — เชื่อมกับ schema asset_* ที่มีอยู่แล้วในฐานข้อมูล
// เดียวกัน (ใช้โดยระบบสำรวจทรัพย์สินแยกต่างหากมาก่อน) requireAssetStaff() เช็คสิทธิ์จาก
// proc_profiles ของแอปนี้ (admin/เจ้าหน้าที่พัสดุ) — RLS ฝั่งฐานข้อมูล (asset_is_staff()) ถูกแก้ให้
// รับรู้ proc_profiles กลุ่มนี้แล้วเช่นกัน (ดู migration widen_asset_is_staff_to_procurement_staff)

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/asset-register";

async function requireAssetStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "supply_officer") {
    throw new Error("เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่พัสดุเท่านั้น");
  }
  return { supabase, userId: user?.id ?? null };
}

// ---------------- asset_items ----------------

export async function upsertAssetItem(id: string | null, formData: FormData) {
  const { supabase, userId } = await requireAssetStaff();

  const round_id = String(formData.get("round_id") ?? "");
  const building = String(formData.get("building") ?? "").trim();
  const room = String(formData.get("room") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!round_id || !building || !room || !name) {
    throw new Error("กรอกข้อมูลให้ครบ (รอบสำรวจ/อาคาร/ห้อง/ชื่อทรัพย์สิน)");
  }

  // ฟอร์มให้กรอกวัน/เดือน/ปี พ.ศ. แยก 3 ช่อง (ไม่ใช้ input type="date" ตัวเดียว เพราะปฏิทินเบราว์เซอร์
  // ส่วนใหญ่แสดง ค.ศ.) แปลงเป็น ISO date (ค.ศ.) ก่อนเก็บลงคอลัมน์ acquired_date
  const acquiredDay = Number(formData.get("acquired_day") ?? "");
  const acquiredMonth = Number(formData.get("acquired_month") ?? "");
  const acquiredYearBE = Number(formData.get("acquired_year_be") ?? "");
  const hasAcquiredDate = acquiredDay > 0 && acquiredMonth > 0 && acquiredYearBE > 0;
  const acquiredDateIso = hasAcquiredDate
    ? `${acquiredYearBE - 543}-${String(acquiredMonth).padStart(2, "0")}-${String(acquiredDay).padStart(2, "0")}`
    : null;

  const payload = {
    round_id,
    building,
    floor: String(formData.get("floor") ?? "").trim() || null,
    room,
    category_id: String(formData.get("category_id") ?? "") || null,
    name,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    unit: String(formData.get("unit") ?? "").trim() || null,
    asset_code: String(formData.get("asset_code") ?? "").trim() || null,
    condition: String(formData.get("condition") ?? "usable") as "usable" | "damaged" | "disposal",
    note: String(formData.get("note") ?? "").trim() || null,
    acquired_date: acquiredDateIso,
    // เก็บปี พ.ศ. แยกไว้ด้วยเพื่อความเข้ากันได้ย้อนหลัง (ใช้อ้างอิงกับข้อมูลเก่าที่มีแต่ปี ไม่มีวันที่เต็ม)
    acquired_year: hasAcquiredDate ? acquiredYearBE : null,
    budget_source_id: String(formData.get("budget_source_id") ?? "") || null,
    price: formData.get("price") ? Number(formData.get("price")) : null,
    vendor_name: String(formData.get("vendor_name") ?? "").trim() || null,
    vendor_address: String(formData.get("vendor_address") ?? "").trim() || null,
    vendor_phone: String(formData.get("vendor_phone") ?? "").trim() || null,
    acquisition_method: String(formData.get("acquisition_method") ?? "").trim() || null,
    model: String(formData.get("model") ?? "").trim() || null,
    spec: String(formData.get("spec") ?? "").trim() || null,
  };

  if (id) {
    const { error } = await supabase.from("asset_items").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    // รายการที่เจ้าหน้าที่พัสดุพิมพ์เพิ่มเองในทะเบียนโดยตรง (ไม่ผ่านฟอร์มสำรวจสาธารณะ) ถือว่า
    // ผ่านการตรวจสอบแล้วในตัว จึงตั้งสถานะ "อนุมัติ" ทันที ไม่ต้องรอ submitted → อนุมัติซ้ำอีกรอบ
    const { error } = await supabase.from("asset_items").insert({
      ...payload,
      status: "approved",
      surveyed_by: userId,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath(PATH);
}

export async function updateAssetItemStatus(
  id: string,
  decision: "approved" | "rejected",
  rejectReason?: string,
) {
  const { supabase, userId } = await requireAssetStaff();
  if (decision === "rejected" && !rejectReason?.trim()) {
    throw new Error("กรุณาระบุเหตุผลที่ไม่อนุมัติ");
  }
  const { error } = await supabase
    .from("asset_items")
    .update({
      status: decision,
      reject_reason: decision === "rejected" ? rejectReason!.trim() : null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetItem(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- asset_categories ----------------

export async function createAssetCategory(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const useful_life_years = formData.get("useful_life_years") ? Number(formData.get("useful_life_years")) : null;
  const depreciation_rate_percent = formData.get("depreciation_rate_percent")
    ? Number(formData.get("depreciation_rate_percent"))
    : null;
  const { error } = await supabase
    .from("asset_categories")
    .insert({ name, useful_life_years, depreciation_rate_percent });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetCategory(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const useful_life_years = formData.get("useful_life_years") ? Number(formData.get("useful_life_years")) : null;
  const depreciation_rate_percent = formData.get("depreciation_rate_percent")
    ? Number(formData.get("depreciation_rate_percent"))
    : null;
  const { error } = await supabase
    .from("asset_categories")
    .update({ name, useful_life_years, depreciation_rate_percent })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetCategoryActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_categories").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetCategory(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- asset_buildings ----------------

export async function createAssetBuilding(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_buildings").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetBuildingName(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_buildings").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetBuildingActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_buildings").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetBuilding(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_buildings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- asset_units ----------------

export async function createAssetUnit(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_units").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetUnitName(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_units").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetUnitActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_units").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetUnit(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_units").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- asset_budget_sources ----------------

export async function createAssetBudgetSource(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_budget_sources").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetBudgetSourceName(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_budget_sources").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetBudgetSourceActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_budget_sources").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetBudgetSource(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_budget_sources").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- asset_survey_rounds ----------------

export async function createSurveyRound(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const year = Number(formData.get("year"));
  const name = String(formData.get("name") ?? "").trim();
  if (!year || !name) throw new Error("กรอกปีและชื่อรอบสำรวจให้ครบ");
  const { error } = await supabase.from("asset_survey_rounds").insert({ year, name, is_open: true });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleSurveyRoundOpen(id: string, isOpen: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_survey_rounds").update({ is_open: !isOpen }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
