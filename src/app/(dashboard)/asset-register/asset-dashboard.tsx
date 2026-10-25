"use client";

// แดชบอร์ดสรุปทะเบียนทรัพย์สิน (บนสุดของหน้า) — ตัวเลขรวมทุกรายการ + กราฟแยกตามสภาพ
// ดึงเฉพาะ 5 คอลัมน์ที่ใช้คำนวณ (ไม่ดึงชื่อ/รูป/สถานที่) แบ่งหน้าละ 1,000 แถว (เพดานของ Supabase)
// ค่าเสื่อมใช้ตรรกะเดียวกับ PDF ทะเบียนคุม (src/lib/asset-depreciation.ts) ยอดจึงตรงกัน

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/thai";
import { computeAssetDepreciation } from "@/lib/asset-depreciation";

type Condition = { id: string; name: string; badge_color: string };
type Category = { id: string; useful_life_years: number | null; depreciation_rate_percent: number | null };
export type DashboardRow = {
  price: number | null;
  acquired_date: string | null;
  acquired_year: number | null;
  category_id: string | null;
  condition_id: string | null;
};

// สีแท่งกราฟตามสีป้ายสภาพ (badge_color ในข้อมูลหลัก)
const BAR_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  navy: "bg-navy-800",
  slate: "bg-slate-400",
};

const PAGE = 1000;

// จำข้อมูลที่ดึงมาไว้ใน sessionStorage 30 นาที (หายเมื่อปิดแท็บ) — เปิดหน้าซ้ำไม่ต้องดึง Supabase ใหม่ทุกครั้ง
// เมื่อมีการเพิ่ม/แก้/ลบทรัพย์สิน หรือแก้ข้อมูลหลัก หน้าหลักเรียก clearAssetDashboardCache() ให้ดึงใหม่ทันที
const CACHE_KEY = "asset-dashboard-rows-v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

function readCache(): DashboardRow[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, rows } = JSON.parse(raw) as { at: number; rows: DashboardRow[] };
    if (typeof at !== "number" || Date.now() - at > CACHE_TTL_MS || !Array.isArray(rows)) return null;
    return rows;
  } catch {
    return null;
  }
}

export function clearAssetDashboardCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // เบราว์เซอร์ปิดการเก็บข้อมูล — ไม่มีแคชให้ล้าง
  }
}

export function AssetDashboard({
  conditions,
  categories,
  refreshKey,
  filteredRows,
  filterActive,
}: {
  conditions: Condition[];
  categories: Category[];
  refreshKey?: number;
  /** รายการที่ตรงตัวกรองจากแท็บทะเบียน (กดค้นหาแล้ว) — ถ้ามีจะรวมยอดเฉพาะรายการเหล่านี้แทนทั้งระบบ */
  filteredRows?: DashboardRow[] | null;
  /** true เมื่อมีการเลือกตัวกรอง (สถานที่/สภาพ/คำค้น) ไว้จริง */
  filterActive?: boolean;
}) {
  const [allRows, setRows] = useState<DashboardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(cached);
      return;
    }
    (async () => {
      const supabase = createClient();
      const all: DashboardRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data } = await supabase
          .from("asset_items")
          .select("price, acquired_date, acquired_year, category_id, condition_id")
          .order("id")
          .range(from, from + PAGE - 1);
        all.push(...((data as DashboardRow[] | null) ?? []));
        if (!data || data.length < PAGE) break;
      }
      if (!cancelled) {
        setRows(all);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: all }));
        } catch {
          // เก็บไม่ได้ก็แค่ไม่มีแคช
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const rows = filteredRows ?? allRows;
  const stats = useMemo(() => {
    if (!rows) return null;
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const t = { price: 0, annual: 0, cumulative: 0, net: 0 };
    for (const it of rows) {
      const cat = it.category_id ? catMap.get(it.category_id) : null;
      const d = computeAssetDepreciation({
        price: it.price,
        acquired_date: it.acquired_date,
        acquired_year: it.acquired_year,
        useful_life_years: cat?.useful_life_years ?? null,
        depreciation_rate_percent: cat?.depreciation_rate_percent ?? null,
      });
      t.price += it.price ?? 0;
      t.annual += d.annual ?? 0;
      t.cumulative += d.cumulative ?? 0;
      t.net += d.net ?? 0;
    }
    const counts = conditions.map((c) => ({ ...c, count: rows.filter((r) => r.condition_id === c.id).length }));
    const none = rows.filter((r) => !r.condition_id).length;
    if (none > 0) counts.push({ id: "__none__", name: "ไม่ระบุสภาพ", badge_color: "slate", count: none });
    return { total: rows.length, ...t, counts, max: Math.max(0, ...counts.map((c) => c.count)) };
  }, [rows, categories, conditions]);

  if (!stats) return <p className="mb-4 text-sm text-slate-500">กำลังโหลดแดชบอร์ด...</p>;

  const kpis = [
    { label: "จำนวนรายการ", value: stats.total.toLocaleString("th-TH"), unit: "รายการ", accent: false },
    { label: "ราคาทุนรวม", value: formatBaht(stats.price), unit: "บาท", accent: false },
    { label: "ค่าเสื่อม/ปี รวม", value: formatBaht(stats.annual), unit: "บาท", accent: false },
    { label: "ค่าเสื่อมสะสมรวม", value: formatBaht(stats.cumulative), unit: "บาท", accent: false },
    { label: "มูลค่าสุทธิรวม", value: formatBaht(stats.net), unit: "บาท", accent: true },
  ];

  return (
    <div className="mb-6">
      {filteredRows && filterActive && (
        <p className="mb-2 text-sm text-slate-500">
          ตัวเลขนี้รวมเฉพาะ <span className="font-semibold text-slate-900">{stats.total.toLocaleString("th-TH")}</span> รายการที่ตรงตัวกรอง
          {allRows ? ` (จากทั้งหมด ${allRows.length.toLocaleString("th-TH")} รายการ)` : ""}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card !p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${k.accent ? "text-navy-800" : "text-slate-900"}`}>{k.value}</p>
            <p className="text-xs text-slate-400">{k.unit}</p>
          </div>
        ))}
      </div>

      <div className="card mt-3">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">จำนวนรายการแยกตามสภาพ</h2>
        <div className="space-y-2.5">
          {stats.counts.map((c) => (
            <div key={c.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_auto]">
              <span className="truncate text-slate-700" title={c.name}>
                {c.name}
              </span>
              <div className="h-4 overflow-hidden rounded bg-slate-100">
                <div
                  className={`h-full rounded ${BAR_COLORS[c.badge_color] ?? "bg-slate-400"}`}
                  style={{ width: `${stats.max ? (c.count / stats.max) * 100 : 0}%`, minWidth: c.count > 0 ? "4px" : 0 }}
                />
              </div>
              <span className="w-24 text-right tabular-nums text-slate-900">
                {c.count.toLocaleString("th-TH")}{" "}
                <span className="text-xs text-slate-400">({stats.total ? Math.round((c.count / stats.total) * 100) : 0}%)</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
