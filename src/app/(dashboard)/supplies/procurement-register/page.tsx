"use client";

// ทะเบียนคุมจัดซื้อจัดจ้าง — รวมงานซื้อและงานจ้างของปีงบประมาณปัจจุบันในตารางเดียว (ดูอย่างเดียว แก้ไขที่หน้างานซื้อ/งานจ้าง)
// พิมพ์ PDF / ส่งออก Excel ด้วยตัวกรองชุดเดียวกัน

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { applyRegisterFilter, fetchProcurementRegister, shortThaiDate, type ProcurementRegisterRow } from "@/lib/procurement-register";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ExcelFileIcon, PrinterIcon, SearchIcon } from "@/components/icons";

const TYPE_PAGE = { ซื้อ: "/supplies/purchase", จ้าง: "/supplies/hire" } as const;

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProcurementRegisterPage() {
  const [data, setData] = useState<{ year: number | null; rows: ProcurementRegisterRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchProcurementRegister(createClient())
      .then(setData)
      .catch((err: Error) => {
        setError(err.message);
        setData({ year: null, rows: [] });
      });
  }, []);

  const filtered = useMemo(() => applyRegisterFilter(data?.rows ?? [], { type, q: query }), [data, type, query]);
  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const exportQuery = new URLSearchParams(Object.entries({ type, q: query.trim() }).filter(([, v]) => v)).toString();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ทะเบียนคุมจัดซื้อจัดจ้าง</h1>
          <p className="page-subtitle">
            รวมงานซื้อและงานจ้าง{data?.year ? ` · ปีงบประมาณ ${data.year}` : ""}
          </p>
        </div>
      </div>

      {data === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่ รายการ ผู้ขาย โครงการ" className="input w-full pl-9" />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input col-span-2 sm:col-span-1">
              <option value="">ทั้งงานซื้อและงานจ้าง</option>
              <option value="ซื้อ">งานซื้อ</option>
              <option value="จ้าง">งานจ้าง</option>
            </select>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {filtered.length} รายการ · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
            <div className="flex gap-2">
              <a href={`/supplies/procurement-register/pdf?${exportQuery}`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
                <PrinterIcon className="h-3.5 w-3.5" />
                พิมพ์
              </a>
              <a href={`/supplies/procurement-register/xlsx?${exportQuery}`} className="btn-secondary btn-sm">
                <ExcelFileIcon className="h-3.5 w-3.5" />
                ส่งออก Excel
              </a>
            </div>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={r.doc_type === "ซื้อ" ? "badge-emerald" : "badge-navy"}>งาน{r.doc_type}</span>
                    <span className="font-medium text-slate-900">{r.doc_no}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{r.item_name}</p>
                  <p className="text-sm text-slate-700">{r.vendor_name ?? "-"}</p>
                  <p className="text-xs text-slate-500">
                    {r.project_name ?? "ไม่ระบุโครงการ"}
                    {r.approval_no ? ` · บันทึกขออนุมัติ ${r.approval_no}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    รายงาน {formatThaiDate(r.record_date)} · สั่ง{r.doc_type} {formatThaiDate(r.order_date ?? r.record_date)}
                    {r.inspected_date ? ` · ตรวจรับ ${formatThaiDate(r.inspected_date)}` : ""}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatBaht(r.amount)} บาท
                    </span>
                    <Link href={TYPE_PAGE[r.doc_type]} className="btn-secondary btn-sm">
                      ไปหน้างาน{r.doc_type}
                    </Link>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">ไม่พบรายการ</p>}
            </div>

            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th rowSpan={2}>วันที่</th>
                  <th colSpan={2} className="text-center">
                    เลขที่
                  </th>
                  <th rowSpan={2}>รายการซื้อ / จ้าง</th>
                  <th rowSpan={2}>ผู้ขาย / ผู้รับจ้าง</th>
                  <th rowSpan={2} className="text-right">
                    จำนวนเงิน
                  </th>
                  <th rowSpan={2}>วันตรวจรับ</th>
                </tr>
                <tr>
                  <th className="text-center">ซื้อ</th>
                  <th className="text-center">จ้าง</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{shortThaiDate(r.record_date)}</td>
                    <td className="whitespace-nowrap text-center font-medium text-slate-900">{r.doc_type === "ซื้อ" ? r.doc_no : ""}</td>
                    <td className="whitespace-nowrap text-center font-medium text-slate-900">{r.doc_type === "จ้าง" ? r.doc_no : ""}</td>
                    <td>
                      <div>{r.item_name}</div>
                      <div className="text-sm text-slate-500">
                        เฉพาะเจาะจง{r.approval_no ? ` · ขออนุมัติ ${r.approval_no}` : ""}
                      </div>
                    </td>
                    <td>{r.vendor_name ?? "-"}</td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(r.amount)}</td>
                    <td className="whitespace-nowrap">{r.inspected_date ? shortThaiDate(r.inspected_date) : "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      ไม่พบรายการ
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
