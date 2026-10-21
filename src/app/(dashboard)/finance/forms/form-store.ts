// แบบฟอร์มการเงิน — บันทึก/ลบจากเบราว์เซอร์ตรงเข้าฐานข้อมูล (สิทธิ์บังคับด้วย RLS: ครูสร้างได้ แก้/ลบได้เฉพาะของตัวเอง
// เจ้าหน้าที่การเงิน/แอดมินแก้ได้ทุกฉบับ) — เดิมผ่าน server action แต่ผู้ใช้กดบันทึกแล้วข้อมูลไม่ถึงฐานข้อมูล (ต.ค. 2569)
// ใบสำคัญรับเงิน (วิทยากร/นักเรียน) อยู่ fin_receipt_forms, รายงานการเดินทางไปราชการ (แบบ 8708) อยู่ fin_travel_forms

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

export type FormKind = "speaker" | "student" | "travel";
type Result = { error?: string; id?: string };
const NO_RIGHT = "ไม่มีสิทธิ์ — แก้ไข/ลบได้เฉพาะผู้สร้าง หรือเจ้าหน้าที่การเงิน";

export async function saveReceiptForm(id: string | null, kind: FormKind, title: string, data: unknown): Promise<Result> {
  const supabase = createClient();
  const fields = { title: title.trim().slice(0, 300), data: data as Json, updated_at: new Date().toISOString() };
  if (id) {
    const q = kind === "travel" ? supabase.from("fin_travel_forms").update(fields) : supabase.from("fin_receipt_forms").update(fields);
    const { data: rows, error } = await q.eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!rows?.length) return { error: NO_RIGHT };
    return { id };
  }
  const { data: row, error } =
    kind === "travel"
      ? await supabase.from("fin_travel_forms").insert(fields).select("id").single()
      : await supabase.from("fin_receipt_forms").insert({ ...fields, kind }).select("id").single();
  if (error) return { error: error.message.includes("row-level") ? "บันทึกไม่ได้ — กรุณาเข้าสู่ระบบใหม่" : error.message };
  return { id: row.id };
}

export async function deleteReceiptForm(id: string, kind: FormKind): Promise<Result> {
  const supabase = createClient();
  const { data, error } = kind === "travel" ? await supabase.from("fin_travel_forms").delete().eq("id", id).select("id") : await supabase.from("fin_receipt_forms").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_RIGHT };
  return {};
}
