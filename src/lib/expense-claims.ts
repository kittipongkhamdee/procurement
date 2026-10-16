// เบิกค่าใช้จ่ายโครงการ (ตาราง 2 แนบท้ายหนังสือ ว 119 — ไม่ใช่การจัดซื้อจัดจ้าง) — ชนิดรายการและการคำนวณ
// ใช้ร่วมกันทั้งฟอร์ม server action และ PDF

export type ClaimKind = "snack" | "meal" | "speaker" | "allowance" | "lodging" | "judge" | "prize" | "mileage" | "transport" | "other";

/** ชนิดรายการ → ชื่อเริ่มต้น + ช่องที่ใช้คำนวณ (units = มื้อ/ชั่วโมง/คืน) + หลักฐานเริ่มต้น */
export const CLAIM_KINDS: Record<ClaimKind, { label: string; units?: string; people: boolean; days: boolean; evidence: string }> = {
  snack: { label: "ค่าอาหารว่างและเครื่องดื่ม", units: "มื้อ", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  meal: { label: "ค่าอาหารกลางวัน", units: "มื้อ", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  speaker: { label: "ค่าตอบแทนวิทยากร", units: "ชั่วโมง", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  allowance: { label: "ค่าอาหารนักเรียนเหมาจ่าย / ค่าเบี้ยเลี้ยง", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  lodging: { label: "ค่าเช่าที่พัก", units: "คืน", people: true, days: false, evidence: "ใบเสร็จรับเงิน" },
  judge: { label: "ค่าตอบแทนกรรมการตัดสิน", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  prize: { label: "ค่าโล่ ถ้วยรางวัล ของรางวัล", units: "ชิ้น", people: false, days: false, evidence: "ใบเสร็จรับเงิน" },
  mileage: { label: "ค่าพาหนะส่วนตัว (เงินชดเชยตามระยะทาง)", units: "กิโลเมตร", people: false, days: false, evidence: "แบบ บก.4231 (ค่าพาหนะส่วนตัว)" },
  transport: { label: "ค่าพาหนะ", people: false, days: false, evidence: "ใบเสร็จรับเงิน" },
  other: { label: "ค่าใช้จ่ายอื่น", people: false, days: false, evidence: "ใบเสร็จรับเงิน" },
};

export type ClaimCalc = { kind: string; rate: number | null; units: number | null; people: number | null; days: number | null };

/** มีอัตราต่อหน่วย = คำนวณ rate × units × people × days (ช่องที่ไม่กรอกนับเป็น 1) ไม่มี = กรอกจำนวนเงินเอง */
export function claimAmount(c: ClaimCalc): number | null {
  if (c.rate == null) return null;
  const u = usedFields(c);
  return Math.round(c.rate * (u.units ?? 1) * (u.people ?? 1) * (u.days ?? 1) * 100) / 100;
}

/** ใช้เฉพาะช่องที่ประเภทนั้นมีจริง — กันค่าค้างจากประเภทเดิม (เช่น เปลี่ยนจากค่าอาหาร 50 คน มาเป็นค่าพาหนะ) */
function usedFields(c: ClaimCalc) {
  const k = CLAIM_KINDS[c.kind as ClaimKind] ?? CLAIM_KINDS.other;
  return { units: k.units ? c.units : null, people: k.people ? c.people : null, days: k.days ? c.days : null };
}

const n = (x: number) => x.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** ข้อความวิธีคำนวณ เช่น "2 มื้อ x 35 บาท x 30 คน x 1 วัน" */
export function claimCalcText(c: ClaimCalc): string {
  if (c.rate == null) return "";
  const k = CLAIM_KINDS[c.kind as ClaimKind] ?? CLAIM_KINDS.other;
  const u = usedFields(c);
  const parts: string[] = [];
  if (u.units != null && k.units) parts.push(`${n(u.units)} ${k.units}`);
  parts.push(`${n(c.rate)} บาท`);
  if (u.people != null) parts.push(`${n(u.people)} คน`);
  if (u.days != null) parts.push(`${n(u.days)} วัน`);
  return parts.join(" x ");
}

/** อัตราค่าใช้จ่ายตามระเบียบ (proc_expense_rates) — ล็อกอัตราสูงสุดของรายการในบันทึกขอเบิก */
export type ExpenseRate = { id: string; kind: string; name: string; max_rate: number; unit_note: string | null; note: string | null; source: string | null; sort_order: number; is_active: boolean };
