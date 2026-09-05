"use client";

// AuthContext — เก็บชื่อ/สิทธิ์ของผู้ใช้ปัจจุบันไว้ที่เดียว โหลดครั้งเดียวตอนเข้าโซน dashboard
// แทนที่จะให้ (dashboard)/layout.tsx ยิง Supabase ใหม่ทุกครั้งที่เปลี่ยนเมนู
//
// สำคัญ: Provider นี้ต้องอยู่ใน (dashboard)/layout.tsx เท่านั้น ห้ามย้ายไป root layout เพราะ
// root layout ครอบหน้า /login ด้วย ถ้า mount ตั้งแต่หน้าล็อกอินจะได้ค่าว่าง แล้วตอนล็อกอินสำเร็จ
// (server action + redirect ซึ่งเป็น client-side navigation) root layout จะไม่ mount ใหม่
// ทำให้ข้อมูลค้างเป็นค่าว่างตลอด — เป็นสาเหตุที่ชื่อ/เมนูแอดมินหายไปในความพยายามรอบก่อน
//
// ระบบไม่มี Next.js middleware แล้ว (ลบทิ้งเพราะเพิ่ม ~250-350ms ทุก navigation โดยไม่จำเป็น —
// ดู /root/.claude/plans เฟส 3) จุดนี้จึงเป็น auth gate เดียวของระบบ: ถ้าโหลดเสร็จแล้วไม่มี user
// (session ไม่มี/หมดอายุ) ต้อง redirect ไป /login เอง — ข้อมูลจริงยังปลอดภัยเท่าเดิมเพราะ RLS
// ที่ฐานข้อมูลบล็อกอยู่แล้วไม่ว่าจะมี gate ชั้นนี้หรือไม่

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth-actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};

type AuthContextValue = {
  user: CurrentUser | null;
  isAdmin: boolean;
  roleLabel: string;
  displayName: string;
  avatarUrl: string | null;
  loading: boolean;
  pendingApproval: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = ยังโหลดไม่เสร็จ

  useEffect(() => {
    let active = true;

    async function load() {
      // ถ้าครั้งแรกได้ค่าว่าง (เช่นเน็ตสะดุด) จึงลองซ้ำอีกครั้งก่อนยอมแพ้ โดยยังคงสถานะ
      // "กำลังโหลด" ไว้ ไม่ให้แถบผู้ใช้กระพริบเป็นค่าว่างระหว่างรอ
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
        try {
          const result = await getCurrentUser();
          if (!active) return;
          if (result) {
            setUser(result);
            return;
          }
        } catch {
          if (!active) return;
        }
      }
      if (active) setUser(null);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  // เรียกใหม่ได้ตอนข้อมูลโปรไฟล์เปลี่ยน (เช่น อัปโหลด/ลบรูปประจำตัวที่หน้าโปรไฟล์) เพื่อให้แถบเมนู
  // ที่ mount ครั้งเดียวตอนเข้าโซน dashboard แสดงค่าใหม่ทันทีโดยไม่ต้องรีเฟรชหน้าเว็บ
  async function refresh() {
    const result = await getCurrentUser();
    setUser(result);
  }

  useEffect(() => {
    // โหลดเสร็จแล้วแต่ไม่มี user (ไม่มี session/session หมดอายุ) — ไม่มี middleware มา gate ให้
    // อีกต่อไป ต้อง redirect เอง (ใช้ replace ไม่ใช่ push กันปุ่มย้อนกลับพากลับมาหน้านี้ได้อีก)
    if (user === null) router.replace("/login");
  }, [user, router]);

  const role = user?.role ?? "";
  const isAdmin = role === "admin";
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "";
  const pendingApproval = user?.status === "pending";

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAdmin,
        roleLabel,
        displayName: user?.displayName ?? "",
        avatarUrl: user?.avatarUrl ?? null,
        loading: user === undefined,
        pendingApproval,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
