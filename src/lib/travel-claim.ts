// รายงานการเดินทางไปราชการ (แบบ 8708) — ชนิดข้อมูลและการคำนวณที่ใช้ทั้งฟอร์ม (client) และ PDF (server)

export type TravelPlace = "home" | "office" | "thailand";
export const PLACE_LABEL: Record<TravelPlace, string> = { home: "บ้านพัก", office: "สำนักงาน", thailand: "ประเทศไทย" };

export type TravelMember = { name: string; position: string; allowance: number; lodging: number; transport: number; other: number; note: string };

export type TravelClaim = {
  loan_no: string;
  loan_date: string | null;
  borrower: string;
  loan_amount: number;
  office: string;
  date: string | null;
  to: string;
  order_no: string;
  order_date: string | null;
  name: string;
  position: string;
  affiliation: string;
  companions: string;
  purpose: string;
  depart_from: TravelPlace | null;
  depart_date: string | null;
  depart_time: string;
  return_to: TravelPlace | null;
  return_date: string | null;
  return_time: string;
  claim_for: "self" | "group";
  allowance_type: string;
  allowance_days: string;
  allowance: number;
  lodging_type: string;
  lodging_days: string;
  lodging: number;
  transport_desc: string;
  transport: number;
  other_desc: string;
  other: number;
  evidence_count: string;
  note: string;
  province: string;
  members: TravelMember[];
  print_part2: boolean;
  checker: { name: string; position: string };
  approver: { name: string; position: string };
  payer: { name: string; position: string };
};

/** ระยะเวลาไปราชการ (วัน/ชั่วโมง) จากวันเวลาออกเดินทาง–กลับถึง — นับ 24 ชม. = 1 วัน */
export function travelDuration(d: Pick<TravelClaim, "depart_date" | "depart_time" | "return_date" | "return_time">): { days: number; hours: number } | null {
  if (!d.depart_date || !d.return_date) return null;
  const at = (date: string, time: string) => new Date(`${date}T${/^\d{1,2}[.:]\d{2}$/.test(time.trim()) ? time.trim().replace(".", ":").padStart(5, "0") : "00:00"}:00`).getTime();
  const ms = at(d.return_date, d.return_time) - at(d.depart_date, d.depart_time);
  if (!(ms >= 0)) return null;
  const h = Math.floor(ms / 3600000);
  return { days: Math.floor(h / 24), hours: h % 24 };
}

export const claimTotal = (d: Pick<TravelClaim, "allowance" | "lodging" | "transport" | "other">) => d.allowance + d.lodging + d.transport + d.other;

/** จำนวนวันเบี้ยเลี้ยง: 24 ชม. = 1 วัน เศษเกิน 12 ชม. = 1 วัน · ไม่พักแรม: รวมไม่ถึง 1 วันแต่เกิน 6 ชม. = ครึ่งวัน (คู่มือ สพฐ. หน้า 4–5) */
export function allowanceDays(dur: { days: number; hours: number }, overnight: boolean): number {
  let days = dur.days + (dur.hours > 12 ? 1 : 0);
  if (!overnight && dur.days === 0 && dur.hours > 6 && dur.hours <= 12) days = 0.5;
  return days;
}
/** จำนวนคืนที่พัก = จำนวนวันระหว่างวันออกเดินทางกับวันกลับ */
export function lodgingNights(depart: string, ret: string): number {
  const d = (Date.parse(ret) - Date.parse(depart)) / 86400000;
  return d > 0 ? Math.round(d) : 0;
}
/** อัตราตามตำแหน่ง — เชี่ยวชาญ/ทรงคุณวุฒิ/ผู้อำนวยการระดับสูงขึ้นไป ใช้อัตราสูง (270 / 1,200) นอกนั้น 240 / 800 */
export function rateFor(position: string): { allowance: number; lodging: number } {
  return /เชี่ยวชาญ|ทรงคุณวุฒิ|ทักษะพิเศษ|ระดับสูง/.test(position) ? { allowance: 270, lodging: 1200 } : { allowance: 240, lodging: 800 };
}
