import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// หน่วยนับที่ใช้บ่อยกับวัสดุ/อุปกรณ์สำนักงาน — เป็นตัวเลือกตั้งต้นของช่อง "หน่วยนับ" ที่ขึ้นช่วยกรอก (datalist ของเบราว์เซอร์)
const COMMON_UNITS = [
  "ชิ้น", "อัน", "ชุด", "เครื่อง", "ตัว", "ใบ", "แผ่น", "กล่อง", "ห่อ", "แพ็ค", "ลัง", "โหล", "รีม",
  "ขวด", "ถุง", "เล่ม", "ด้าม", "แท่ง", "ม้วน", "คู่", "ชุด", "ถัง", "กระป๋อง", "ก้อน", "ท่อน", "เมตร", "คัน", "หลัง",
];

/** รวมคำแนะนำหน่วยนับ: หน่วยที่เคยใช้จริงในระบบมาก่อน (ใช้บ่อยก่อน) → หน่วยในทะเบียนทรัพย์สิน → หน่วยที่ใช้บ่อยทั่วไป ตัดซ้ำ */
export async function loadUnitSuggestions(supabase: SupabaseClient<Database>): Promise<string[]> {
  const [{ data: approvalUnits }, { data: purchaseUnits }, { data: assetUnits }] = await Promise.all([
    supabase.from("proc_approval_items").select("unit").not("unit", "is", null),
    supabase.from("proc_purchase_items").select("unit").not("unit", "is", null),
    supabase.from("asset_units").select("name").eq("is_active", true).order("sort_order").order("name"),
  ]);

  const used = new Map<string, number>();
  for (const r of [...(approvalUnits ?? []), ...(purchaseUnits ?? [])]) {
    const u = (r.unit ?? "").trim();
    if (u) used.set(u, (used.get(u) ?? 0) + 1);
  }
  const usedSorted = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [...usedSorted, ...(assetUnits ?? []).map((a) => a.name.trim()), ...COMMON_UNITS]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}
