"use client";

// Client Component — ดึงรายการขอซื้อ-ขอจ้างผ่าน browser Supabase client (ต่อจาก /approvals
// ฯลฯ — ดู /root/.claude/plans) หน้า /purchase-requests/new และ /purchase-requests/[id]/pdf
// ยังคงเป็น Server Component เดิม ไม่แตะ

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type PurchaseRequest = {
  id: string;
  doc_type: string;
  doc_no: string;
  record_date: string;
  item_name: string | null;
  amount: number;
  pdf_url: string | null;
  proc_vendors: { name: string } | null;
};

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedPdfUrls, setSignedPdfUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // pdf_url stores a private storage path, not a public URL — sign it fresh on every
      // load (1hr expiry) instead of exposing a permanent public link to procurement docs.
      const { data, error } = await supabase
        .from("proc_purchase_requests")
        .select("id, doc_type, doc_no, record_date, item_name, amount, pdf_url, proc_vendors(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) setError(error.message);
      const rows = (data as unknown as PurchaseRequest[]) ?? [];
      setRequests(rows);

      const paths = rows.map((r) => r.pdf_url).filter((p): p is string => !!p);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage.from("procurement-documents").createSignedUrls(paths, 3600);
        const map = new Map<string, string>();
        signed?.forEach((s) => {
          if (s.signedUrl && !s.error) map.set(s.path ?? "", s.signedUrl);
        });
        setSignedPdfUrls(map);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">รายการขอซื้อ-ขอจ้าง</h1>
          <p className="page-subtitle">บันทึกขอซื้อ/ขอจ้างทั้งหมดในระบบ</p>
        </div>
        <a href="/purchase-requests/new" className="btn-primary">
          + เพิ่มบันทึกข้อความ
        </a>
      </div>

      {requests === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <table className="table-base">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>เลขที่</th>
                <th>วันที่บันทึก</th>
                <th>รายการ</th>
                <th>ผู้ขาย</th>
                <th className="text-right">จำนวนเงิน</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={r.doc_type === "ซื้อ" ? "badge-emerald" : "badge-navy"}>
                      {r.doc_type === "ซื้อ" ? "จัดซื้อ" : "จัดจ้าง"}
                    </span>
                  </td>
                  <td>{r.doc_no}</td>
                  <td>{formatThaiDate(r.record_date)}</td>
                  <td>{r.item_name ?? "-"}</td>
                  <td>{r.proc_vendors?.name ?? "-"}</td>
                  <td className="text-right font-semibold text-slate-900">{formatBaht(Number(r.amount))}</td>
                  <td className="text-right">
                    <a
                      href={(r.pdf_url && signedPdfUrls.get(r.pdf_url)) || `/purchase-requests/${r.id}/pdf`}
                      target="_blank"
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-empty">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
