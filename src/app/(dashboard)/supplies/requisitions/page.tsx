"use client";

// ใบเบิกพัสดุ — รายการใบเบิกที่บันทึกจากเมนูบัญชีวัสดุ (เบิกเอง หรือออกอัตโนมัติตอนดึงจากรายการจัดซื้อ)
// ลบใบเบิก = คืนยอดเข้าบัญชีวัสดุ (แถวจ่ายของใบเบิกนั้นถูกลบด้วย)

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ArchiveIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { deleteRequisition } from "../stock/stock-actions";

type Req = {
  id: string;
  doc_no: string | null;
  req_date: string;
  requester_name: string;
  requester_position: string | null;
  purpose: string | null;
  source_type: string | null;
  proc_stock_moves: { qty: number; unit_price: number; item_id: string; proc_stock_items: { name: string } | null }[];
};

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RequisitionsPage() {
  const { isProcStaff } = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    const { data, error } = await createClient()
      .from("proc_stock_requisitions")
      .select("id, doc_no, req_date, requester_name, requester_position, purpose, source_type, proc_stock_moves(qty, unit_price, item_id, proc_stock_items(name))")
      .order("req_date", { ascending: false })
      .order("created_at", { ascending: false });
    setError(error?.message ?? null);
    setRows((data as unknown as Req[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows ?? [];
    return rows.filter((r) => [r.doc_no, r.requester_name, r.purpose, ...r.proc_stock_moves.map((m) => m.proc_stock_items?.name)].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, query]);

  const itemNames = (r: Req) => [...new Set(r.proc_stock_moves.map((m) => m.proc_stock_items?.name).filter(Boolean))].join(", ");
  const value = (r: Req) => r.proc_stock_moves.reduce((s, m) => s + Number(m.qty) * Number(m.unit_price), 0);

  async function remove(r: Req) {
    const ok = await confirmDelete({ title: `ลบใบเบิก ${r.doc_no ?? ""}?`, text: "วัสดุที่จ่ายตามใบเบิกนี้จะคืนเข้าบัญชีวัสดุ" });
    if (!ok) return;
    const res = await deleteRequisition(r.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }

  function actions(r: Req) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        <a href={`/supplies/requisitions/${r.id}/pdf`} target="_blank" rel="noreferrer" title="พิมพ์ใบเบิก" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          <span className="btn-label">พิมพ์</span>
        </a>
        {isProcStaff && (
          <button type="button" onClick={() => remove(r)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ใบเบิกพัสดุ</h1>
          <p className="page-subtitle">ใบเบิกวัสดุจากคลัง — บันทึกการเบิกที่เมนูบัญชีวัสดุ</p>
        </div>
        <Link href="/supplies/stock" className="btn-secondary inline-flex items-center gap-2">
          <ArchiveIcon className="h-4 w-4" />
          ไปบัญชีวัสดุ
        </Link>
      </div>
      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="relative mb-3 w-full sm:w-80">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่ ผู้เบิก วัสดุ" className="input w-full pl-9" />
          </div>
          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[52rem]:hidden">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.doc_no ?? "-"}</span>
                    <span className="text-sm text-slate-500">{formatThaiDate(r.req_date)}</span>
                    {r.source_type && <span className="badge-slate !text-sm">จากรายการจัดซื้อ</span>}
                  </div>
                  <p className="text-sm text-slate-700">{r.requester_name}</p>
                  <p className="text-xs text-slate-500">{itemNames(r)}</p>
                  <div className="mt-2">{actions(r)}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">ยังไม่มีใบเบิก</p>}
            </div>
            <table className="hidden table-base w-full min-w-0 @min-[52rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่</th>
                  <th>ผู้เบิก</th>
                  <th>รายการ</th>
                  <th>เพื่อ</th>
                  <th className="text-right">มูลค่า</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                    <td className="whitespace-nowrap">{formatThaiDate(r.req_date)}</td>
                    <td>{r.requester_name}</td>
                    <td>{itemNames(r)}</td>
                    <td>{r.purpose ?? "-"}</td>
                    <td className="text-right tabular-nums">{baht(value(r))}</td>
                    <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(r)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      ยังไม่มีใบเบิก
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
