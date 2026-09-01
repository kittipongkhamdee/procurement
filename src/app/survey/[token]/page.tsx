"use client";

// หน้าทำแบบประเมินสาธารณะแบบลิงก์เฉพาะโครงการ — ไม่ต้องล็อกอิน ไม่ระบุตัวตนผู้ตอบ อยู่นอก
// (dashboard) เหมือน /login จึงไม่ผ่าน AuthProvider/ไม่ถูกเด้งไปหน้า login เลย ตรรกะจริงอยู่ใน
// SurveyTaker (ใช้ร่วมกับ /survey/year/[year] ที่ผู้ตอบเลือกโครงการเองก่อน)

import { useParams } from "next/navigation";
import { SurveyTaker } from "../survey-taker";

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <SurveyTaker token={token} />
    </div>
  );
}
