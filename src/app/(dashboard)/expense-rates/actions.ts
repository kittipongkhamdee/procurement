"use server";

// อัตราค่าใช้จ่ายตามระเบียบ (proc_expense_rates) — เจ้าหน้าที่พัสดุ/แอดมินเพิ่ม แก้ไข ลบได้ (RLS proc_is_staff) ครูทุกคนดูได้
// คืน { error } แทนการ throw

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CLAIM_KINDS } from "@/lib/expense-claims";

type Result = { error?: string };
const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const kind = str("kind");
  if (!(kind in CLAIM_KINDS)) return { error: "กรุณาเลือกประเภทรายการ" };
  if (!str("name")) return { error: "กรุณากรอกชื่ออัตรา" };
  const max = Number(str("max_rate"));
  if (!(max > 0)) return { error: "อัตราสูงสุดต้องมากกว่า 0" };
  return {
    fields: {
      kind,
      name: str("name"),
      max_rate: max,
      unit_note: str("unit_note") || null,
      note: str("note") || null,
      source: str("source") || null,
      sort_order: Number(str("sort_order")) || 0,
      is_active: formData.get("is_active") === "on",
    },
  };
}

function done(): Result {
  revalidatePath("/expense-rates");
  return {};
}

export async function createExpenseRate(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_expense_rates").insert(parsed.fields).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}

export async function updateExpenseRate(id: string, formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_expense_rates").update(parsed.fields).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}

export async function deleteExpenseRate(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_expense_rates").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}
