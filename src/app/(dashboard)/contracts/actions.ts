"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string): string | null {
  return String(formData.get(key) ?? "").trim() || null;
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? Number(raw) : null;
}

class ValidationError extends Error {}

const CONTRACT_TYPES = ["จ้าง", "ซื้อ", "เช่า"];

/** ค่าจากฟอร์มสัญญา (ใช้ร่วมกันทั้งสร้างและแก้ไข) — ข้อมูลไม่ครบโยน ValidationError */
function contractFields(formData: FormData) {
  const contractNo = text(formData, "contract_no");
  const contractDate = text(formData, "contract_date");
  const vendorName = text(formData, "vendor_name");
  const amount = num(formData, "amount");
  if (!contractNo) throw new ValidationError("กรุณากรอกเลขที่สัญญา");
  if (!contractDate) throw new ValidationError("กรุณาเลือกวันที่ทำสัญญา");
  if (!vendorName) throw new ValidationError("กรุณากรอกชื่อคู่สัญญา");
  if (!(amount && amount > 0)) throw new ValidationError("จำนวนเงินตามสัญญาต้องมากกว่า 0");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  if (startDate && endDate && endDate < startDate) throw new ValidationError("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา");

  const contractType = text(formData, "contract_type") ?? "จ้าง";
  if (!CONTRACT_TYPES.includes(contractType)) throw new ValidationError("ประเภทสัญญาไม่ถูกต้อง");

  const vatType = text(formData, "vat_type");
  if (vatType && !["none", "exclude", "include"].includes(vatType)) throw new ValidationError("ประเภทภาษีไม่ถูกต้อง");

  return {
    contract_type: contractType,
    contract_no: contractNo,
    project_id: text(formData, "project_id"),
    contract_date: contractDate,
    start_date: startDate,
    end_date: endDate,
    vendor_name: vendorName,
    id_card: text(formData, "id_card"),
    house_no: text(formData, "house_no"),
    moo: text(formData, "moo"),
    tambon: text(formData, "tambon"),
    amphoe: text(formData, "amphoe"),
    province: text(formData, "province"),
    zipcode: text(formData, "zipcode"),
    phone: text(formData, "phone"),
    detail: text(formData, "detail"),
    budget: num(formData, "budget"),
    amount,
    guarantee_type: text(formData, "guarantee_type"),
    guarantee_amount: num(formData, "guarantee_amount"),
    penalty_rate: num(formData, "penalty_rate"),
    discount: num(formData, "discount"),
    rental_area: text(formData, "rental_area"),
    rent_monthly: num(formData, "rent_monthly"),
    vat_type: vatType,
    inspector_name: text(formData, "inspector_name"),
    note: text(formData, "note"),
  };
}

// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action
// (ผู้ใช้จะเห็นแค่ "Minified React error #441")
type Result = { error?: string };

async function run(fn: () => Promise<{ error: { message: string } | null }>): Promise<Result> {
  try {
    const { error } = await fn();
    if (error) return { error: error.message };
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    throw err;
  }
  revalidatePath("/contracts");
  return {};
}

type ItemInput = { name: string; qty: string; unit: string; unitPrice: string; note: string };

function parseItems(formData: FormData): ItemInput[] | null {
  const raw = formData.get("items_json");
  if (raw === null) return null; // ฟอร์มประเภทนี้ไม่มีตารางรายการ
  try {
    const items = JSON.parse(String(raw)) as ItemInput[];
    return items.filter((i) => i.name?.trim()).slice(0, 100);
  } catch {
    throw new ValidationError("รายการพัสดุไม่ถูกต้อง");
  }
}

async function replaceItems(supabase: Awaited<ReturnType<typeof createClient>>, contractId: string, items: ItemInput[]) {
  const { error: delError } = await supabase.from("proc_contract_items").delete().eq("contract_id", contractId);
  if (delError) return delError.message;
  if (items.length === 0) return null;
  const { error } = await supabase.from("proc_contract_items").insert(
    items.map((i, idx) => ({
      contract_id: contractId,
      seq: idx + 1,
      name: i.name.trim(),
      qty: i.qty ? Number(i.qty) : null,
      unit: i.unit?.trim() || null,
      unit_price: i.unitPrice ? Number(i.unitPrice) : null,
      note: i.note?.trim() || null,
    })),
  );
  return error?.message ?? null;
}

export async function createContract(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  try {
    const fields = contractFields(formData);
    const items = parseItems(formData);
    const { data, error } = await supabase.from("proc_contracts").insert(fields).select("id").single();
    if (error) return { error: error.message };
    if (items) {
      const itemError = await replaceItems(supabase, data.id, items);
      if (itemError) return { error: `บันทึกสัญญาแล้ว แต่บันทึกรายการพัสดุไม่สำเร็จ: ${itemError}` };
    }
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    throw err;
  }
  revalidatePath("/contracts");
  return {};
}

export async function updateContract(id: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  try {
    const fields = contractFields(formData);
    const items = parseItems(formData);
    const { error } = await supabase.from("proc_contracts").update(fields).eq("id", id);
    if (error) return { error: error.message };
    if (items) {
      const itemError = await replaceItems(supabase, id, items);
      if (itemError) return { error: `บันทึกสัญญาแล้ว แต่บันทึกรายการพัสดุไม่สำเร็จ: ${itemError}` };
    }
  } catch (err) {
    if (err instanceof ValidationError) return { error: err.message };
    throw err;
  }
  revalidatePath("/contracts");
  return {};
}

export async function deleteContract(id: string): Promise<Result> {
  const supabase = await createClient();
  return run(async () => supabase.from("proc_contracts").delete().eq("id", id));
}
