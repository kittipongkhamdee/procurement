// ผู้ลงนามในเอกสารที่ระบบพิมพ์ — เก็บใน proc_app_settings (key/value) แอดมินแก้ได้ที่หน้าตั้งค่า
// "approval_signer_*" ใช้ในบันทึกขออนุมัติมาก่อนแล้ว; "doc_signer_*" ใช้ในเอกสารส่งมอบ/ตรวจรับ/เบิกจ่าย

export const DOCUMENT_SIGNERS = [
  { key: "approval_signer_planning", label: "เจ้าหน้าที่งานแผนงาน (ความเห็นงานแผนงาน)", fallback: "" },
  { key: "approval_signer_finance", label: "เจ้าหน้าที่การเงิน / ผู้จ่ายเงิน", fallback: "" },
  { key: "approval_signer_deputy", label: "รองผู้อำนวยการ", fallback: "" },
  { key: "approval_signer_director", label: "ผู้อำนวยการโรงเรียน", fallback: "" },
  { key: "doc_signer_procurement_officer", label: "เจ้าหน้าที่พัสดุ", fallback: "นางสาวโสรดา  ศรีสุข" },
  { key: "doc_signer_procurement_head", label: "หัวหน้าเจ้าหน้าที่พัสดุ", fallback: "นายกิตติพงษ์   คำดี" },
] as const;

export type DocumentSignerKey = (typeof DOCUMENT_SIGNERS)[number]["key"];
