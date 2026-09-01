"use client";

// AuthContext — เก็บชื่อ/สิทธิ์ของผู้ใช้ปัจจุบันไว้ที่เดียว โหลดครั้งเดียวตอนเข้าโซน dashboard
// แทนที่จะให้ (dashboard)/layout.tsx ยิง Supabase ใหม่ทุกครั้งที่เปลี่ยนเมนู
//
// สำคัญ: Provider นี้ต้องอยู่ใน (dashboard)/layout.tsx เท่านั้น ห้ามย้ายไป root layout เพราะ
// root layout ครอบหน้า /login ด้วย ถ้า mount ตั้งแต่หน้าล็อกอินจะได้ค่าว่าง แล้วตอนล็อกอินสำเร็จ
// (server action + redirect ซึ่งเป็น client-side navigation) root layout จะไม่ mount ใหม่
// ทำให้ข้อมูลค้างเป็นค่าว่างตลอด — เป็นสาเหตุที่ชื่อ/เมนูแอดมินหายไปในความพยายามรอบก่อน

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined); // undefined = ยังโหลดไม่เสร็จ

  useEffect(() => {
    let active = true;

    async function load() {
      // ผู้ที่เข้ามาถึงโซน dashboard ได้ต้องผ่าน middleware มาแล้ว = ล็อกอินอยู่แน่นอน
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

  const role = user?.role ?? "";
  const isAdmin = role === "admin";
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "";

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAdmin,
        roleLabel,
        displayName: user?.displayName ?? "",
        loading: user === undefined,
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
