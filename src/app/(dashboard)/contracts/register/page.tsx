"use client";

// ทะเบียนสัญญา — รวมสัญญาทุกประเภทในตารางเดียว กรองตามประเภท ปีงบประมาณ และสถานะ (ดูอย่างเดียว
// แก้ไขที่หน้าของแต่ละประเภท)

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ChevronLeftIcon, SearchIcon } from "@/components/icons";

type Row = {
  id: string;
  contract_type: string;
  contract_no: string;
  contract_date: string;
  end_date: string | null;
  vendor_name: string;
  amount: number;
  plan_projects: { name: string } | null;
};

const TYPE_PAGE: Record<string, string | null> = { จ้าง: "/contracts/hire", ซื้อ: "/contracts/purchase", เช่า: null };

/** ปีงบประมาณไทย (ต.ค.–ก.ย.) ของวันที่ ISO */
function fiscalYear(iso: string): number {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

function status(endDate: string | null): { key: string; label: string; cls: string } {
  if (!endDate) return { key: "none", label: "ไม่ระบุวันสิ้นสุด", cls: "badge-slate" };
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(endDate) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { key: "overdue", label: `เลยกำหนด ${-days} วัน`, cls: "badge-red" };
  if (days <= 7) return { key: "due", label: `เหลือ ${days} วัน`, cls: "badge-amber" };
  return { key: "active", label: "อยู่ในสัญญา", cls: "badge-emerald" };
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContractRegisterPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const [stat, setStat] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    createClient()
      .from("proc_contracts")
      .select("id, contract_type, contract_no, contract_date, end_date, vendor_name, amount, plan_projects(name)")
      .order("contract_date", { ascending: false })
      .then(({ data, error }) => {
        setError(error?.message ?? null);
        setRows((data as unknown as Row[]) ?? []);
      });
  }, []);

  const years = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => fiscalYear(r.contract_date)))).sort((a, b) => b - a),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!type || r.contract_type === type) &&
        (!year || fiscalYear(r.contract_date) === Number(year)) &&
        (!stat || status(r.end_date).key === stat) &&
        (!q || [r.contract_no, r.vendor_name, r.plan_projects?.name].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, type, year, stat, query]);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/contracts" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
            <ChevronLeftIcon className="h-4 w-4" />
            งานสัญญา
          </Link>
          <h1 className="page-title">ทะเบียนสัญญา</h1>
          <p className="page-subtitle">รวมสัญญาทุกประเภท</p>
        </div>
      </div>

      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่ คู่สัญญา โครงการ" className="input w-full pl-9" />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              <option value="">ทุกประเภท</option>
              <option value="จ้าง">สัญญาจ้าง</option>
              <option value="ซื้อ">สัญญาซื้อ</option>
              <option value="เช่า">สัญญาเช่า</option>
            </select>
            <select value={year} onChange={(e) => setYear(e.target.value)} className="input">
              <option value="">ทุกปีงบประมาณ</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  ปีงบประมาณ {y}
                </option>
              ))}
            </select>
            <select value={stat} onChange={(e) => setStat(e.target.value)} className="input col-span-2 sm:col-span-1">
              <option value="">ทุกสถานะ</option>
              <option value="active">อยู่ในสัญญา</option>
              <option value="due">ใกล้ครบ (≤7 วัน)</option>
              <option value="overdue">เลยกำหนด</option>
              <option value="none">ไม่ระบุวันสิ้นสุด</option>
            </select>
          </div>
          <p className="mb-3 text-sm text-slate-500">
            {filtered.length} สัญญา · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
          </p>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((r) => {
                const st = status(r.end_date);
                const href = TYPE_PAGE[r.contract_type];
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-navy">สัญญา{r.contract_type}</span>
                      <span className="font-medium text-slate-900">{r.contract_no}</span>
                      <span className={st.cls}>{st.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{r.vendor_name}</p>
                    <p className="text-xs text-slate-500">{r.plan_projects?.name ?? "ไม่ระบุโครงการ"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      ทำสัญญา {formatThaiDate(r.contract_date)}
                      {r.end_date ? ` · สิ้นสุด ${formatThaiDate(r.end_date)}` : ""}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{formatBaht(Number(r.amount))} บาท</span>
                      {href && (
                        <Link href={href} className="btn-secondary btn-sm">
                          ไปหน้าสัญญา
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="table-empty">ไม่พบสัญญา</p>}
            </div>

            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th>เลขที่สัญญา</th>
                  <th>วันที่ทำสัญญา</th>
                  <th>คู่สัญญา</th>
                  <th>โครงการ</th>
                  <th>สิ้นสุดสัญญา</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const st = status(r.end_date);
                  const href = TYPE_PAGE[r.contract_type];
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="badge-navy text-sm">สัญญา{r.contract_type}</span>
                      </td>
                      <td className="font-medium text-slate-900">{r.contract_no}</td>
                      <td>{formatThaiDate(r.contract_date)}</td>
                      <td>{r.vendor_name}</td>
                      <td>{r.plan_projects?.name ?? "-"}</td>
                      <td>
                        <div>{r.end_date ? formatThaiDate(r.end_date) : "-"}</div>
                        <span className={`${st.cls} text-sm`}>{st.label}</span>
                      </td>
                      <td className="text-right font-semibold text-slate-900">{formatBaht(Number(r.amount))}</td>
                      <td className="text-right">
                        {href && (
                          <Link href={href} className="btn-secondary btn-sm">
                            ไปหน้าสัญญา
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      ไม่พบสัญญา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
