// ภาษีมูลค่าเพิ่ม/ส่วนลด — ใช้ร่วมกันทั้งฝั่ง client (ตารางกรอกรายการ) และ server (บันทึก/PDF/ทะเบียน)

export const VAT_RATE = 0.07;
/** none = ไม่มีภาษี, exclude = ราคายังไม่รวมภาษี (บวกเพิ่ม 7%), include = ราคารวมภาษีแล้ว (แยกให้เห็น) */
export type VatType = "none" | "exclude" | "include";

export function parseVatType(v: unknown): VatType {
  return v === "none" || v === "exclude" ? v : "include";
}

/** ยอดรวม → หักส่วนลด → ภาษีมูลค่าเพิ่ม → ยอดสุทธิ (ปัดเศษ 2 ตำแหน่ง) */
export function computeTotals(subtotal: number, discount: number, vatType: VatType) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const afterDiscount = round(Math.max(subtotal - discount, 0));
  const vat =
    vatType === "exclude" ? round(afterDiscount * VAT_RATE) : vatType === "include" ? round((afterDiscount * VAT_RATE) / (1 + VAT_RATE)) : 0;
  const net = vatType === "exclude" ? round(afterDiscount + vat) : afterDiscount;
  return { subtotal: round(subtotal), afterDiscount, vat, net, beforeVat: round(net - vat) };
}
