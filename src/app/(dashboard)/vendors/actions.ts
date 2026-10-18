"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createVendor(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("proc_vendors").insert({
    name: String(formData.get("name") ?? ""),
    tax_id: String(formData.get("tax_id") ?? "") || null,
    house_no: String(formData.get("house_no") ?? "") || null,
    moo: String(formData.get("moo") ?? "") || null,
    tambon: String(formData.get("tambon") ?? "") || null,
    amphoe: String(formData.get("amphoe") ?? "") || null,
    province: String(formData.get("province") ?? "") || null,
    zipcode: String(formData.get("zipcode") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    vat_registered: parseVat(formData.get("vat_registered")),
  });

  // RLS blocks this for non-staff roles (teacher/director) — expected, not a bug
  // คืน { error } แทน throw — production ของ Next ซ่อนข้อความ error ที่ throw (ขึ้น React error #441)
  if (error) return { error: error.message.includes("row-level") ? "ไม่มีสิทธิ์เพิ่มร้านค้า" : error.message };
  revalidatePath("/vendors");
  return {};
}

function parseVat(v: FormDataEntryValue | null): boolean | null {
  return v === "yes" ? true : v === "no" ? false : null;
}

/** สถานะจดทะเบียนภาษีมูลค่าเพิ่มของร้าน — ใช้ตั้งค่าภาษีเริ่มต้นในฟอร์มซื้อ/จ้าง */
export async function setVendorVat(id: string, value: "yes" | "no" | ""): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_vendors").update({ vat_registered: parseVat(value) }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/vendors");
  return {};
}

export async function deleteVendor(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_vendors").delete().eq("id", id).select("id");
  // 23503 = ร้านนี้ถูกอ้างถึงในเอกสารจัดซื้อ/สัญญา ลบไม่ได้
  if (error) return { error: error.code === "23503" ? "ลบไม่ได้ เพราะร้านนี้ถูกใช้ในเอกสารจัดซื้อ/จัดจ้างหรือสัญญาแล้ว" : error.message };
  if (!data?.length) return { error: "ลบไม่สำเร็จ (ไม่มีสิทธิ์ลบ หรือไม่พบร้านค้า)" };
  revalidatePath("/vendors");
  return {};
}
