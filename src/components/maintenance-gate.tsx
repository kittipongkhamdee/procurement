"use client";

// ตัวกั้น "โหมดปิดปรับปรุงระบบ" — ครอบทั้งโซน dashboard (ดู (dashboard)/layout.tsx)
// - แอดมินเปิดโหมดนี้ได้ที่ ตั้งค่าระบบ > ปิดปรับปรุงระบบชั่วคราว (ค่าเก็บที่ proc_school_settings.maintenance_enabled)
// - เปิดอยู่: ผู้ใช้ที่ไม่ใช่ผู้ดูแลระบบเห็นหน้า "ปิดปรับปรุงชั่วคราว" แทนทั้งระบบ ส่วนผู้ดูแลระบบใช้งานได้ตามปกติ
//   (มีแถบเตือนด้านบน) จึงไม่มีทางล็อกตัวเองออก — ปิดโหมดนี้ได้เสมอจากหน้าตั้งค่า
// - เป็นการกั้นฝั่งหน้าจอเท่านั้น ไม่ใช่ความปลอดภัยของข้อมูล (ข้อมูลจริงยังป้องกันด้วย RLS ที่ฐานข้อมูลเหมือนเดิม)
//   และหน้าสาธารณะ (/survey, /login) ไม่ถูกกั้น
// - ตรวจสถานะซ้ำทุก 30 วินาที และตอนกลับมาเปิดแท็บ เพื่อให้หน้าปิดปรับปรุงเปลี่ยนกลับเองเมื่อเปิดระบบแล้ว

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { DEFAULT_SCHOOL_SETTINGS } from "@/lib/school-settings";
import { MaintenancePage } from "@/components/maintenance-page";

type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  schoolName: string;
  logoUrl: string | null;
};

const POLL_MS = 30_000;

export function MaintenanceGate({
  logoutAction,
  children,
}: {
  logoutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const { user, isAdmin, loading } = useAuth();
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedStillClosed, setCheckedStillClosed] = useState(false);
  // ผู้ดูแลระบบเปิดดูตัวอย่างหน้าปิดปรับปรุงได้ที่ /?maintenance_preview=1 (ลิงก์อยู่ในหน้าตั้งค่า) โดยไม่ต้องปิดระบบจริง
  const [previewRequested, setPreviewRequested] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewRequested(new URLSearchParams(window.location.search).get("maintenance_preview") === "1");
  }, []);

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await createClient()
        .from("proc_school_settings")
        .select("school_name, logo_url, maintenance_enabled, maintenance_message")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      const next: MaintenanceState = {
        enabled: data?.maintenance_enabled ?? false,
        message: data?.maintenance_message ?? null,
        schoolName: data?.school_name ?? DEFAULT_SCHOOL_SETTINGS.schoolName,
        logoUrl: data?.logo_url ?? null,
      };
      setState(next);
      return next.enabled;
    } catch {
      // อ่านสถานะไม่ได้ (เน็ตสะดุด) — ถือว่าไม่ได้ปิดปรับปรุง ไม่ขวางการใช้งาน แต่ถ้าเคยรู้ว่าปิดอยู่ ให้คงสถานะเดิม
      setState((prev) => prev ?? { enabled: false, message: null, schoolName: DEFAULT_SCHOOL_SETTINGS.schoolName, logoUrl: null });
      return false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const enabled = state?.enabled ?? false;
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, load]);

  async function handleRetry() {
    setChecking(true);
    setCheckedStillClosed(false);
    const stillClosed = await load();
    setCheckedStillClosed(stillClosed);
    setChecking(false);
  }

  // ยังไม่รู้สถานะ (หรือกำลังรอรู้ว่าใครล็อกอินอยู่ ในกรณีที่ปิดปรับปรุง) — ไม่แสดงเนื้อหาระบบไปก่อน กันภาพกระพริบ
  if (state === null || ((state.enabled || previewRequested) && loading)) {
    return <div className="min-h-screen bg-slate-100" />;
  }

  if (previewRequested && isAdmin && !loading) {
    return (
      <MaintenancePage
        schoolName={state.schoolName}
        logoUrl={state.logoUrl}
        message={state.message}
        checking={false}
        checkedStillClosed={false}
        onRetry={() => {}}
        logoutAction={logoutAction}
        preview
      />
    );
  }

  if (state.enabled && user && !isAdmin) {
    return (
      <MaintenancePage
        schoolName={state.schoolName}
        logoUrl={state.logoUrl}
        message={state.message}
        checking={checking}
        checkedStillClosed={checkedStillClosed}
        onRetry={handleRetry}
        logoutAction={logoutAction}
      />
    );
  }

  return (
    <>
      {state.enabled && isAdmin && (
        <div
          role="status"
          className="bg-amber-500 px-4 py-1.5 text-center text-sm font-semibold text-navy-950 print:hidden"
        >
          ระบบอยู่ในโหมดปิดปรับปรุง — ผู้ใช้อื่นเข้าใช้งานไม่ได้ (ปิดโหมดนี้ได้ที่ ตั้งค่าระบบ)
        </div>
      )}
      {children}
    </>
  );
}
