"use client";

// Client Component — รวมเมนู "มาตรฐานการศึกษา" และ "กลยุทธ์โรงเรียน" (เดิมแยกคนละหน้า) เป็นหน้าเดียว
// สองหัวข้อ ดึงรายการผ่าน browser Supabase client แทนการรอ Server Component fetch ก่อนส่ง HTML
// กลับมา (RLS ของ plan_standards/plan_strategies อนุญาตให้ SELECT แบบ public สำหรับผู้ที่ล็อกอิน
// อยู่แล้ว ส่วนการแก้ไข/เพิ่ม/ลบยังคงบังคับ admin ผ่าน RLS ที่ชั้นฐานข้อมูลเหมือนเดิม)

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { NamedListManager } from "@/components/named-list-manager";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import {
  createStandard,
  createStrategy,
  deleteStandard,
  deleteStrategy,
  toggleStandardActive,
  toggleStrategyActive,
  updateStandardName,
  updateStrategyName,
} from "./actions";

type Item = { id: string; name: string; is_active: boolean };

export default function StandardsStrategiesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [standards, setStandards] = useState<Item[] | null>(null);
  const [strategies, setStrategies] = useState<Item[] | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: standardsData }, { data: strategiesData }] = await Promise.all([
      supabase.from("plan_standards").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("plan_strategies").select("id, name, is_active").order("sort_order").order("name"),
    ]);
    setStandards(standardsData ?? []);
    setStrategies(strategiesData ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [authLoading, isAdmin, reload]);

  if (authLoading) return <PageLoadingSkeleton />;

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">มาตรฐานและกลยุทธ์</h1>
          <p className="page-subtitle">
            กำหนดรายการมาตรฐานการศึกษาและกลยุทธ์โรงเรียนของสถานศึกษาสำหรับใช้อ้างอิงในการเสนอโครงการ
          </p>
        </div>
      </div>

      {standards === null || strategies === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NamedListManager
            title="รายการมาตรฐานการศึกษา"
            itemLabel="ชื่อมาตรฐาน"
            placeholder="เช่น มาตรฐานที่ 1 คุณภาพของผู้เรียน"
            items={standards}
            createItem={createStandard}
            updateItemName={updateStandardName}
            toggleItemActive={toggleStandardActive}
            deleteItem={deleteStandard}
            onChanged={reload}
          />
          <NamedListManager
            title="รายการกลยุทธ์โรงเรียน"
            itemLabel="ชื่อกลยุทธ์"
            placeholder="เช่น กลยุทธ์ที่ 1 พัฒนาคุณภาพและศักยภาพผู้เรียน"
            items={strategies}
            createItem={createStrategy}
            updateItemName={updateStrategyName}
            toggleItemActive={toggleStrategyActive}
            deleteItem={deleteStrategy}
            onChanged={reload}
          />
        </div>
      )}
    </div>
  );
}
