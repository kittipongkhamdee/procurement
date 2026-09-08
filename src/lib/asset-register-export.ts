import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type AssetRegisterExportFilters = {
  roundId?: string;
  categoryId?: string;
  status?: string;
  condition?: string;
  search?: string;
};

export type AssetRegisterExportRow = {
  assetCode: string | null;
  name: string;
  categoryName: string | null;
  location: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  condition: string;
  status: string;
};

export const CONDITION_LABEL: Record<string, string> = {
  usable: "ใช้งานได้",
  damaged: "ชำรุด",
  disposal: "จำหน่าย",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "แบบร่าง",
  submitted: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
};

// ตัวกรอง/การค้นหาชุดเดียวกับตาราง "จัดการทรัพย์สิน" ในเบราว์เซอร์ (register-tab.tsx) — ใช้ query
// ฝั่ง Supabase แบบเดียวกัน แต่ไม่ใส่ .range() เพราะไฟล์ Excel ต้องได้ครบทุกรายการที่ตรงตัวกรอง
// ไม่ใช่แค่หน้าปัจจุบัน
export async function fetchAssetItemsForExport(
  supabase: SupabaseClient<Database>,
  filters: AssetRegisterExportFilters,
): Promise<AssetRegisterExportRow[]> {
  let query = supabase
    .from("asset_items")
    .select("category_id, building, floor, room, name, quantity, unit, asset_code, condition, price, status")
    .order("created_at", { ascending: false });

  if (filters.roundId) query = query.eq("round_id", filters.roundId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.status) query = query.eq("status", filters.status as "draft" | "submitted" | "approved" | "rejected");
  if (filters.condition) query = query.eq("condition", filters.condition as "usable" | "damaged" | "disposal");
  if (filters.search) {
    const q = filters.search.replace(/,/g, " ");
    const orParts = [`name.ilike.%${q}%`, `asset_code.ilike.%${q}%`, `building.ilike.%${q}%`, `room.ilike.%${q}%`];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
      orParts.push(`id.eq.${q}`);
    }
    query = query.or(orParts.join(","));
  }

  const [{ data: items }, { data: categories }] = await Promise.all([
    query,
    supabase.from("asset_categories").select("id, name"),
  ]);

  const categoryLookup = new Map((categories ?? []).map((c) => [c.id, c.name]));

  return (items ?? []).map((it) => ({
    assetCode: it.asset_code,
    name: it.name,
    categoryName: it.category_id ? (categoryLookup.get(it.category_id) ?? null) : null,
    location: [it.building, it.floor ? `ชั้น ${it.floor}` : null, it.room ? `ห้อง ${it.room}` : null]
      .filter(Boolean)
      .join(" "),
    quantity: it.quantity,
    unit: it.unit,
    price: it.price,
    condition: it.condition,
    status: it.status,
  }));
}
