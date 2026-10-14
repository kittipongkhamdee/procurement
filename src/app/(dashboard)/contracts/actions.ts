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
  if (!vendorName) throw new ValidationError("กรุณากรอกชื่อผู้รับจ้าง");
  if (!(amount && amount > 0)) throw new ValidationError("จำนวนเงินตามสัญญาต้องมากกว่า 0");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  if (startDate && endDate && endDate < startDate) throw new ValidationError("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มงาน");

  const contractType = text(formData, "contract_type") ?? "จ้าง";
  if (!CONTRACT_TYPES.includes(contractType)) throw new ValidationError("ประเภทสัญญาไม่ถูกต้อง");

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

export async function createContract(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  return run(async () => supabase.from("proc_contracts").insert(contractFields(formData)));
}

export async function updateContract(id: string, formData: FormData): Promise<Result> {
  const supabase = await createClient();
  return run(async () => supabase.from("proc_contracts").update(contractFields(formData)).eq("id", id));
}

export async function deleteContract(id: string): Promise<Result> {
  const supabase = await createClient();
  return run(async () => supabase.from("proc_contracts").delete().eq("id", id));
}
