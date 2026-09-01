"use client";

// AuthContext — เก็บ session ผู้ใช้และ role/ชื่อจาก proc_profiles ไว้ใน context เดียวทั้งแอป
// โหลดครั้งเดียวตอนเปิดแอป (ผ่าน browser client) แทนที่จะให้ (dashboard)/layout.tsx ยิง
// Supabase ซ้ำทุกครั้งที่เปลี่ยนหน้า ตามแนวทางเดียวกับระบบ exam-tbw

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};

type Profile = { full_name: string; role: string };

type AuthContextValue = {
  user: User | null;
  isAdmin: boolean;
  roleLabel: string;
  displayName: string;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = ยังโหลดไม่เสร็จ
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadProfile(u: User | null) {
      if (!u) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("proc_profiles")
        .select("full_name, role")
        .eq("user_id", u.id)
        .maybeSingle();
      if (active) setProfile(data);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      loadProfile(sessionUser);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      loadProfile(sessionUser);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = profile?.role === "admin";
  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role] ?? profile.role) : "";
  const displayName = profile?.full_name || user?.email || "";

  return (
    <AuthContext.Provider
      value={{ user: user ?? null, isAdmin, roleLabel, displayName, loading: user === undefined }}
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
