import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import {
  AssetRegisterDocument,
  type AssetDepreciationRow,
  type AssetRegisterPdfData,
} from "./asset-register-document";

/** "2569-05-28" -> "28/05/2569" — รูปแบบสั้นให้พอดีกับคอลัมน์แคบๆ ในตารางค่าเสื่อมราคา
 * (formatThaiDate จาก lib/thai.ts เขียนชื่อเดือนเต็ม ยาวเกินคอลัมน์นี้) */
function formatShortThaiDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${Number(year) + 543}`;
}

const NO_DEPRECIATION_THRESHOLD = 5000;
const MAX_SCHEDULE_ROWS = 60;

/** ปีงบประมาณปัจจุบัน คิดค่าเสื่อมราคาถึง 30 กันยายนของปีนี้เสมอ แม้วันที่พิมพ์จะยังไม่ถึง 30 ก.ย.
 * ก็ตาม (ครูอาจต้องพิมพ์เอกสารเตรียมไว้ล่วงหน้าก่อนสิ้นปีงบประมาณ) ใช้เป็นเพดานการคำนวณค่าเสื่อม
 * ราคารายปี (ไม่มีวันที่ได้มาแบบเต็ม มีแค่ปี พ.ศ. ที่ได้มา จึงคำนวณเป็นรายปีเท่านั้น ไม่ใช่รายเดือน
 * แบบละเอียดเหมือนไฟล์ตัวอย่างที่มีวันที่เต็ม) */
function currentFiscalYearEndBE(): number {
  return new Date().getFullYear() + 543;
}

/** คำนวณตารางค่าเสื่อมราคาแบบเส้นตรง (straight-line) รายปี ตั้งแต่ปีที่ได้มาจนถึงปีปัจจุบันหรือ
 * จนมูลค่าสุทธิเหลือ 1 บาท (ตามหลักเกณฑ์ สพฐ. ที่คงมูลค่าทางบัญชีไว้ 1 บาทไม่ให้เป็นศูนย์) —
 * ทรัพย์สินมูลค่าไม่เกิน 5,000 บาท ไม่ต้องคำนวณค่าเสื่อมราคาตามระเบียบ จึงมีแค่แถวรับเข้ารายการเดียว */
function buildDepreciationSchedule(item: {
  name: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  acquired_date: string | null;
  acquired_year: number | null;
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
}): AssetDepreciationRow[] {
  const unitPrice = item.price != null && item.quantity > 0 ? item.price / item.quantity : item.price;
  const acquireRow: AssetDepreciationRow = {
    yearLabel: item.acquired_date ? formatShortThaiDate(item.acquired_date) : item.acquired_year != null ? String(item.acquired_year) : "-",
    itemLabel: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice,
    total: item.price,
    usefulLifeYears: item.useful_life_years,
    ratePercent: item.depreciation_rate_percent,
    annual: null,
    cumulative: 0,
    net: item.price,
    note:
      item.price != null && item.price <= NO_DEPRECIATION_THRESHOLD
        ? ["ไม่คำนวณค่าเสื่อม", "(มูลค่าไม่เกิน", "5,000 บาท)"]
        : null,
  };

  if (
    item.price == null ||
    item.price <= NO_DEPRECIATION_THRESHOLD ||
    item.acquired_year == null ||
    !item.depreciation_rate_percent
  ) {
    return [acquireRow];
  }

  const rows: AssetDepreciationRow[] = [acquireRow];
  const rate = item.depreciation_rate_percent / 100;
  const annualDep = item.price * rate;
  const lastYear = Math.min(currentFiscalYearEndBE(), item.acquired_year + MAX_SCHEDULE_ROWS);
  let cumulative = 0;

  for (let year = item.acquired_year + 1; year <= lastYear; year++) {
    const remaining = item.price - cumulative;
    if (remaining <= 1) break;
    const dep = Math.min(annualDep, remaining - 1);
    cumulative += dep;
    const net = item.price - cumulative;
    rows.push({
      yearLabel: String(year),
      itemLabel: `ค่าเสื่อมราคา ณ 30 ก.ย. พ.ศ. ${year}`,
      quantity: null,
      unit: null,
      unitPrice: null,
      total: null,
      usefulLifeYears: null,
      ratePercent: null,
      annual: dep,
      cumulative,
      net,
      note: net <= 1 ? ["คงมูลค่าบัญชี", "ไว้ 1 บาท"] : null,
    });
    if (net <= 1) break;
  }

  return rows;
}

export async function buildAssetRegisterPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: AssetRegisterPdfData; fileLabel: string } | null> {
  const { data: item, error } = await supabase
    .from("asset_items")
    .select(
      "asset_code, name, quantity, unit, price, building, floor, room, spec, model, vendor_name, vendor_address, vendor_phone, acquisition_method, acquired_date, acquired_year, category_id, budget_source_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !item) return null;

  const [{ data: category }, { data: budgetSource }, { data: schoolSettings }] = await Promise.all([
    item.category_id
      ? supabase.from("asset_categories").select("name, useful_life_years, depreciation_rate_percent").eq("id", item.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.budget_source_id
      ? supabase.from("asset_budget_sources").select("name").eq("id", item.budget_source_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);

  const schedule = buildDepreciationSchedule({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
    acquired_date: item.acquired_date,
    acquired_year: item.acquired_year,
    useful_life_years: category?.useful_life_years ?? null,
    depreciation_rate_percent: category?.depreciation_rate_percent ?? null,
  });

  const data: AssetRegisterPdfData = {
    asset_code: item.asset_code,
    name: item.name,
    category_name: category?.name ?? null,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
    building: item.building,
    floor: item.floor,
    room: item.room,
    spec: item.spec,
    model: item.model,
    school_name: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
    vendor_name: item.vendor_name,
    vendor_address: item.vendor_address,
    vendor_phone: item.vendor_phone,
    budget_source_name: budgetSource?.name ?? null,
    acquisition_method: item.acquisition_method,
    acquired_year: item.acquired_year,
    useful_life_years: category?.useful_life_years ?? null,
    depreciation_rate_percent: category?.depreciation_rate_percent ?? null,
    schedule,
  };

  return { data, fileLabel: `ทะเบียนคุมทรัพย์สิน-${item.asset_code ?? item.name}` };
}

export async function renderAssetRegisterPdfBuffer(data: AssetRegisterPdfData): Promise<Buffer> {
  return renderToBuffer(<AssetRegisterDocument data={data} />);
}
