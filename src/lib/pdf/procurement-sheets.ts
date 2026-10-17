// รายชื่อแผ่นในชุดเอกสารงานซื้อ/งานจ้าง (ใช้ทั้งฝั่ง PDF และปุ่มพิมพ์แยกแผ่นในหน้าเว็บ) — ลำดับในอาร์เรย์ = เลขแผ่น
// งานซื้อ ๘ แผ่น (ตามชุดซื้อเสารั้ว 81/2569), งานจ้าง ๗ แผ่น (ตามชุดจ้างช่างซ่อมแซมรั้ว 27/2569: ไม่มีแผ่นแนบท้าย มีใบส่งมอบงาน)

export type SheetKey = "w804_request" | "w804_spec" | "w804_report" | "w804_receipt" | "request" | "request_attach" | "quote" | "consider" | "order" | "order_attach" | "handover" | "inspect" | "disburse";

const LABELS: Record<SheetKey, (v: string) => string> = {
  w804_request: () => "รายงานขอซื้อ (ว 804)",
  w804_spec: () => "รายละเอียดคุณลักษณะเฉพาะของพัสดุ",
  w804_report: () => "รายงานสรุปผลการจัดซื้อและอนุมัติเบิกจ่าย",
  w804_receipt: () => "ใบติดใบเสร็จรับเงิน",
  request: (v) => `รายงานขอ${v}`,
  request_attach: () => "รายละเอียดแนบท้ายบันทึก",
  quote: () => "ใบเสนอราคา",
  consider: (v) => `รายงานผลการพิจารณาและขออนุมัติสั่ง${v}`,
  order: (v) => `ใบสั่ง${v}`,
  order_attach: (v) => `รายละเอียดแนบท้ายใบสั่ง${v}`,
  handover: () => "ใบส่งมอบงาน",
  inspect: () => "ใบตรวจรับพัสดุ",
  disburse: () => "รายงานผลการตรวจรับและขออนุมัติเบิกจ่าย",
};

const ORDER: Record<"ซื้อ" | "จ้าง", SheetKey[]> = {
  ซื้อ: ["request", "request_attach", "quote", "consider", "order", "order_attach", "inspect", "disburse"],
  จ้าง: ["request", "quote", "consider", "order", "handover", "inspect", "disburse"],
};

// ว 804 (ซื้อไม่เกิน 50,000 บาท) ๔ แผ่น ตามแบบที่ผู้ใช้ให้มา
const W804_ORDER: SheetKey[] = ["w804_request", "w804_spec", "w804_report", "w804_receipt"];

/** จำนวนรายการสูงสุดที่ใส่ในหัวข้อ 1 ของรายงานขอซื้อ ว 804 ได้เลย — ไม่เกินนี้ไม่ต้องพิมพ์แผ่นรายละเอียดคุณลักษณะ (ซ้ำกับหน้าแรก) */
export const W804_INLINE_MAX = 2;

export function procurementSheets(type: "ซื้อ" | "จ้าง", w804 = false, itemCount?: number) {
  const keys = w804 ? W804_ORDER.filter((k) => k !== "w804_spec" || itemCount == null || itemCount > W804_INLINE_MAX) : ORDER[type];
  return keys.map((key, i) => ({ no: i + 1, key, label: LABELS[key](type) }));
}
