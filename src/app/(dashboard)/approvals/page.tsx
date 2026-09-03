"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import {
  deleteApproval,
  resetApprovalStatus,
  resetDeputyDecision,
  updateApprovalStatus,
  updateDeputyDecision,
} from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function statusBadgeClass(status: string) {
  if (status === "อนุมัติ") return "badge-emerald";
  if (status === "ไม่อนุมัติ") return "badge-red";
  return "badge-amber";
}

function deputyBadgeClass(decision: string | null) {
  if (decision === "ควร") return "badge-emerald";
  if (decision === "ไม่ควร") return "badge-red";
  return "badge-slate";
}

type Approval = {
  id: string;
  doc_date: string;
  subject: string;
  requested_amount: number;
  requested_by_name: string | null;
  approval_pdf_url: string | null;
  status: string;
  deputy_decision: string | null;
  plan_projects: { name: string } | null;
};

export default function ApprovalsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedPdfUrls, setSignedPdfUrls] = useState<Map<string, string>>(new Map());
  const [canApproveDirector, setCanApproveDirector] = useState(false);
  const [canApproveDeputy, setCanApproveDeputy] = useState(false);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_approvals")
      .select(
        "id, doc_date, subject, requested_amount, requested_by_name, approval_pdf_url, status, deputy_decision, plan_projects(name)",
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

    // สิทธิ์เปลี่ยนความเห็น/สถานะ: แอดมิน หรือผู้มีสถานะผู้ใช้งานตรงกับระดับนั้นๆ
    let myGroupNames: string[] = [];
    if (!isAdmin && user) {
      const { data: myGroups } = await supabase
        .from("proc_user_group_members")
        .select("proc_user_groups(name)")
        .eq("user_id", user.userId);
      myGroupNames = (myGroups ?? [])
        .map((g) => (g.proc_user_groups as unknown as { name: string } | null)?.name)
        .filter((n): n is string => !!n);
    }
    setCanApproveDirector(isAdmin || myGroupNames.includes("ผู้อำนวยการ"));
    setCanApproveDeputy(isAdmin || myGroupNames.includes("รองผู้อำนวยการ"));
  }, [authLoading, isAdmin, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleDelete(id: string) {
    const ok = await confirmDelete({ title: "ลบบันทึกขออนุมัตินี้?", text: "ไม่สามารถย้อนกลับได้" });
    if (!ok) return;
    try {
      await deleteApproval(id);
      await toastSuccess("ลบบันทึกแล้ว");
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

  async function handleUpdateDeputyDecision(id: string, decision: "ควร" | "ไม่ควร") {
    const ok = await confirmWarning({
      title: decision === "ควร" ? "ความเห็น: ควรอนุญาตและอนุมัติ?" : "ความเห็น: ไม่ควรอนุญาตและอนุมัติ?",
      confirmButtonText: decision,
    });
    if (!ok) return;
    try {
      await updateDeputyDecision(id, decision);
      await toastSuccess("บันทึกความเห็นของรองผู้อำนวยการแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleResetDeputyDecision(id: string) {
    const ok = await confirmWarning({ title: "ย้อนความเห็นของรองผู้อำนวยการกลับเป็นค่าว่าง?" });
    if (!ok) return;
    try {
      await resetDeputyDecision(id);
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
                <th>ผู้รับผิดชอบ</th>
                <th className="text-right">ขออนุมัติครั้งนี้</th>
                <th>ความเห็นรองผู้อำนวยการ</th>
                <th>สถานะผู้อำนวยการ</th>
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
                    <span className={`${deputyBadgeClass(a.deputy_decision)} !text-sm`}>
                      {a.deputy_decision ?? "รอความเห็น"}
                    </span>
                  </td>
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
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {canApproveDeputy && a.deputy_decision === null && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateDeputyDecision(a.id, "ควร")}
                            className="text-sm font-medium text-emerald-600 hover:underline"
                          >
                            ควรอนุมัติ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateDeputyDecision(a.id, "ไม่ควร")}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            ไม่ควรอนุมัติ
                          </button>
                        </>
                      )}
                      {isAdmin && a.deputy_decision !== null && (
                        <button
                          type="button"
                          onClick={() => handleResetDeputyDecision(a.id)}
                          className="text-sm font-medium text-slate-500 hover:underline"
                        >
                          ย้อนความเห็น
                        </button>
                      )}
                      {canApproveDirector && a.status === "รออนุมัติ" && (
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
                      {a.status === "รออนุมัติ" && (
                        <a
                          href={`/approvals/${a.id}/edit`}
                          className="text-sm font-medium text-navy-700 hover:underline"
                        >
                          แก้ไข
                        </a>
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
                  <td colSpan={9} className="table-empty">
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
