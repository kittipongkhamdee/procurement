import { redirect } from "next/navigation";

// ปิดหน้า "รายการขอซื้อ-ขอจ้าง" แล้ว — ใช้เมนูงานซื้อ/งานจ้าง (ตาราง proc_purchase_requests ชุดเดียวกัน) แทน
export default function NewPurchaseRequestPage() {
  redirect("/supplies/purchase");
}
