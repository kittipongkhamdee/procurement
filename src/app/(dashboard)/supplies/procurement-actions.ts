"use server";

// งานซื้อ / งานจ้าง (/supplies/purchase, /supplies/hire) — ใช้ตาราง proc_purchase_requests ชุดเดียวกับ "รายการขอซื้อ-ขอจ้าง"
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; id?: string };
type ItemInput = { name: string; qty: string; unit: string; unitPrice: string };

const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";

function daysInclusive(from: string, to: string) {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1);
}

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const docType = str("doc_type") === "จ้าง" ? "จ้าง" : "ซื้อ";
  const recordDate = str("record_date");
  const deliveryDate = str("delivery_date");
  if (!str("doc_no")) return { error: "กรุณากรอกเลขที่" };
  if (!recordDate) return { error: "กรุณาเลือกวันที่บันทึกข้อความ" };
  if (!deliveryDate) return { error: "กรุณาเลือกวันครบกำหนดส่งมอบ" };
  if (deliveryDate < recordDate) return { error: "วันครบกำหนดส่งมอบต้องไม่ก่อนวันที่บันทึกข้อความ" };
  if (!str("item_name")) return { error: `กรุณากรอกชื่อพัสดุ/งานที่จะ${docType}` };

  let items: ItemInput[] = [];
  try {
    items = (JSON.parse(str("items_json") || "[]") as ItemInput[]).filter((i) => i.name?.trim());
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (items.length === 0) return { error: "กรุณากรอกรายการอย่างน้อย 1 รายการ" };
  const amount = Math.round(items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0) * 100) / 100;
  if (!(amount > 0)) return { error: "ยอดรวมรายการต้องมากกว่า 0" };

  const penalty = str("penalty_rate");
  return {
    fields: {
      doc_type: docType as "ซื้อ" | "จ้าง",
      doc_no: str("doc_no"),
      record_date: recordDate,
      delivery_date: deliveryDate,
      work_days: daysInclusive(recordDate, deliveryDate),
      admin_group: str("admin_group") || null,
      project_id: str("project_id") || null,
      activity_id: str("activity_id") || null,
      item_name: str("item_name"),
      reason: str("reason") || null,
      detail: str("detail") || null,
      vendor_id: str("vendor_id") || null,
      inspector_name: str("inspector_name") || null,
      inspector_position: str("inspector_position") || null,
      penalty_rate: penalty ? Number(penalty) : null,
      order_signer: str("order_signer") === "director" ? "director" : "head",
      amount,
    },
    items,
  };
}

async function replaceItems(supabase: Awaited<ReturnType<typeof createClient>>, requestId: string, items: ItemInput[]) {
  const { error: delError } = await supabase.from("proc_purchase_items").delete().eq("purchase_request_id", requestId);
  if (delError) return delError.message;
  const { error } = await supabase.from("proc_purchase_items").insert(
    items.map((i, idx) => ({
      purchase_request_id: requestId,
      seq: idx + 1,
      name: i.name.trim(),
      qty: i.qty ? Number(i.qty) : null,
      unit: i.unit?.trim() || null,
      unit_price: i.unitPrice ? Number(i.unitPrice) : null,
    })),
  );
  return error?.message ?? null;
}

/** จำตำแหน่งผู้ตรวจรับไว้กับชื่อครู ให้ฟอร์มครั้งต่อไปเติมให้อัตโนมัติ (บันทึกไม่สำเร็จก็ไม่กระทบรายการหลัก) */
async function rememberPosition(supabase: Awaited<ReturnType<typeof createClient>>, name: string | null, position: string | null) {
  if (!name || !position) return;
  await supabase.from("proc_teacher_positions").upsert({ teacher_name: name, position, updated_at: new Date().toISOString() });
}

function done(id?: string): Result {
  revalidatePath("/supplies/purchase");
  revalidatePath("/supplies/hire");
  revalidatePath("/purchase-requests");
  return id ? { id } : {};
}

export async function createProcurement(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("proc_purchase_requests")
    .insert({ ...parsed.fields, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const itemError = await replaceItems(supabase, data.id, parsed.items);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  await rememberPosition(supabase, parsed.fields.inspector_name, parsed.fields.inspector_position);
  return done(data.id);
}

export async function updateProcurement(id: string, formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  // แก้ไขแล้ว PDF ที่เคยเก็บไว้ (pdf_url) ไม่ตรงข้อมูลใหม่ — ล้างทิ้ง ให้สร้างสดจาก route แทน
  const { data, error } = await supabase
    .from("proc_purchase_requests")
    .update({ ...parsed.fields, pdf_url: null })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  const itemError = await replaceItems(supabase, id, parsed.items);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  await rememberPosition(supabase, parsed.fields.inspector_name, parsed.fields.inspector_position);
  return done();
}

export async function deleteProcurement(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_purchase_requests").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  return done();
}
