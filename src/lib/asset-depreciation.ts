// คำนวณ "สถานะค่าเสื่อมราคา ณ ปัจจุบัน" ของรายการทรัพย์สิน 1 รายการ (ค่าเสื่อม/ปี, ค่าเสื่อมสะสม,
// มูลค่าสุทธิ) — ใช้ตรรกะเดียวกับตารางค่าเสื่อมราคาเต็มใน src/lib/pdf/build-asset-register-pdf.tsx
// แต่คืนแค่ยอดล่าสุด ไม่สร้างตารางรายปี/รายเดือนแบบเต็ม เพราะแท็บ "สรุปรายการ" ต้องการแค่ยอดปัจจุบัน
// ต่อรายการ (ไม่ใช่ราย document เดียว) — แยกเป็นไฟล์ปกติ (ไม่มี "use server", ไม่ import react-pdf)
// เพื่อให้ใช้ได้ทั้งฝั่ง client (แท็บสรุปในเบราว์เซอร์) และฝั่ง server (พิมพ์ PDF สรุป)

const NO_DEPRECIATION_THRESHOLD = 5000;
const MAX_PERIODS = 60;

export type AssetDepreciationInput = {
  price: number | null;
  acquired_date: string | null;
  acquired_year: number | null;
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
};

export type AssetDepreciationTotals = {
  annual: number | null;
  cumulative: number | null;
  net: number | null;
};

/** คำนวณค่าเสื่อมสะสม ณ ปัจจุบันแบบเส้นตรงรายเดือน ตามรอบปีงบประมาณ (ตัดยอด 30 ก.ย.) จากวันที่ได้มา
 * จริง — ตรรกะเดียวกับ buildDepreciationScheduleByDate ใน build-asset-register-pdf.tsx */
function computeByDate(price: number, acquiredDate: string, usefulLifeYears: number): AssetDepreciationTotals {
  const totalMonths = usefulLifeYears * 12;
  const monthlyDep = price / totalMonths;

  const [acqYear, acqMonth] = acquiredDate.slice(0, 10).split("-").map(Number);
  let fiscalYearEndAD = acqMonth <= 9 ? acqYear : acqYear + 1;
  const firstPeriodMonths = (fiscalYearEndAD - acqYear) * 12 + (9 - acqMonth) + 1;

  const currentFiscalYearEndAD = new Date().getMonth() + 1 <= 9 ? new Date().getFullYear() : new Date().getFullYear() + 1;

  let cumulative = 0;
  let lastAnnual: number | null = null;
  let remainingMonths = totalMonths;
  let periodMonths = Math.min(firstPeriodMonths, remainingMonths);
  let periodCount = 0;

  while (remainingMonths > 0 && fiscalYearEndAD <= currentFiscalYearEndAD && periodCount < MAX_PERIODS) {
    const remainingValue = price - cumulative;
    if (remainingValue <= 1) break;
    const dep = Math.min(monthlyDep * periodMonths, remainingValue - 1);
    cumulative += dep;
    lastAnnual = dep;
    if (price - cumulative <= 1) break;

    remainingMonths -= periodMonths;
    fiscalYearEndAD += 1;
    periodMonths = Math.min(12, remainingMonths);
    periodCount += 1;
  }

  return { annual: lastAnnual, cumulative, net: price - cumulative };
}

/** คำนวณค่าเสื่อมสะสม ณ ปัจจุบันแบบเส้นตรงรายปี (ไม่มีวันที่ได้มาแบบเต็ม มีแค่ปี พ.ศ.) — ตรรกะเดียวกับ
 * buildDepreciationScheduleByYear ใน build-asset-register-pdf.tsx */
function computeByYear(price: number, acquiredYear: number, depreciationRatePercent: number): AssetDepreciationTotals {
  const rate = depreciationRatePercent / 100;
  const annualDep = price * rate;
  const currentFiscalYearEndBE = new Date().getFullYear() + 543;
  const lastYear = Math.min(currentFiscalYearEndBE, acquiredYear + MAX_PERIODS);

  let cumulative = 0;
  let lastAnnual: number | null = null;

  for (let year = acquiredYear + 1; year <= lastYear; year++) {
    const remaining = price - cumulative;
    if (remaining <= 1) break;
    const dep = Math.min(annualDep, remaining - 1);
    cumulative += dep;
    lastAnnual = dep;
    if (price - cumulative <= 1) break;
  }

  return { annual: lastAnnual, cumulative, net: price - cumulative };
}

/** ทรัพย์สินมูลค่าไม่เกิน 5,000 บาท ไม่ต้องคำนวณค่าเสื่อมราคาตามระเบียบ — มูลค่าสุทธิเท่าราคาทุนเสมอ */
export function computeAssetDepreciation(item: AssetDepreciationInput): AssetDepreciationTotals {
  if (item.price == null) return { annual: null, cumulative: null, net: null };
  if (item.price <= NO_DEPRECIATION_THRESHOLD) return { annual: 0, cumulative: 0, net: item.price };

  if (item.acquired_date && item.useful_life_years) {
    return computeByDate(item.price, item.acquired_date, item.useful_life_years);
  }
  if (item.acquired_year && item.depreciation_rate_percent) {
    return computeByYear(item.price, item.acquired_year, item.depreciation_rate_percent);
  }
  return { annual: null, cumulative: 0, net: item.price };
}
