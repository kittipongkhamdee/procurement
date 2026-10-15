// รายชื่อแผ่นในชุดเอกสารงานซื้อ/งานจ้าง (ใช้ทั้งฝั่ง PDF และปุ่มพิมพ์แยกแผ่นในหน้าเว็บ) — ลำดับในอาร์เรย์ = เลขแผ่น
// งานซื้อ ๘ แผ่น (ตามชุดซื้อเสารั้ว 81/2569), งานจ้าง ๗ แผ่น (ตามชุดจ้างช่างซ่อมแซมรั้ว 27/2569: ไม่มีแผ่นแนบท้าย มีใบส่งมอบงาน)

export type SheetKey = "request" | "request_attach" | "quote" | "consider" | "order" | "order_attach" | "handover" | "inspect" | "disburse";

const LABELS: Record<SheetKey, (v: string) => string> = {
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

export function procurementSheets(type: "ซื้อ" | "จ้าง") {
  return ORDER[type].map((key, i) => ({ no: i + 1, key, label: LABELS[key](type) }));
}
