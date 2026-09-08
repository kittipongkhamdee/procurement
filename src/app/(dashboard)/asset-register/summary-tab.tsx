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

  // คำนวณค่าเสื่อมของทุกแถวที่ผ่านตัวกรองไว้ล่วงหน้าครั้งเดียว (ไม่ใช่แค่หน้าปัจจุบัน) เพื่อใช้ทั้งแสดง
  // ผลรายแถวและรวมยอดท้ายตาราง/การ์ดสรุป ให้ยอดรวมตรงกับ "ทั้งหมดที่กรองไว้" ไม่ใช่แค่หน้าที่เห็น
  const rowsWithTotals = filtered.map((it) => {
    const category = it.category_id ? categoryLookup.get(it.category_id) : null;
    const totals = computeAssetDepreciation({
      price: it.price,
      acquired_date: it.acquired_date,
      acquired_year: it.acquired_year,
      useful_life_years: category?.useful_life_years ?? null,
      depreciation_rate_percent: category?.depreciation_rate_percent ?? null,
    });
    return { it, category, totals };
  });

  const grandTotals = rowsWithTotals.reduce(
    (acc, { it, totals }) => ({
      price: acc.price + (it.price ?? 0),
      annual: acc.annual + (totals.annual ?? 0),
      cumulative: acc.cumulative + (totals.cumulative ?? 0),
      net: acc.net + (totals.net ?? 0),
    }),
    { price: 0, annual: 0, cumulative: 0, net: 0 },
  );

  const totalPages = Math.max(1, Math.ceil(rowsWithTotals.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rowsWithTotals.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
          พบ <span className="font-semibold text-slate-900">{rowsWithTotals.length.toLocaleString("th-TH")}</span> รายการ
          จากทั้งหมด {items.length.toLocaleString("th-TH")} รายการ
        </p>
        <a href={`/asset-register/summary/pdf?${buildSummaryQuery({ categoryFilter, conditionFilter, search })}`} target="_blank" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์
        </a>
      </div>

      {/* การ์ดสรุปยอดรวม — แสดงทุกขนาดจอ ให้เห็นยอดรวมได้ทันทีโดยไม่ต้องเลื่อนตารางไปดูคอลัมน์ท้ายสุด
          (โดยเฉพาะจอเล็ก/มือถือที่เลื่อนตารางแนวนอนดูยาก) */}
      <div className="card mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">ราคาทุนรวม (บาท)</p>
          <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatBaht(grandTotals.price)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">ค่าเสื่อม/ปี รวม (บาท)</p>
          <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatBaht(grandTotals.annual)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">ค่าเสื่อมสะสมรวม (บาท)</p>
          <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatBaht(grandTotals.cumulative)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">มูลค่าสุทธิรวม (บาท)</p>
          <p className="mt-0.5 font-semibold tabular-nums text-navy-800">{formatBaht(grandTotals.net)}</p>
        </div>
      </div>

      <div className="table-shell">
        {/* มือถือ/จอแคบ: การ์ดแสดงรายการทีละแถว แทนตารางกว้าง 14 คอลัมน์ที่เลื่อนดูยาก */}
        <div className="divide-y divide-slate-100 md:hidden">
          {pageRows.map(({ it, category, totals }, i) => {
            const cb = conditionBadge(it.condition);
            return (
              <div key={it.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="mr-1.5 text-xs tabular-nums text-slate-400">
                      {(currentPage - 1) * pageSize + i + 1}
                    </span>
                    <span className="font-medium text-slate-900">{it.name}</span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {it.asset_code ?? "ยังไม่ติดป้าย"} · {category?.name ?? "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {it.building} {it.floor ? `ชั้น ${it.floor}` : ""} {it.room}
                    </p>
                  </div>
                  <span className={`${cb.cls} shrink-0`}>{cb.label}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5 text-xs">
                  <div>
                    <p className="text-slate-400">จำนวน</p>
                    <p className="tabular-nums text-slate-700">
                      {it.quantity} {it.unit ?? ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">ปีที่ได้มา</p>
                    <p className="tabular-nums text-slate-700">{it.acquired_year ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">อายุใช้งาน (ปี)</p>
                    <p className="tabular-nums text-slate-700">{category?.useful_life_years ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">ราคาทุน</p>
                    <p className="tabular-nums text-slate-700">{formatBaht(it.price)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">ค่าเสื่อมสะสม</p>
                    <p className="tabular-nums text-slate-700">{formatBaht(totals.cumulative)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">มูลค่าสุทธิ</p>
                    <p className="font-medium tabular-nums text-navy-800">{formatBaht(totals.net)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {rowsWithTotals.length === 0 && <p className="table-empty">ไม่พบรายการ</p>}
        </div>

        {/* จอกว้าง: ตาราง — ลดระยะขอบเซลล์/ขนาดตัวหนังสือลงเหลือ text-xs ทั้งตาราง (เท่ากันทุกคอลัมน์
            รวม badge สภาพ) เพราะมีถึง 13 คอลัมน์ ลดโอกาสล้นจอ/ต้องเลื่อนแนวนอนมากเกินไป */}
        <div className="hidden overflow-x-auto md:block">
          <table className="table-base text-xs">
            <thead>
              <tr>
                <th className="px-2 py-2 text-center">ลำดับ</th>
                <th className="px-2 py-2">รายการ</th>
                <th className="px-2 py-2">หมวดหมู่</th>
                <th className="whitespace-nowrap px-2 py-2">หมายเลขครุภัณฑ์</th>
                <th className="whitespace-nowrap px-2 py-2 text-center">จำนวน/หน่วย</th>
                <th className="whitespace-nowrap px-2 py-2">ที่ตั้ง</th>
                <th className="px-2 py-2 text-center">สภาพ</th>
                <th className="whitespace-nowrap px-2 py-2 text-center">ปีที่ได้มา</th>
                <th className="whitespace-nowrap px-2 py-2 text-right">ราคาทุน (บาท)</th>
                <th className="whitespace-nowrap px-2 py-2 text-center">อายุใช้งาน (ปี)</th>
                <th className="whitespace-nowrap px-2 py-2 text-right">ค่าเสื่อม/ปี (บาท)</th>
                <th className="whitespace-nowrap px-2 py-2 text-right">ค่าเสื่อมสะสม (บาท)</th>
                <th className="whitespace-nowrap px-2 py-2 text-right">มูลค่าสุทธิ (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ it, category, totals }, i) => {
                const cb = conditionBadge(it.condition);
                return (
                  <tr key={it.id}>
                    <td className="px-2 py-2 text-center tabular-nums">{(currentPage - 1) * pageSize + i + 1}</td>
                    <td className="max-w-[14rem] whitespace-normal break-words px-2 py-2 font-medium text-slate-900">
                      {it.name}
                    </td>
                    <td className="px-2 py-2">{category?.name ?? "-"}</td>
                    <td className="whitespace-nowrap px-2 py-2">{it.asset_code ?? "ยังไม่ติดป้าย"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-center tabular-nums">
                      {it.quantity} {it.unit ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {it.building} {it.floor ? `ชั้น ${it.floor}` : ""} {it.room}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={cb.cls}>{cb.label}</span>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{it.acquired_year ?? "-"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBaht(it.price)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{category?.useful_life_years ?? "-"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBaht(totals.annual)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBaht(totals.cumulative)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBaht(totals.net)}</td>
                  </tr>
                );
              })}
              {rowsWithTotals.length === 0 && (
                <tr>
                  <td colSpan={13} className="table-empty">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
            {rowsWithTotals.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={8} className="whitespace-nowrap px-2 py-2">
                    รวม {rowsWithTotals.length.toLocaleString("th-TH")} รายการ
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBaht(grandTotals.price)}
                  </td>
                  <td className="px-2 py-2"></td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBaht(grandTotals.annual)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBaht(grandTotals.cumulative)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBaht(grandTotals.net)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
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
