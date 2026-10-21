"use server";

// แบบฟอร์มการเงิน — ใบสำคัญรับเงิน (วิทยากร / นักเรียน) ที่ครูบันทึกเก็บไว้ (fin_receipt_forms)
// ครูทุกคนสร้างได้ แก้/ลบได้เฉพาะของตัวเอง (เจ้าหน้าที่การเงิน/แอดมินแก้ได้ทุกฉบับ) — RLS เป็นตัวบังคับ

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type Result = { error?: string; id?: string };
const NO_RIGHT = "ไม่มีสิทธิ์ — แก้ไข/ลบได้เฉพาะผู้สร้าง หรือเจ้าหน้าที่การเงิน";

export async function saveReceiptForm(id: string | null, kind: "speaker" | "student", title: string, data: unknown): Promise<Result> {
  const supabase = await createClient();
  if (kind !== "speaker" && kind !== "student") return { error: "ไม่รู้จักแบบฟอร์ม" };
  const fields = { kind, title: title.trim().slice(0, 300), data: data as Json, updated_at: new Date().toISOString() };
  if (id) {
    const { data: rows, error } = await supabase.from("fin_receipt_forms").update(fields).eq("id", id).select("id");
    if (error) return { error: error.message };
    if (!rows?.length) return { error: NO_RIGHT };
    revalidatePath(`/finance/forms/${kind}`);
    return { id };
  }
  const { data: row, error } = await supabase.from("fin_receipt_forms").insert(fields).select("id").single();
  if (error) return { error: error.message };
  revalidatePath(`/finance/forms/${kind}`);
  return { id: row.id };
}

export async function deleteReceiptForm(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("fin_receipt_forms").delete().eq("id", id).select("id, kind");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_RIGHT };
  revalidatePath(`/finance/forms/${data[0].kind}`);
  return {};
}
