"use server";

// งานซื้อ / งานจ้าง (/supplies/purchase, /supplies/hire) — ใช้ตาราง proc_purchase_requests ชุดเดียวกับ "รายการขอซื้อ-ขอจ้าง"
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage } from "@/lib/storage";

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
  if (str("method") === "w804" && (docType !== "ซื้อ" || amount > 50000)) return { error: "ซื้อตาม ว.804 ได้เฉพาะงานซื้อ ครั้งละไม่เกิน 50,000 บาท" };

  const approvalId = str("approval_id");
  if (!approvalId) return { error: "กรุณาเลือกบันทึกขออนุมัติที่อ้างอิง" };
  const penalty = str("penalty_rate");
  // วันแต่ละขั้นตอน (ไม่บังคับ) — ไม่กรอก PDF จะใช้วันตามขั้นก่อนหน้าแทน
  const orderDate = str("order_date") || null;
  const deliveredDate = str("delivered_date") || null;
  const inspectedDate = str("inspected_date") || null;
  const reportDate = str("report_date") || null;
  // ลำดับวันต้องไม่ย้อนกัน: บันทึกขอ ≤ สั่งซื้อ/สั่งจ้าง ≤ ส่งของ/ส่งมอบงาน ≤ ตรวจรับ ≤ รายงานผล
  // (ช่องที่ไม่กรอกข้ามไป เทียบกับวันก่อนหน้าที่มี) — วันขออนุมัติตรวจใน checkApproval
  const deliverLabel = docType === "จ้าง" ? "วันส่งมอบงาน" : "วันส่งของ";
  const chain: [string, string | null][] = [
    ["วันที่บันทึกขอ" + docType, recordDate],
    [`วันสั่ง${docType}`, orderDate],
    [deliverLabel, deliveredDate],
    ["วันตรวจรับ", inspectedDate],
    ["วันรายงานผล", reportDate],
  ];
  let prev: [string, string] = [chain[0][0], recordDate];
  for (const [label, date] of chain.slice(1)) {
    if (!date) continue;
    if (date < prev[1]) return { error: `${label}ต้องไม่ก่อน${prev[0]}` };
    prev = [label, date];
  }
  if (orderDate && deliveryDate < orderDate) return { error: `วันครบกำหนดส่งมอบต้องไม่ก่อนวันสั่ง${docType}` };
  return {
    fields: {
      doc_type: docType as "ซื้อ" | "จ้าง",
      doc_no: str("doc_no"),
      record_date: recordDate,
      delivery_date: deliveryDate,
      work_days: daysInclusive(orderDate ?? recordDate, deliveryDate),
      order_date: orderDate,
      delivered_date: deliveredDate,
      inspected_date: inspectedDate,
      report_date: reportDate,
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
      approval_id: approvalId,
      order_signer: str("order_signer") === "director" ? "director" : "head",
      egp_no: str("egp_no") || null,
      method: str("method") === "w804" ? "w804" : "specific",
      receipt_book: str("receipt_book") || null,
      receipt_no: str("receipt_no") || null,
      receipt_date: str("receipt_date") || null,
      funding: str("funding") === "loan" ? "loan" : str("funding") === "advance" ? "advance" : null,
      // เลขที่/วันที่สัญญายืม ใช้เฉพาะกรณีเงินยืม
      loan_contract_no: str("funding") === "loan" ? str("loan_contract_no") || null : null,
      loan_date: str("funding") === "loan" ? str("loan_date") || null : null,
      spec_author: str("spec_author") || null,
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

/** ยอดรวมงานซื้อ/งานจ้างที่อ้างอิงบันทึกขออนุมัติเดียวกัน (ไม่นับรายการ `excludeId`) + ยอดนี้ ต้องไม่เกินวงเงินที่ขออนุมัติ */
async function checkApprovalBudget(supabase: Awaited<ReturnType<typeof createClient>>, approvalId: string, amount: number, recordDate: string, excludeId?: string) {
  const { data: approval } = await supabase.from("proc_approvals").select("requested_amount, status, doc_date").eq("id", approvalId).maybeSingle();
  if (!approval) return "ไม่พบบันทึกขออนุมัติที่อ้างอิง";
  if (approval.status === "ไม่อนุมัติ") return "บันทึกขออนุมัติที่อ้างอิงไม่ได้รับอนุมัติ";
  if (approval.doc_date && recordDate < approval.doc_date) return "วันที่บันทึกขอต้องไม่ก่อนวันที่บันทึกขออนุมัติที่อ้างอิง";
  let q = supabase.from("proc_purchase_requests").select("amount").eq("approval_id", approvalId);
  if (excludeId) q = q.neq("id", excludeId);
  const { data: others } = await q;
  const used = (others ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const remaining = Math.round((Number(approval.requested_amount) - used) * 100) / 100;
  if (amount > remaining + 0.005) {
    return `ยอดรวมเกินวงเงินคงเหลือของบันทึกขออนุมัติ (คงเหลือ ${remaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท)`;
  }
  return null;
}

function done(id?: string): Result {
  revalidatePath("/supplies/purchase");
  revalidatePath("/supplies/hire");
  revalidatePath("/supplies/w804");
  revalidatePath("/purchase-requests");
  return id ? { id } : {};
}

export async function createProcurement(formData: FormData): Promise<Result> {
  const parsed = parse(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const budgetError = await checkApprovalBudget(supabase, parsed.fields.approval_id, parsed.fields.amount, parsed.fields.record_date);
  if (budgetError) return { error: budgetError };
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
  const budgetError = await checkApprovalBudget(supabase, parsed.fields.approval_id, parsed.fields.amount, parsed.fields.record_date, id);
  if (budgetError) return { error: budgetError };
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
  const { data: photos } = await supabase.from("proc_purchase_photos").select("file_ref").eq("purchase_request_id", id);
  const { data, error } = await supabase.from("proc_purchase_requests").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  // ลบไฟล์รูปอ้างอิงตามไปด้วย (แถวในตารางถูกลบอัตโนมัติด้วย on delete cascade)
  await Promise.all((photos ?? []).map((p) => deleteFromStorage(supabase, p.file_ref, "procurement-files").catch(() => {})));
  return done();
}

// ---- รูปอ้างอิง (ใบส่งของ / ใบส่งมอบงาน / ใบเสร็จรับเงิน / ใบสำคัญรับเงิน ฯลฯ) ----
// ไฟล์อัปโหลดจาก browser ตรงไปปลายทางที่ระบบตั้งไว้ (uploadFileDirect) แล้วบันทึก ref ที่นี่

export async function addProcurementPhotos(requestId: string, photos: { category: string; ref: string }[]): Promise<Result> {
  const valid = photos.filter((p) => p.category.trim() && (/^gdrive:[\w-]+$/.test(p.ref) || /^procurement-photos\/[\w.-]+$/.test(p.ref)));
  if (valid.length === 0) return { error: "ไม่มีรูปที่บันทึกได้" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("proc_purchase_photos")
    .insert(valid.map((p) => ({ purchase_request_id: requestId, category: p.category.trim(), file_ref: p.ref })));
  if (error) {
    await Promise.all(valid.map((p) => deleteFromStorage(supabase, p.ref, "procurement-files").catch(() => {})));
    return { error: error.message };
  }
  return done();
}

export async function deleteProcurementPhoto(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_purchase_photos").delete().eq("id", id).select("file_ref");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  await deleteFromStorage(supabase, data[0].file_ref, "procurement-files").catch(() => {});
  return done();
}
