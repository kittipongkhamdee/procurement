"use server";

// ว.119 ค่าใช้จ่ายบริหารงาน (/supplies/w119) — ตาราง proc_w119_reports + proc_w119_items
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";
import { table1Ref, W119_LIMIT } from "@/lib/w119";

type Result = { error?: string; id?: string };
export type W119ItemInput = { name: string; vendor: string; evidence: string; receipt_book: string; receipt_no: string; receipt_date: string; amount: string };

const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ หรือไม่พบข้อมูล";

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const recordDate = str("record_date");
  const purchaseDate = str("purchase_date");
  if (!str("doc_no")) return { error: "กรุณากรอกเลขที่" };
  if (!purchaseDate) return { error: "กรุณาเลือกวันที่จัดซื้อจัดจ้าง" };
  if (!recordDate) return { error: "กรุณาเลือกวันที่รายงาน" };
  if (recordDate < purchaseDate) return { error: "วันที่รายงานต้องไม่ก่อนวันที่จัดซื้อจัดจ้าง" };
  if (!str("expense_category")) return { error: "กรุณาระบุประเภทค่าใช้จ่าย" };

  let items: W119ItemInput[] = [];
  try {
    items = (JSON.parse(str("items_json") || "[]") as W119ItemInput[]).filter((i) => i.name?.trim());
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (items.length === 0) return { error: "กรุณากรอกรายการอย่างน้อย 1 รายการ" };
  if (items.some((i) => !(Number(i.amount) > 0))) return { error: "จำนวนเงินแต่ละรายการต้องมากกว่า 0" };
  for (const i of items) {
    if (i.receipt_date && i.receipt_date < purchaseDate) return { error: `วันที่หลักฐานของ "${i.name}" ต้องไม่ก่อนวันที่จัดซื้อจัดจ้าง` };
    if (i.receipt_date && i.receipt_date > recordDate) return { error: `วันที่หลักฐานของ "${i.name}" ต้องไม่หลังวันที่รายงาน` };
  }
  // วงเงินจัดซื้อจัดจ้าง "ครั้งหนึ่ง" ไม่เกิน 10,000 บาท — นับรวมต่อผู้ขาย/ผู้รับจ้างหนึ่งราย
  const byVendor = new Map<string, number>();
  items.forEach((i) => {
    const k = i.vendor.trim() || i.name.trim();
    byVendor.set(k, (byVendor.get(k) ?? 0) + Number(i.amount));
  });
  for (const [vendor, sum] of byVendor) {
    if (sum > W119_LIMIT + 0.005) return { error: `จัดซื้อจัดจ้างจาก "${vendor}" รวม ${sum.toLocaleString("th-TH")} บาท เกินวงเงิน ว.119 (ครั้งละไม่เกิน 10,000 บาท) — ต้องจัดซื้อจัดจ้างตามวิธีปกติ` };
  }
  const amount = Math.round(items.reduce((s, i) => s + Number(i.amount), 0) * 100) / 100;
  return {
    fields: {
      doc_no: str("doc_no"),
      record_date: recordDate,
      purchase_date: purchaseDate,
      admin_group: str("admin_group") || null,
      project_id: str("project_id") || null,
      activity_id: str("activity_id") || null,
      purpose: str("purpose") || null,
      expense_category: str("expense_category"),
      table_ref: table1Ref(str("expense_category")) ?? (str("table_ref") || null),
      responsible_name: str("responsible_name") || null,
      responsible_position: str("responsible_position") || null,
      payment_method: str("payment_method") === "transfer" ? "transfer" : "cash",
      fund_source: str("fund_source") || null,
      amount,
    },
    items,
  };
}

async function replaceItems(supabase: Awaited<ReturnType<typeof createClient>>, reportId: string, items: W119ItemInput[]) {
  const { error: delError } = await supabase.from("proc_w119_items").delete().eq("report_id", reportId);
  if (delError) return delError.message;
  const { error } = await supabase.from("proc_w119_items").insert(
    items.map((i, idx) => ({
      report_id: reportId,
      seq: idx + 1,
      name: i.name.trim(),
      vendor: i.vendor.trim() || null,
      evidence: i.evidence.trim() || null,
      receipt_book: i.receipt_book.trim() || null,
      receipt_no: i.receipt_no.trim() || null,
      receipt_date: i.receipt_date || null,
      amount: Number(i.amount),
    })),
  );
  return error?.message ?? null;
}

function done(id?: string): Result {
  revalidatePath("/supplies/w119");
  return id ? { id } : {};
}

export async function createW119(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("proc_w119_reports")
    .insert({ ...parsed.fields, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const itemError = await replaceItems(supabase, data.id, parsed.items);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return done(data.id);
}

export async function updateW119(id: string, formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_w119_reports").update(parsed.fields).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  const itemError = await replaceItems(supabase, id, parsed.items);
  if (itemError) return { error: `บันทึกแล้ว แต่บันทึกรายการไม่สำเร็จ: ${itemError}` };
  return done();
}

export async function deleteW119(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: photos } = await supabase.from("proc_w119_photos").select("file_ref").eq("report_id", id);
  const { data, error } = await supabase.from("proc_w119_reports").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  await Promise.all((photos ?? []).map((p) => deleteFromStorage(supabase, p.file_ref, "procurement-files").catch(() => {})));
  return done();
}

// ---- รูปอ้างอิง (ใบเสร็จ/บิลเงินสด/ใบสำคัญรับเงิน/สำเนาบัตร/สลิปโอน/ภาพกิจกรรม) ----

export async function addW119Photos(reportId: string, photos: { category: string; ref: string }[]): Promise<Result> {
  const valid = photos.filter((p) => p.category.trim() && (/^gdrive:[\w-]+$/.test(p.ref) || /^procurement-photos\/[\w.-]+$/.test(p.ref)));
  if (valid.length === 0) return { error: "ไม่มีรูปที่บันทึกได้" };
  const supabase = await createClient();
  const { error } = await supabase.from("proc_w119_photos").insert(valid.map((p) => ({ report_id: reportId, category: p.category.trim(), file_ref: p.ref })));
  if (error) {
    await Promise.all(valid.map((p) => deleteFromStorage(supabase, p.ref, "procurement-files").catch(() => {})));
    return { error: error.message };
  }
  return done();
}

export async function deleteW119Photo(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_w119_photos").delete().eq("id", id).select("file_ref");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  await deleteFromStorage(supabase, data[0].file_ref, "procurement-files").catch(() => {});
  return done();
}
