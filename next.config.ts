import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ลดอาการหน่วงตอนคลิกเปลี่ยนเมนู: ให้ Client Router Cache จำข้อมูลของเลย์เอาต์/หน้า (แบบ dynamic)
    // ไว้ 30 วินาทีหลังโหลดครั้งแรก แทนที่จะยิง query ไป Supabase ใหม่ทุกครั้งที่เปลี่ยนหน้า
    staleTimes: {
      dynamic: 30,
    },
    // ค่าเริ่มต้นของ Next.js จำกัด payload ของ Server Action ไว้แค่ 1MB — รูปถ่ายจากมือถือ
    // (เช่น อัปโหลดโลโก้โรงเรียน หรือไฟล์เอกสารทั่วไป) มักใหญ่กว่านี้มาก ทำให้ก่อนหน้านี้ล้มเหลว
    // แบบ error กำกวม (React error #441 "Server Components render error") ตั้งแต่ชั้น framework
    // ก่อนโค้ดในแอ็กชันจะได้ทำงานด้วยซ้ำ ขยายเป็น 10MB ให้พอสำหรับไฟล์รูป/เอกสารทั่วไป
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
