"use server";

// ส่งรายการที่ติ๊กเป็น "ครุภัณฑ์" จากรายการจัดซื้อ (งานซื้อ/จ้าง/ว 804, ว 119, เร่งด่วน) เข้าทะเบียนคุมทรัพย์สิน
// 1 หน่วย = 1 รายการในทะเบียน (แต่ละชิ้นมีรหัสครุภัณฑ์ของตัวเอง) สถานะ "รอตรวจสอบ" — เจ้าหน้าที่พัสดุเข้าไประบุ
// อาคาร/ห้อง หมวดหมู่ ชนิด รหัสครุภัณฑ์ แล้วกดอนุมัติที่แท็บ "จัดการทรัพย์สิน" — ดึงซ้ำไม่ได้ (ผูก source_type/id/seq)

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadProcurementSource, PROCUREMENT_SOURCE_LABEL, type ProcurementSourceType } from "@/lib/procurement-source";

type Result = { error?: string; message?: string };
const PENDING_LOCATION = "ยังไม่ระบุ";
const MAX_UNITS_PER_ITEM = 100;

export async function importAssetsFromProcurement(type: ProcurementSourceType, id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("proc_profiles").select("role").eq("user_id", user?.id ?? "").maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "supply_officer") return { error: "เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่พัสดุเท่านั้น" };

  const src = await loadProcurementSource(supabase, type, id, "equipment");
  if (!src) return { error: "ไม่พบรายการจัดซื้อ" };
  if (src.items.length === 0) return { error: "เอกสารนี้ไม่มีรายการที่ติ๊กเป็นครุภัณฑ์" };
  const { data: existing } = await supabase.from("asset_items").select("source_seq").eq("source_type", type).eq("source_id", id);
  const imported = new Set((existing ?? []).map((r) => r.source_seq));
  const todo = src.items.filter((i) => !imported.has(i.seq));
  if (todo.length === 0) return { error: "ส่งครุภัณฑ์ของเอกสารนี้เข้าทะเบียนครบแล้ว" };

  const [{ data: rounds }, { data: conditions }, { data: methods }, { data: budgets }] = await Promise.all([
    supabase.from("asset_survey_rounds").select("id, is_open, year").order("year", { ascending: false }),
    supabase.from("asset_conditions").select("id, name").eq("is_active", true),
    supabase.from("asset_acquisition_methods").select("id, name").eq("is_active", true),
    supabase.from("asset_budget_sources").select("id, name").eq("is_active", true),
  ]);
  const round = rounds?.find((r) => r.is_open) ?? rounds?.[0];
  if (!round) return { error: "ยังไม่มีรอบสำรวจทรัพย์สิน — สร้างที่แท็บ \"รอบสำรวจ\" ก่อน" };
  const condition = conditions?.find((c) => c.name.includes("ใช้งานได้")) ?? conditions?.[0];
  if (!condition) return { error: "ยังไม่ได้ตั้งค่าสภาพครุภัณฑ์ (แท็บข้อมูลหลัก)" };
  const method = methods?.find((m) => m.name.includes("เฉพาะเจาะจง"));
  const budget = src.fund_source ? budgets?.find((b) => b.name === src.fund_source || b.name.includes(src.fund_source!)) : undefined;

  const rows = todo.flatMap((it) => {
    const units = Number.isInteger(it.qty) && it.qty >= 1 && it.qty <= MAX_UNITS_PER_ITEM ? it.qty : 1;
    const perRowQty = units === it.qty ? 1 : Math.max(1, Math.round(it.qty));
    return Array.from({ length: units }, (_, n) => ({
      round_id: round.id,
      building: PENDING_LOCATION,
      room: PENDING_LOCATION,
      name: it.name,
      quantity: perRowQty,
      unit: it.unit,
      price: it.unit_price || null,
      acquired_date: src.date,
      acquired_year: Number(src.date.slice(0, 4)) + 543,
      vendor_name: it.party,
      vendor_address: src.vendor_address,
      vendor_phone: src.vendor_phone,
      acquisition_method_id: method?.id ?? null,
      budget_source_id: budget?.id ?? null,
      doc_ref: src.doc_no,
      condition_id: condition.id,
      note: `นำเข้าจาก${PROCUREMENT_SOURCE_LABEL[type]} ${src.doc_no}${units > 1 ? ` (ชิ้นที่ ${n + 1}/${units})` : ""}`,
      status: "submitted" as const,
      surveyed_by: user?.id ?? null,
      source_type: type,
      source_id: id,
      source_seq: it.seq,
    }));
  });
  const { error } = await supabase.from("asset_items").insert(rows);
  if (error) return { error: error.message.includes("row-level") ? "ไม่มีสิทธิ์เพิ่มรายการในทะเบียนคุมทรัพย์สิน" : error.message };
  revalidatePath("/asset-register");
  return { message: `ส่งครุภัณฑ์เข้าทะเบียนแล้ว ${rows.length} รายการ (${todo.map((t) => `${t.name} ${t.qty.toLocaleString("th-TH")} ${t.unit}`).join(", ")})` };
}
