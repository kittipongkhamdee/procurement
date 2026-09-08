"use client";

// แท็บ "สรุปรายการ" — ตารางรวมทุกรายการทรัพย์สิน 1 แถวต่อ 1 รายการ พร้อมยอดค่าเสื่อมราคา ณ ปัจจุบัน
// (ไม่ใช่ตารางค่าเสื่อมรายปีแบบในเอกสารทะเบียนคุมทรัพย์สินของแต่ละรายการ) ใช้ตรรกะคำนวณเดียวกับ
// PDF ทะเบียนคุมทรัพย์สิน (ดู src/lib/asset-depreciation.ts) เพื่อให้ยอดตรงกัน

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatBaht } from "@/lib/thai";
import { computeAssetDepreciation } from "@/lib/asset-depreciation";
import { PrinterIcon } from "@/components/icons";

type Option = { id: string; name: string };

type SummaryItem = {
  id: string;
  name: string;
  category_id: string | null;
  asset_code: string | null;
  quantity: number;
  unit: string | null;
  building: string;
  floor: string | null;
  room: string;
  condition: string;
  acquired_date: string | null;
  acquired_year: number | null;
  price: number | null;
};

const ALL = "__all__";

function conditionBadge(condition: string) {
  if (condition === "usable") return { cls: "badge-emerald", label: "ใช้งานได้" };
  if (condition === "damaged") return { cls: "badge-amber", label: "ชำรุด" };
  return { cls: "badge-red", label: "จำหน่าย" };
}

export function SummaryTab({ categories }: { categories: Option[] }) {
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [categoryLookup, setCategoryLookup] = useState<
    Map<string, { name: string; useful_life_years: number | null; depreciation_rate_percent: number | null }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [conditionFilter, setConditionFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: itemsData }, { data: categoriesData }] = await Promise.all([
      supabase
        .from("asset_items")
        .select("id, name, category_id, asset_code, quantity, unit, building, floor, room, condition, acquired_date, acquired_year, price")
        .order("created_at", { ascending: false }),
      supabase.from("asset_categories").select("id, name, useful_life_years, depreciation_rate_percent"),
    ]);
    setItems((itemsData as unknown as SummaryItem[]) ?? []);
    setCategoryLookup(new Map((categoriesData ?? []).map((c) => [c.id, c])));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  if (loading) return <p className="table-empty">กำลังโหลดข้อมูล...</p>;

  const filtered = items.filter((it) => {
    if (categoryFilter !== ALL && it.category_id !== categoryFilter) return false;
    if (conditionFilter !== ALL && it.condition !== conditionFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${it.name} ${it.asset_code ?? ""} ${it.building} ${it.room}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="card mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">หมวดหมู่</label>
            <select value={categoryFilter} onChange={(e) => updateFilter(setCategoryFilter, e.target.value)} className="input">
              <option value={ALL}>ทั้งหมด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">สภาพ</label>
            <select value={conditionFilter} onChange={(e) => updateFilter(setConditionFilter, e.target.value)} className="input">
              <option value={ALL}>ทั้งหมด</option>
              <option value="usable">ใช้งานได้</option>
              <option value="damaged">ชำรุด</option>
              <option value="disposal">จำหน่าย</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">ค้นหา</label>
            <input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="ชื่อ/รหัสครุภัณฑ์/สถานที่"
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          พบ <span className="font-semibold text-slate-900">{filtered.length.toLocaleString("th-TH")}</span> รายการ
          จากทั้งหมด {items.length.toLocaleString("th-TH")} รายการ
        </p>
        <a href={`/asset-register/summary/pdf?${buildSummaryQuery({ categoryFilter, conditionFilter, search })}`} target="_blank" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์
        </a>
      </div>

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr>
              <th className="text-center">ลำดับ</th>
              <th>รายการ</th>
              <th>หมวดหมู่</th>
              <th className="whitespace-nowrap">หมายเลขครุภัณฑ์</th>
              <th className="text-center">จำนวน</th>
              <th className="whitespace-nowrap">หน่วย</th>
              <th className="whitespace-nowrap">ที่ตั้ง</th>
              <th className="text-center">สภาพ</th>
              <th className="whitespace-nowrap text-center">ปีที่ได้มา</th>
              <th className="whitespace-nowrap text-right">ราคาทุน (บาท)</th>
              <th className="whitespace-nowrap text-center">อายุใช้งาน (ปี)</th>
              <th className="whitespace-nowrap text-right">ค่าเสื่อม/ปี (บาท)</th>
              <th className="whitespace-nowrap text-right">ค่าเสื่อมสะสม (บาท)</th>
              <th className="whitespace-nowrap text-right">มูลค่าสุทธิ (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((it, i) => {
              const category = it.category_id ? categoryLookup.get(it.category_id) : null;
              const totals = computeAssetDepreciation({
                price: it.price,
                acquired_date: it.acquired_date,
                acquired_year: it.acquired_year,
                useful_life_years: category?.useful_life_years ?? null,
                depreciation_rate_percent: category?.depreciation_rate_percent ?? null,
              });
              const cb = conditionBadge(it.condition);
              return (
                <tr key={it.id}>
                  <td className="text-center tabular-nums">{(currentPage - 1) * pageSize + i + 1}</td>
                  <td className="max-w-xs whitespace-normal break-words font-medium text-slate-900">{it.name}</td>
                  <td>{category?.name ?? "-"}</td>
                  <td className="whitespace-nowrap">{it.asset_code ?? "ยังไม่ติดป้าย"}</td>
                  <td className="text-center tabular-nums">{it.quantity}</td>
                  <td className="whitespace-nowrap">{it.unit ?? "-"}</td>
                  <td className="whitespace-nowrap">
                    {it.building} {it.floor ? `ชั้น ${it.floor}` : ""} {it.room}
                  </td>
                  <td className="text-center">
                    <span className={cb.cls}>{cb.label}</span>
                  </td>
                  <td className="text-center tabular-nums">{it.acquired_year ?? "-"}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(it.price)}</td>
                  <td className="text-center tabular-nums">{category?.useful_life_years ?? "-"}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(totals.annual)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(totals.cumulative)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(totals.net)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="table-empty">
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-sm text-slate-500">
            หน้า {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      )}
    </div>
  );
}

function buildSummaryQuery({
  categoryFilter,
  conditionFilter,
  search,
}: {
  categoryFilter: string;
  conditionFilter: string;
  search: string;
}) {
  const params = new URLSearchParams();
  if (categoryFilter !== ALL) params.set("category", categoryFilter);
  if (conditionFilter !== ALL) params.set("condition", conditionFilter);
  if (search.trim()) params.set("q", search.trim());
  return params.toString();
}
