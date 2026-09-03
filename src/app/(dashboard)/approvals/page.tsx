"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { deleteApproval, resetApprovalStatus, updateApprovalStatus } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function statusBadgeClass(status: string) {
  if (status === "อนุมัติ") return "badge-emerald";
  if (status === "ไม่อนุมัติ") return "badge-red";
  return "badge-amber";
}

type Approval = {
  id: string;
  doc_date: string;
  subject: string;
  requested_amount: number;
  requested_by_name: string | null;
  approval_pdf_url: string | null;
  status: string;
  plan_projects: { name: string } | null;
};

export default function ApprovalsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedPdfUrls, setSignedPdfUrls] = useState<Map<string, string>>(new Map());
  const [canApprove, setCanApprove] = useState(false);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_approvals")
      .select(
        "id, doc_date, subject, requested_amount, requested_by_name, approval_pdf_url, status, plan_projects(name)",
      )
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

    // สิทธิ์เปลี่ยนสถานะ "อนุมัติ"/"ไม่อนุมัติ": แอดมิน หรือผู้มีสถานะผู้ใช้งาน "ผู้อำนวยการ"
    // (แพทเทิร์นเดียวกับ canApprove ในหน้าเสนอโครงการ)
    let myCanApprove = isAdmin;
    if (!isAdmin && user) {
      const { data: myGroups } = await supabase
        .from("proc_user_group_members")
        .select("proc_user_groups(name)")
        .eq("user_id", user.userId);
      myCanApprove = (myGroups ?? []).some(
        (g) => (g.proc_user_groups as unknown as { name: string } | null)?.name === "ผู้อำนวยการ",
      );
    }
    setCanApprove(myCanApprove);
  }, [authLoading, isAdmin, user]);

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

  async function handleUpdateStatus(id: string, decision: "อนุมัติ" | "ไม่อนุมัติ") {
    const ok = await confirmWarning({
      title: decision === "อนุมัติ" ? "อนุมัติรายการนี้?" : "ไม่อนุมัติรายการนี้?",
      confirmButtonText: decision,
    });
    if (!ok) return;
    try {
      await updateApprovalStatus(id, decision);
      await toastSuccess(`บันทึกสถานะ "${decision}" แล้ว`);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleResetStatus(id: string) {
    const ok = await confirmWarning({ title: "ย้อนสถานะกลับเป็น \"รออนุมัติ\"?" });
    if (!ok) return;
    try {
      await resetApprovalStatus(id);
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
                <th>สถานะ</th>
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
                  <td>
                    <span className={`${statusBadgeClass(a.status)} !text-sm`}>{a.status}</span>
                  </td>
                  <td className="text-right">
                    <a
                      href={(a.approval_pdf_url && signedPdfUrls.get(a.approval_pdf_url)) || `/approvals/${a.id}/pdf`}
                      target="_blank"
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      PDF
                    </a>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      {canApprove && a.status === "รออนุมัติ" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(a.id, "อนุมัติ")}
                            className="text-sm font-medium text-emerald-600 hover:underline"
                          >
                            อนุมัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(a.id, "ไม่อนุมัติ")}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            ไม่อนุมัติ
                          </button>
                        </>
                      )}
                      {isAdmin && a.status !== "รออนุมัติ" && (
                        <button
                          type="button"
                          onClick={() => handleResetStatus(a.id)}
                          className="text-sm font-medium text-slate-500 hover:underline"
                        >
                          ย้อนสถานะ
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {approvals.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
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
