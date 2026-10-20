// จำแนกรายการจัดซื้อเป็น วัสดุ / ครุภัณฑ์ — ระบบเสนอเบื้องต้น ผู้ใช้ติ๊กเปลี่ยนได้
// หลักการจำแนกประเภทรายจ่าย (สำนักงบประมาณ ว 68/2558, ว 37/2559) แยกตามลักษณะ: ครุภัณฑ์ = คงทนถาวร อายุใช้งานยืนนาน,
// วัสดุ = สิ้นเปลือง/อายุใช้งานไม่ยืนนาน — ไม่มีเกณฑ์ราคา; ระบบใช้เกณฑ์บันทึกสินทรัพย์ของกรมบัญชีกลาง (ราคาต่อหน่วยตั้งแต่
// 10,000 บาท ตั้งแต่ปีงบ 2563) ช่วยเสนอค่าเริ่มต้นเท่านั้น ผู้ใช้เปลี่ยนเองได้ทุกรายการ
// ต่ำกว่านั้น = วัสดุ (ลงบัญชีวัสดุ) — งานจ้าง/บริการไม่เข้าคลัง (null)

export type ItemClass = "material" | "equipment";
export const ITEM_CLASS_LABEL: Record<ItemClass, string> = { material: "วัสดุ", equipment: "ครุภัณฑ์" };
export const EQUIPMENT_MIN_PRICE = 10000;

// คำที่มักเป็นครุภัณฑ์แม้ราคาต่ำกว่าเกณฑ์จะยังเป็นวัสดุ — ใช้เฉพาะเมื่อราคาถึงเกณฑ์หรือไม่ทราบราคา
const EQUIPMENT_WORDS = ["เครื่องปรับอากาศ", "แอร์", "คอมพิวเตอร์", "โน้ตบุ๊ก", "โน๊ตบุ๊ค", "เครื่องพิมพ์", "ปริ้นเตอร์", "โปรเจคเตอร์", "โปรเจกเตอร์", "ตู้เย็น", "โทรทัศน์", "ทีวี", "เครื่องถ่ายเอกสาร", "ตู้เหล็ก", "โต๊ะ", "เก้าอี้", "ตู้"];

/** ข้อเสนอเบื้องต้น: ราคาต่อหน่วย ≥ 10,000 = ครุภัณฑ์ · ไม่มีราคาแต่ชื่อเข้าข่ายครุภัณฑ์ = ครุภัณฑ์ · นอกนั้น = วัสดุ */
export function suggestItemClass(name: string, unitPrice: number | null | undefined): ItemClass {
  if (unitPrice != null && unitPrice > 0) return unitPrice >= EQUIPMENT_MIN_PRICE ? "equipment" : "material";
  const n = name.trim();
  return EQUIPMENT_WORDS.some((w) => n.includes(w)) ? "equipment" : "material";
}

export function parseItemClass(v: unknown): ItemClass | null {
  return v === "material" || v === "equipment" ? v : null;
}
