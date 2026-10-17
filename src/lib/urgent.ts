// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) — ฟังก์ชันที่ใช้ได้ทั้งฝั่งหน้าเว็บและ PDF (ห้าม import ไฟล์ PDF จาก client component)

export type UrgentItem = { kind: string; name: string; amount: number };

/** "ซื้อ" / "จ้าง" / "ซื้อ/ขอจ้าง" ตามประเภทของรายการ — ใช้ต่อท้าย "รายงานขอ" */
export function urgentKindLabel(items: UrgentItem[]) {
  const buy = items.some((i) => i.kind !== "จ้าง");
  const hire = items.some((i) => i.kind === "จ้าง");
  return buy && hire ? "ซื้อ/ขอจ้าง" : hire ? "จ้าง" : "ซื้อ";
}
