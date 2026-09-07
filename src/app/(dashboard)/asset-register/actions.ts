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

  // <ThaiDatePicker> (@/components/thai-date-picker) ส่งค่ามาเป็น ISO date (ค.ศ.) ผ่าน hidden input
  // ชื่อ acquired_date อยู่แล้ว (แสดงผลเป็น พ.ศ. ในฟอร์ม แต่เก็บ ค.ศ. ให้ตรงกับคอลัมน์ date)
  const acquiredDateRaw = String(formData.get("acquired_date") ?? "").trim();
  const acquiredDateIso = acquiredDateRaw || null;
  const acquiredYearBE = acquiredDateIso ? Number(acquiredDateIso.slice(0, 4)) + 543 : null;

  const payload = {
    round_id,
    building,
    floor: String(formData.get("floor") ?? "").trim() || null,
    room,
    category_id: String(formData.get("category_id") ?? "") || null,
    item_type_id: String(formData.get("item_type_id") ?? "") || null,
    name,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    unit: String(formData.get("unit") ?? "").trim() || null,
    asset_code: String(formData.get("asset_code") ?? "").trim() || null,
    sequence_no: String(formData.get("sequence_no") ?? "").trim() || null,
    condition: String(formData.get("condition") ?? "usable") as "usable" | "damaged" | "disposal",
    note: String(formData.get("note") ?? "").trim() || null,
    acquired_date: acquiredDateIso,
    // เก็บปี พ.ศ. แยกไว้ด้วยเพื่อความเข้ากันได้ย้อนหลัง (ใช้อ้างอิงกับข้อมูลเก่าที่มีแต่ปี ไม่มีวันที่เต็ม)
    acquired_year: acquiredYearBE,
    budget_source_id: String(formData.get("budget_source_id") ?? "") || null,
    price: formData.get("price") ? Number(formData.get("price")) : null,
    vendor_name: String(formData.get("vendor_name") ?? "").trim() || null,
    vendor_address: String(formData.get("vendor_address") ?? "").trim() || null,
    vendor_phone: String(formData.get("vendor_phone") ?? "").trim() || null,
    acquisition_method_id: String(formData.get("acquisition_method_id") ?? "") || null,
    model: String(formData.get("model") ?? "").trim() || null,
    spec: String(formData.get("spec") ?? "").trim() || null,
  };

  // ช่องรูปภาพในฟอร์มเป็น "photo_path" เฉพาะเมื่อผู้ใช้เพิ่ม/เปลี่ยน/ลบรูปจริงเท่านั้น (ไม่มี key นี้
  // เลยแปลว่าไม่ได้แตะรูปเดิม) — ค่าว่างหมายถึงลบรูปออก ส่วนพาธใหม่มาจากการอัปโหลดผ่าน
  // /api/asset-photo-upload แล้วล่วงหน้า ต้องลบไฟล์เก่าออกจาก storage ด้วยเมื่อมีการเปลี่ยน/ลบ
  const photoPathRaw = formData.get("photo_path");
  const photoPathChanged = photoPathRaw !== null;
  const newPhotoPath = photoPathChanged ? String(photoPathRaw).trim() || null : undefined;
  let oldPhotoPath: string | null = null;
  if (id && photoPathChanged) {
    const { data: existing } = await supabase.from("asset_items").select("photo_path").eq("id", id).maybeSingle();
    oldPhotoPath = existing?.photo_path ?? null;
  }

  if (id) {
    const { error } = await supabase
      .from("asset_items")
      .update(photoPathChanged ? { ...payload, photo_path: newPhotoPath } : payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (oldPhotoPath && oldPhotoPath !== newPhotoPath) {
      await supabase.storage.from("asset-photos").remove([oldPhotoPath]);
    }
  } else {
    // รายการที่เจ้าหน้าที่พัสดุพิมพ์เพิ่มเองในทะเบียนโดยตรง (ไม่ผ่านฟอร์มสำรวจสาธารณะ) ถือว่า
    // ผ่านการตรวจสอบแล้วในตัว จึงตั้งสถานะ "อนุมัติ" ทันที ไม่ต้องรอ submitted → อนุมัติซ้ำอีกรอบ
    const { error } = await supabase.from("asset_items").insert({
      ...payload,
      photo_path: newPhotoPath || null,
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
  const { data: existing } = await supabase.from("asset_items").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("asset_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (existing?.photo_path) {
    await supabase.storage.from("asset-photos").remove([existing.photo_path]);
  }
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
  const type_code = String(formData.get("type_code") ?? "").trim() || null;
  const { error } = await supabase
    .from("asset_categories")
    .insert({ name, useful_life_years, depreciation_rate_percent, type_code });
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
  const type_code = String(formData.get("type_code") ?? "").trim() || null;
  const { error } = await supabase
    .from("asset_categories")
    .update({ name, useful_life_years, depreciation_rate_percent, type_code })
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

// ---------------- asset_item_types (ชนิดครุภัณฑ์ ใต้แต่ละหมวดหมู่ — ใช้กำหนดรหัสชนิด 2 หลักหลังจุด
// ตอนสร้างเลขครุภัณฑ์อัตโนมัติ เช่น "โต๊ะทำงาน"=01, "เก้าอี้"=02 ในหมวดหมู่เดียวกัน) ----------------

export async function createAssetItemType(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const category_id = String(formData.get("category_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!category_id || !name || !code) throw new Error("กรอกหมวดหมู่ ชื่อ และรหัสชนิดให้ครบ");
  const { error } = await supabase.from("asset_item_types").insert({ category_id, name, code });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetItemType(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!name || !code) throw new Error("กรอกชื่อและรหัสชนิดให้ครบ");
  const { error } = await supabase.from("asset_item_types").update({ name, code }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetItemTypeActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_item_types").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetItemType(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_item_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

// ---------------- กำหนดเลขครุภัณฑ์อัตโนมัติ ----------------
// รูปแบบ: [อักษรย่อโรงเรียน] [รหัสประเภท].[รหัสชนิด] / [เลขลำดับ 3 หลัก] / [ปีงบประมาณ พ.ศ. 2 หลักท้าย]
// เช่น "ต.บ.ว. 20.01 / 005 / 69" — เลขลำดับนับแยกตามหมวดหมู่+ชนิด+ปีงบประมาณ (ปีของ acquired_date
// ที่เลือกในฟอร์ม ถ้ายังไม่เลือกใช้ปีงบประมาณปัจจุบัน) เริ่มนับ 001 ใหม่ทุกปีงบประมาณ
export async function generateAssetCode(
  categoryId: string,
  itemTypeId: string,
  acquiredDateIso: string | null,
): Promise<string> {
  const { supabase } = await requireAssetStaff();

  const [{ data: category }, { data: itemType }, { data: settings }] = await Promise.all([
    supabase.from("asset_categories").select("type_code").eq("id", categoryId).maybeSingle(),
    supabase.from("asset_item_types").select("code").eq("id", itemTypeId).maybeSingle(),
    supabase.from("proc_school_settings").select("asset_code_prefix").eq("id", true).maybeSingle(),
  ]);

  if (!category?.type_code) throw new Error("หมวดหมู่นี้ยังไม่ได้ตั้งรหัสประเภท (ไปตั้งค่าที่แท็บข้อมูลหลัก)");
  if (!itemType?.code) throw new Error("ชนิดครุภัณฑ์นี้ยังไม่ได้ตั้งรหัสชนิด (ไปตั้งค่าที่แท็บข้อมูลหลัก)");
  if (!settings?.asset_code_prefix) throw new Error("ยังไม่ได้ตั้งอักษรย่อโรงเรียน (ไปตั้งค่าที่หน้าตั้งค่าระบบ)");

  const yearBE = acquiredDateIso ? Number(acquiredDateIso.slice(0, 4)) + 543 : new Date().getFullYear() + 543;
  const yy = String(yearBE % 100).padStart(2, "0");

  const { count } = await supabase
    .from("asset_items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("item_type_id", itemTypeId)
    .eq("acquired_year", yearBE);

  const seq = String((count ?? 0) + 1).padStart(3, "0");

  return `${settings.asset_code_prefix} ${category.type_code}.${itemType.code} / ${seq} / ${yy}`;
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

// ---------------- asset_acquisition_methods ----------------

export async function createAssetAcquisitionMethod(formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_acquisition_methods").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function updateAssetAcquisitionMethodName(id: string, formData: FormData) {
  const { supabase } = await requireAssetStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const { error } = await supabase.from("asset_acquisition_methods").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function toggleAssetAcquisitionMethodActive(id: string, isActive: boolean) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_acquisition_methods").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function deleteAssetAcquisitionMethod(id: string) {
  const { supabase } = await requireAssetStaff();
  const { error } = await supabase.from("asset_acquisition_methods").delete().eq("id", id);
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
