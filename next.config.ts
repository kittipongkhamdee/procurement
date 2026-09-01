import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ลดอาการหน่วงตอนคลิกเปลี่ยนเมนู: ให้ Client Router Cache จำข้อมูลของเลย์เอาต์/หน้า (แบบ dynamic)
    // ไว้ 30 วินาทีหลังโหลดครั้งแรก แทนที่จะยิง query ไป Supabase ใหม่ทุกครั้งที่เปลี่ยนหน้า
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
