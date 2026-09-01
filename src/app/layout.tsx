import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

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
  return (
    <html lang="th" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
