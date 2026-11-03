import { redirect } from "next/navigation";

// ยุบรวมกับ "สัญญาจ้าง (ครูอัตราจ้าง)" ที่ /contracts/teacher-hire แล้ว (โรงเรียนใช้สัญญาจ้างครูอัตราจ้างอย่างเดียว) —
// ลิงก์/บุ๊กมาร์กเดิมยังเข้าได้ แต่พาไปหน้าใหม่ (ฟอร์มสัญญาจ้างทำของแบบเดิมยังอยู่ที่ ContractList type="จ้าง" ถ้าต้องเปิดกลับมาใช้)
export default function HireContractsPage() {
  redirect("/contracts/teacher-hire");
}
