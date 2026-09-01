import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ระบบบริหารงานงบประมาณ โรงเรียนตาเบาวิทยา",
  description: "ระบบจัดซื้อจัดจ้างและงบประมาณโรงเรียนตาเบาวิทยา",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // บังคับ dir="ltr" เพราะมือถือบางเครื่องเปิด "บังคับ RTL" ระดับ OS (accessibility) ทำให้ข้อความ
  // ที่ไม่ได้ระบุทิศทางชัดเจนเด้งไปชิดขวาทั้งแอป (พบใน popup แก้ไข/เพิ่มข้อมูล) — ภาษาไทยเป็น LTR เสมอ
  // จึงบังคับตรงนี้จุดเดียวกันปัญหาซ้ำในทุกหน้า ไม่ต้องไล่แก้ทีละฟอร์ม
  return (
    <html lang="th" dir="ltr" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
