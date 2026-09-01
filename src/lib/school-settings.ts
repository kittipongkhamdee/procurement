"use client";

// ดึงชื่อโรงเรียน + โลโก้ที่แอดมินตั้งค่าไว้ (ตาราง proc_school_settings แถวเดียว อ่านได้แบบ public)
// ใช้แทนค่า hardcode "โรงเรียนตาเบาวิทยา"/โลโก้ "ตว" เดิมทั้งฝั่ง dashboard และหน้าสาธารณะ
// (หน้าทำแบบประเมิน) — คืนค่าเริ่มต้นไปก่อนระหว่างโหลด กันไม่ให้หน้าจอกระพริบว่างเปล่า

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SchoolSettings = { schoolName: string; logoUrl: string | null };

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = { schoolName: "โรงเรียนตาเบาวิทยา", logoUrl: null };

export function useSchoolSettings(): SchoolSettings {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);

  useEffect(() => {
    let active = true;
    createClient()
      .from("proc_school_settings")
      .select("school_name, logo_url")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) {
          setSettings({ schoolName: data.school_name, logoUrl: data.logo_url });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
