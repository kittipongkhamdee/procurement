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

/** ค่าจากฟอร์มสัญญา (ใช้ร่วมกันทั้งสร้างและแก้ไข) */
function contractFields(formData: FormData) {
  const contractNo = text(formData, "contract_no");
  const contractDate = text(formData, "contract_date");
  const vendorName = text(formData, "vendor_name");
  const amount = num(formData, "amount");
  if (!contractNo) throw new Error("กรุณากรอกเลขที่สัญญา");
  if (!contractDate) throw new Error("กรุณาเลือกวันที่ทำสัญญา");
  if (!vendorName) throw new Error("กรุณากรอกชื่อผู้รับจ้าง");
  if (!(amount && amount > 0)) throw new Error("จำนวนเงินตามสัญญาต้องมากกว่า 0");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  if (startDate && endDate && endDate < startDate) throw new Error("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มงาน");

  return {
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

export async function createContract(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_contracts").insert(contractFields(formData));
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}

export async function updateContract(id: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_contracts").update(contractFields(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}

export async function deleteContract(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}
