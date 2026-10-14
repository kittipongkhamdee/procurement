import { redirect } from "next/navigation";

// หน้าบันทึกส่งมอบงานย้ายไปอยู่ใต้ "งานสัญญา" แล้ว
export default function DeliveriesPage() {
  redirect("/contracts/delivery");
}
