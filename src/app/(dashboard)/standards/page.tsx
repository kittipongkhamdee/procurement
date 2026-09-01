"use client";

// Client Component — เหมือน /strategies (ดู /root/.claude/plans สำหรับบริบทเต็ม)
// ดึงรายการผ่าน browser Supabase client แทนการรอ Server Component fetch ก่อนส่ง HTML กลับมา
// RLS ของ plan_standards อนุญาตให้ SELECT แบบ public สำหรับผู้ที่ล็อกอินอยู่แล้ว ส่วนการแก้ไข/
// เพิ่ม/ลบยังคงบังคับ admin ผ่าน RLS ที่ชั้นฐานข้อมูลเหมือนเดิม

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { NamedListManager } from "@/components/named-list-manager";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { createStandard, deleteStandard, toggleStandardActive, updateStandardName } from "./actions";

type Item = { id: string; name: string; is_active: boolean };

export default function StandardsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("plan_standards")
      .select("id, name, is_active")
      .order("sort_order")
      .order("name");
    setItems(data ?? []);
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
          <h1 className="page-title">มาตรฐานการศึกษา</h1>
          <p className="page-subtitle">กำหนดรายการมาตรฐานการศึกษาของสถานศึกษาสำหรับใช้อ้างอิงในการเสนอโครงการ</p>
        </div>
      </div>

      {items === null ? (
        <PageLoadingSkeleton />
      ) : (
        <NamedListManager
          title="รายการมาตรฐานการศึกษา"
          itemLabel="ชื่อมาตรฐาน"
          placeholder="เช่น มาตรฐานที่ 1 คุณภาพของผู้เรียน"
          items={items}
          createItem={createStandard}
          updateItemName={updateStandardName}
          toggleItemActive={toggleStandardActive}
          deleteItem={deleteStandard}
          onChanged={reload}
        />
      )}
    </div>
  );
}
