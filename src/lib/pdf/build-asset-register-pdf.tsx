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

function acquireRowFor(item: {
  name: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  acquired_date: string | null;
  acquired_year: number | null;
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
}): AssetDepreciationRow {
  const unitPrice = item.price != null && item.quantity > 0 ? item.price / item.quantity : item.price;
  return {
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
}

/** คำนวณตารางค่าเสื่อมราคาแบบเส้นตรงรายเดือนจากวันที่ได้มาจริง (ตามรอบปีงบประมาณ ตัดยอด 30 กันยายน
 * — เหมือนไฟล์ตัวอย่างที่ส่งมา): ค่าเสื่อมต่อเดือน = ราคา ÷ (อายุใช้งานปี × 12) แบ่งเป็นงวดตามรอบปี
 * งบประมาณ — งวดแรก (ตั้งแต่เดือนที่ได้มาถึง ก.ย. ของปีงบประมาณเดียวกัน) มักไม่เต็ม 12 เดือน จากนั้น
 * เป็นงวดละ 12 เดือนเต็ม จนงวดสุดท้ายที่อาจไม่เต็ม 12 เดือนอีกครั้งเมื่อครบอายุใช้งาน — คิดถึงปี
 * งบประมาณปัจจุบันเสมอแม้ยังไม่ถึงวันที่ 30 ก.ย. จริง (ครูอาจต้องพิมพ์เอกสารเตรียมไว้ล่วงหน้า) */
function buildDepreciationScheduleByDate(item: {
  name: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  acquired_date: string;
  useful_life_years: number;
}): AssetDepreciationRow[] {
  const price = item.price as number;
  const totalMonths = item.useful_life_years * 12;
  const monthlyDep = price / totalMonths;

  const [acqYear, acqMonth] = item.acquired_date.slice(0, 10).split("-").map(Number);
  // ปีงบประมาณราชการ: ต.ค.-ก.ย. — ถ้าได้มาในเดือน ม.ค.-ก.ย. ปีงบประมาณสิ้นสุด ก.ย. ปีเดียวกัน
  // ถ้าได้มาในเดือน ต.ค.-ธ.ค. ปีงบประมาณสิ้นสุด ก.ย. ปีถัดไป
  let fiscalYearEndAD = acqMonth <= 9 ? acqYear : acqYear + 1;
  const firstPeriodMonths = (fiscalYearEndAD - acqYear) * 12 + (9 - acqMonth) + 1;

  const currentFiscalYearEndAD = new Date().getMonth() + 1 <= 9 ? new Date().getFullYear() : new Date().getFullYear() + 1;

  const rows: AssetDepreciationRow[] = [];
  let cumulative = 0;
  let remainingMonths = totalMonths;
  let periodMonths = Math.min(firstPeriodMonths, remainingMonths);
  let rowCount = 0;

  while (remainingMonths > 0 && fiscalYearEndAD <= currentFiscalYearEndAD && rowCount < MAX_SCHEDULE_ROWS) {
    const remainingValue = price - cumulative;
    if (remainingValue <= 1) break;
    const dep = Math.min(monthlyDep * periodMonths, remainingValue - 1);
    cumulative += dep;
    const net = price - cumulative;
    const yearBE = fiscalYearEndAD + 543;
    rows.push({
      yearLabel: `30/09/${yearBE}`,
      itemLabel: `ค่าเสื่อมราคา ${periodMonths} เดือน`,
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

    remainingMonths -= periodMonths;
    fiscalYearEndAD += 1;
    periodMonths = Math.min(12, remainingMonths);
    rowCount += 1;
  }

  return rows;
}

/** คำนวณตารางค่าเสื่อมราคาแบบเส้นตรงรายปี (ไม่มีวันที่ได้มาแบบเต็ม มีแค่ปี พ.ศ. — ใช้กับรายการเก่าที่
 * ยังไม่ได้กรอกวันที่เต็ม) ตั้งแต่ปีที่ได้มาจนถึงปีงบประมาณปัจจุบัน หรือจนมูลค่าสุทธิเหลือ 1 บาท */
function buildDepreciationScheduleByYear(item: {
  price: number;
  acquired_year: number;
  depreciation_rate_percent: number;
}): AssetDepreciationRow[] {
  const rows: AssetDepreciationRow[] = [];
  const rate = item.depreciation_rate_percent / 100;
  const annualDep = item.price * rate;
  const currentFiscalYearEndBE = new Date().getFullYear() + 543;
  const lastYear = Math.min(currentFiscalYearEndBE, item.acquired_year + MAX_SCHEDULE_ROWS);
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

/** ทรัพย์สินมูลค่าไม่เกิน 5,000 บาท ไม่ต้องคำนวณค่าเสื่อมราคาตามระเบียบ จึงมีแค่แถวรับเข้ารายการเดียว
 * — มีวันที่ได้มาแบบเต็มและอายุใช้งานครบ ใช้การคำนวณรายเดือนตามจริง ไม่งั้น fallback เป็นรายปี */
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
  const acquireRow = acquireRowFor(item);

  if (item.price == null || item.price <= NO_DEPRECIATION_THRESHOLD) {
    return [acquireRow];
  }

  if (item.acquired_date && item.useful_life_years) {
    return [
      acquireRow,
      ...buildDepreciationScheduleByDate({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        acquired_date: item.acquired_date,
        useful_life_years: item.useful_life_years,
      }),
    ];
  }

  if (item.acquired_year && item.depreciation_rate_percent) {
    return [
      acquireRow,
      ...buildDepreciationScheduleByYear({
        price: item.price,
        acquired_year: item.acquired_year,
        depreciation_rate_percent: item.depreciation_rate_percent,
      }),
    ];
  }

  return [acquireRow];
}

export async function buildAssetRegisterPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: AssetRegisterPdfData; fileLabel: string } | null> {
  const { data: item, error } = await supabase
    .from("asset_items")
    .select(
      "asset_code, sequence_no, name, quantity, unit, price, building, floor, room, spec, model, vendor_name, vendor_address, vendor_phone, acquisition_method, acquisition_method_id, acquired_date, acquired_year, category_id, budget_source_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !item) return null;

  const [{ data: category }, { data: budgetSource }, { data: acquisitionMethod }, { data: schoolSettings }] = await Promise.all([
    item.category_id
      ? supabase.from("asset_categories").select("name, useful_life_years, depreciation_rate_percent").eq("id", item.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.budget_source_id
      ? supabase.from("asset_budget_sources").select("name").eq("id", item.budget_source_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.acquisition_method_id
      ? supabase.from("asset_acquisition_methods").select("name").eq("id", item.acquisition_method_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("proc_school_settings").select("school_name, education_area, school_address").eq("id", true).maybeSingle(),
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
    sequence_no: item.sequence_no,
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
    education_area: schoolSettings?.education_area ?? null,
    school_address: schoolSettings?.school_address ?? null,
    vendor_name: item.vendor_name,
    vendor_address: item.vendor_address,
    vendor_phone: item.vendor_phone,
    budget_source_name: budgetSource?.name ?? null,
    // รายการเก่าก่อนมีตารางวิธีการได้มา (asset_acquisition_methods) ยังเก็บเป็นข้อความอิสระอยู่ —
    // ใช้ชื่อจากตารางใหม่ก่อน ถ้าไม่มีค่อย fallback ไปใช้ข้อความอิสระเดิม
    acquisition_method: acquisitionMethod?.name ?? item.acquisition_method,
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
