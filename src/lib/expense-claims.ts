// เบิกค่าใช้จ่ายโครงการ (ตาราง 2 แนบท้ายหนังสือ ว 119 — ไม่ใช่การจัดซื้อจัดจ้าง) — ชนิดรายการและการคำนวณ
// ใช้ร่วมกันทั้งฟอร์ม server action และ PDF

export type ClaimKind = "snack" | "meal" | "speaker" | "allowance" | "lodging" | "transport" | "other";

/** ชนิดรายการ → ชื่อเริ่มต้น + ช่องที่ใช้คำนวณ (units = มื้อ/ชั่วโมง/คืน) + หลักฐานเริ่มต้น */
export const CLAIM_KINDS: Record<ClaimKind, { label: string; units?: string; people: boolean; days: boolean; evidence: string }> = {
  snack: { label: "ค่าอาหารว่างและเครื่องดื่ม", units: "มื้อ", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  meal: { label: "ค่าอาหารกลางวัน", units: "มื้อ", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  speaker: { label: "ค่าตอบแทนวิทยากร", units: "ชั่วโมง", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  allowance: { label: "ค่าเบี้ยเลี้ยง", people: true, days: true, evidence: "ใบสำคัญรับเงิน" },
  lodging: { label: "ค่าเช่าที่พัก", units: "คืน", people: true, days: false, evidence: "ใบเสร็จรับเงิน" },
  transport: { label: "ค่าพาหนะ", people: false, days: false, evidence: "ใบเสร็จรับเงิน" },
  other: { label: "ค่าใช้จ่ายอื่น", people: false, days: false, evidence: "ใบเสร็จรับเงิน" },
};

export type ClaimCalc = { kind: string; rate: number | null; units: number | null; people: number | null; days: number | null };

/** มีอัตราต่อหน่วย = คำนวณ rate × units × people × days (ช่องที่ไม่กรอกนับเป็น 1) ไม่มี = กรอกจำนวนเงินเอง */
export function claimAmount(c: ClaimCalc): number | null {
  if (c.rate == null) return null;
  return Math.round(c.rate * (c.units ?? 1) * (c.people ?? 1) * (c.days ?? 1) * 100) / 100;
}

const n = (x: number) => x.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** ข้อความวิธีคำนวณ เช่น "2 มื้อ x 35 บาท x 30 คน x 1 วัน" */
export function claimCalcText(c: ClaimCalc): string {
  if (c.rate == null) return "";
  const k = CLAIM_KINDS[c.kind as ClaimKind] ?? CLAIM_KINDS.other;
  const parts: string[] = [];
  if (c.units != null && k.units) parts.push(`${n(c.units)} ${k.units}`);
  parts.push(`${n(c.rate)} บาท`);
  if (c.people != null) parts.push(`${n(c.people)} คน`);
  if (c.days != null) parts.push(`${n(c.days)} วัน`);
  return parts.join(" x ");
}
