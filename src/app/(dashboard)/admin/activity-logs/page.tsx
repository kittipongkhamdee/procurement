"use client";

// ประวัติการใช้งานระบบ — เฉพาะแอดมิน (RLS ที่ฐานข้อมูลเป็นด่านจริง ฝั่งนี้แค่ซ่อนหน้า)
// เก็บย้อนหลังไม่เกิน 30 วัน และไม่เกิน 100 รายการล่าสุด (ตัดทิ้งเองตอนมีรายการใหม่เข้า — ดู proc_activity_write)
// เหตุการณ์ที่บันทึก: เข้า/ออกระบบ (login/actions.ts) + เพิ่ม/แก้/ลบ/เปลี่ยนสถานะ ผ่านทริกเกอร์ในฐานข้อมูล

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";

type Log = { id: number; created_at: string; user_name: string; action: string; entity: string; summary: string };

const ACTIONS: Record<string, { label: string; badge: string }> = {
  login: { label: "เข้าสู่ระบบ", badge: "badge-navy" },
  logout: { label: "ออกจากระบบ", badge: "badge-slate" },
  create: { label: "เพิ่ม", badge: "badge-emerald" },
  update: { label: "แก้ไข", badge: "badge-amber" },
  delete: { label: "ลบ", badge: "badge-red" },
  status: { label: "เปลี่ยนสถานะ", badge: "badge-navy" },
};

const dateTimeFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export default function ActivityLogsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("proc_activity_logs")
      .select("id, created_at, user_name, action, entity, summary")
      .gte("created_at", since)
      .order("id", { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    setLogs(data ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [authLoading, isAdmin, reload]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs ?? []).filter(
      (l) => (!actionFilter || l.action === actionFilter) && (!q || `${l.user_name} ${l.entity} ${l.summary}`.toLowerCase().includes(q)),
    );
  }, [logs, actionFilter, search]);

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
          <h1 className="page-title">ประวัติการใช้งานระบบ</h1>
          <p className="page-subtitle">
            เข้า-ออกระบบ และการเพิ่ม/แก้ไข/ลบ/เปลี่ยนสถานะข้อมูล — เก็บย้อนหลังไม่เกิน 30 วัน และไม่เกิน 100 รายการล่าสุด
          </p>
        </div>
        <button type="button" onClick={reload} className="btn-secondary btn-sm">
          โหลดใหม่
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input w-44">
          <option value="">ทุกประเภท</option>
          {Object.entries(ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อผู้ใช้/เรื่อง/รายละเอียด"
          className="input w-full sm:w-72"
        />
      </div>

      {logs === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          {error && <p className="mt-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <p className="mt-4 text-sm text-slate-500">
            แสดง {shown.length} จาก {logs.length} รายการ
          </p>

          <div className="mt-2 space-y-2 md:hidden">
            {shown.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">ไม่มีรายการ</p>}
            {shown.map((l) => (
              <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className={ACTIONS[l.action]?.badge ?? "badge-slate"}>{ACTIONS[l.action]?.label ?? l.action}</span>
                  <span className="text-xs text-slate-500">{dateTimeFmt.format(new Date(l.created_at))}</span>
                </div>
                <p className="mt-1 font-medium text-slate-900">{l.user_name || "-"}</p>
                <p className="text-slate-600">
                  {l.entity} · {l.summary}
                </p>
              </div>
            ))}
          </div>

          <div className="table-shell mt-2 hidden md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>วันเวลา</th>
                  <th>ผู้ใช้</th>
                  <th>ประเภท</th>
                  <th>เรื่อง</th>
                  <th>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500">
                      ไม่มีรายการ
                    </td>
                  </tr>
                )}
                {shown.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{dateTimeFmt.format(new Date(l.created_at))}</td>
                    <td>{l.user_name || "-"}</td>
                    <td>
                      <span className={ACTIONS[l.action]?.badge ?? "badge-slate"}>{ACTIONS[l.action]?.label ?? l.action}</span>
                    </td>
                    <td>{l.entity}</td>
                    <td>{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
