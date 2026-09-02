"use client";

// login/page.tsx เป็น Server Component (async) จึงเรียก SweetAlert2 (ต้องใช้ document) ตรงๆ ไม่ได้
// คอมโพเนนต์นี้รับข้อความ error (แปลเป็นไทยแล้วจาก actions.ts) มายิงเป็นป๊อปอัปเด่นกลางจอแทน
// ข้อความแบบ inline banner เดิม
import { useEffect } from "react";
import { alertError } from "@/lib/swal";

export function LoginErrorAlert({ message }: { message: string }) {
  useEffect(() => {
    alertError({ title: "เข้าสู่ระบบไม่สำเร็จ", text: message });
  }, [message]);

  return null;
}
