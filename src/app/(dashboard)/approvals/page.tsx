"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { errorMessage, toastError } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { deleteApproval } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Approval = {
  id: string;
  doc_date: string;
  subject: string;
  requested_amount: number;
  requested_by_name: string | null;
  approval_pdf_url: string | null;
  plan_projects: { name: string } | null;
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedPdfUrls, setSignedPdfUrls] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_approvals")
      .select("id, doc_date, subject, requested_amount, requested_by_name, approval_pdf_url, plan_projects(name)")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    const rows = (data as unknown as Approval[]) ?? [];
    setApprovals(rows);

    const paths = rows.map((a) => a.approval_pdf_url).filter((p): p is string => !!p);
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("procurement-documents").createSignedUrls(paths, 3600);
      const map = new Map<string, string>();
      signed?.forEach((s) => {
        if (s.signedUrl && !s.error) map.set(s.path ?? "", s.signedUrl);
      });
      setSignedPdfUrls(map);
    } else {
      setSignedPdfUrls(new Map());
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleDelete(id: string) {
    try {
      await deleteApproval(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ประวัติการบันทึกขออนุมัติ</h1>
        </div>
        <a href="/approvals/new" className="btn-primary">
          + สร้างบันทึกขออนุมัติ
        </a>
      </div>

      {approvals === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <table className="table-base">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>เรื่อง</th>
                <th>โครงการ</th>
                <th>ผู้ขออนุมัติ</th>
                <th className="text-right">ขออนุมัติครั้งนี้</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>{formatThaiDate(a.doc_date)}</td>
                  <td>{a.subject}</td>
                  <td>{a.plan_projects?.name ?? "-"}</td>
                  <td className="font-medium text-slate-900">{a.requested_by_name ?? "-"}</td>
                  <td className="text-right font-semibold text-red-600">{formatBaht(Number(a.requested_amount))}</td>
                  <td className="text-right">
                    <a
                      href={(a.approval_pdf_url && signedPdfUrls.get(a.approval_pdf_url)) || `/approvals/${a.id}/pdf`}
                      target="_blank"
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {approvals.length === 0 && (
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
