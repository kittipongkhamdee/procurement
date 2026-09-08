import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { computeAssetDepreciation } from "@/lib/asset-depreciation";
import { AssetSummaryDocument, type AssetSummaryPdfData } from "./asset-summary-document";

export type AssetSummaryFilters = {
  categoryId?: string;
  condition?: string;
  search?: string;
};

export async function buildAssetSummaryPdfData(
  supabase: SupabaseClient<Database>,
  filters: AssetSummaryFilters,
): Promise<AssetSummaryPdfData> {
  let query = supabase
    .from("asset_items")
    .select("name, category_id, asset_code, quantity, unit, building, floor, room, condition, acquired_date, acquired_year, price")
    .order("created_at", { ascending: false });

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.condition) query = query.eq("condition", filters.condition as "usable" | "damaged" | "disposal");

  const [{ data: items }, { data: categories }, { data: schoolSettings }] = await Promise.all([
    query,
    supabase.from("asset_categories").select("id, name, useful_life_years, depreciation_rate_percent"),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);

  const categoryLookup = new Map((categories ?? []).map((c) => [c.id, c]));

  // ค้นหาแบบเดียวกับแท็บสรุปรายการในเบราว์เซอร์ (ชื่อ/รหัสครุภัณฑ์/สถานที่) — filter ฝั่งนี้เพราะ
  // Supabase query builder ทำ OR ข้ามคอลัมน์แบบนี้ตรงๆ ไม่สะดวกเท่าทำใน JS หลัง fetch มาแล้ว
  const q = filters.search?.trim().toLowerCase();
  const filteredItems = (items ?? []).filter((it) => {
    if (!q) return true;
    const hay = `${it.name} ${it.asset_code ?? ""} ${it.building} ${it.room}`.toLowerCase();
    return hay.includes(q);
  });

  const rows = filteredItems.map((it, i) => {
    const category = it.category_id ? categoryLookup.get(it.category_id) : null;
    const totals = computeAssetDepreciation({
      price: it.price,
      acquired_date: it.acquired_date,
      acquired_year: it.acquired_year,
      useful_life_years: category?.useful_life_years ?? null,
      depreciation_rate_percent: category?.depreciation_rate_percent ?? null,
    });
    const location = [it.building, it.floor ? `ชั้น ${it.floor}` : null, it.room ? `ห้อง ${it.room}` : null]
      .filter(Boolean)
      .join(" ");
    return {
      seq: i + 1,
      name: it.name,
      categoryName: category?.name ?? null,
      assetCode: it.asset_code,
      quantity: it.quantity,
      unit: it.unit,
      location,
      condition: it.condition,
      acquiredYear: it.acquired_year,
      price: it.price,
      usefulLifeYears: category?.useful_life_years ?? null,
      annual: totals.annual,
      cumulative: totals.cumulative,
      net: totals.net,
    };
  });

  return {
    school_name: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
    rows,
  };
}

export async function renderAssetSummaryPdfBuffer(data: AssetSummaryPdfData): Promise<Buffer> {
  return renderToBuffer(<AssetSummaryDocument data={data} />);
}
