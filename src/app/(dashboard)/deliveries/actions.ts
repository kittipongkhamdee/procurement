"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { thaiBahtText } from "@/lib/thai";

// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action
type Result = { error?: string };

function text(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? Number(raw) : null;
}

function deliveryFields(formData: FormData): { error: string } | { fields: Record<string, unknown> } {
  const contractId = text(formData, "contract_id");
  const deliveryDate = text(formData, "delivery_date");
  const amount = num(formData, "amount");
  if (!contractId) return { error: "กรุณาเลือกสัญญา" };
  if (!deliveryDate) return { error: "กรุณาเลือกวันที่ส่งมอบ" };
  if (!(amount && amount > 0)) return { error: "จำนวนเงินที่ส่งมอบต้องมากกว่า 0" };
  // งวดเดือน (YYYY-MM) — ไม่ระบุใช้เดือนของวันที่ส่งมอบ
  const periodRaw = text(formData, "period_month");
  const period = periodRaw && /^\d{4}-\d{2}$/.test(periodRaw) ? periodRaw : deliveryDate.slice(0, 7);
  const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return {
    fields: {
      contract_id: contractId,
      installment_no: num(formData, "installment_no"),
      delivery_date: deliveryDate,
      period_month: `${period}-01`,
      delivery_month: months[Number(period.slice(5, 7)) - 1] ?? null,
      amount,
      amount_text: thaiBahtText(amount),
      late_days: num(formData, "late_days"),
      penalty_amount: num(formData, "penalty_amount"),
      withholding_tax: num(formData, "withholding_tax"),
      inspector_name: text(formData, "inspector_name"),
      note: text(formData, "note"),
    },
  };
}

function done(): Result {
  revalidatePath("/contracts/delivery");
  return {};
}

export async function createDelivery(formData: FormData): Promise<Result> {
  const parsed = deliveryFields(formData);
  if ("error" in parsed) return parsed;
  const supabase = await createClient();
  const { error } = await supabase.from("proc_deliveries").insert(parsed.fields as never);
  return error ? { error: error.message } : done();
}

export async function updateDelivery(id: string, formData: FormData): Promise<Result> {
  const parsed = deliveryFields(formData);
  if ("error" in parsed) return parsed;
  const supabase = await createClient();
  const { error } = await supabase.from("proc_deliveries").update(parsed.fields as never).eq("id", id);
  return error ? { error: error.message } : done();
}

export async function deleteDelivery(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_deliveries").delete().eq("id", id);
  return error ? { error: error.message } : done();
}
