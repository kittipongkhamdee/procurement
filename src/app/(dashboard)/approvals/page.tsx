"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, errorMessage, promptReason, toastError, toastSuccess } from "@/lib/swal";
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

type Approval = {
  id: string;
  created_by: string | null;
  doc_number: string | null;
  doc_date: string;
  activity_name: string | null;
  requested_amount: number;
  requested_by_name: string | null;
  approval_pdf_url: string | null;
  status: string;
  deputy_decision: string | null;
  deputy_decided_by_name: string | null;
  deputy_decided_at: string | null;
  deputy_note: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approve_note: string | null;
  plan_projects: { name: string } | null;
};

/** สถานะรวมของบันทึก (ควบรวมความเห็นรองผู้อำนวยการ + สถานะผู้อำนวยการ เป็นค่าเดียว) */
function mergedStatus(a: Approval): "รอความเห็น" | "รออนุมัติ" | "อนุมัติ" | "ไม่ควรอนุมัติ" | "ไม่อนุมัติ" {
  if (a.status === "อนุมัติ") return "อนุมัติ";
  if (a.status === "ไม่อนุมัติ") return "ไม่อนุมัติ";
  if (a.deputy_decision === "ไม่ควร") return "ไม่ควรอนุมัติ";
  if (a.deputy_decision === "ควร") return "รออนุมัติ";
  return "รอความเห็น";
}

function mergedStatusBadgeClass(label: string) {
  if (label === "อนุมัติ") return "badge-emerald";
  if (label === "ไม่อนุมัติ" || label === "ไม่ควรอนุมัติ") return "badge-red";
  if (label === "รออนุมัติ") return "badge-amber";
  return "badge-slate";
}

/** แก้ไข/ลบได้เมื่อยังไม่ผ่านการเห็นชอบของรองผู้อำนวยการ (deputy_decision !== "ควร") และยังไม่อนุมัติ
 * — ถ้ารองผู้อำนวยการเห็นชอบแล้ว (รอผู้อำนวยการ) หรือผู้อำนวยการอนุมัติแล้ว แก้ไขไม่ได้ ส่วนกรณี
 * "ไม่ควรอนุมัติ"/"ไม่อนุมัติ" ยังแก้ไขได้ (แก้แล้วบันทึกจะย้อนสถานะเป็น "รอความเห็น" ใหม่) */
function isEditableState(a: Approval) {
  if (a.status === "อนุมัติ") return false;
  if (a.status === "ไม่อนุมัติ") return true;
  return a.deputy_decision !== "ควร";
}

/** ข้อความรายละเอียดความเห็น/สถานะที่รองผู้อำนวยการ+ผู้อำนวยการบันทึกไว้ ใช้แสดงตอนชี้เมาส์/คลิก */
function statusDetailText(a: Approval) {
  const parts: string[] = [];
  if (a.deputy_decision) {
    const decisionLabel = a.deputy_decision === "ควร" ? "ควรอนุมัติ" : "ไม่ควรอนุมัติ";
    parts.push(
      `รองผู้อำนวยการ: ${decisionLabel} โดย ${a.deputy_decided_by_name ?? "-"} เมื่อ ${a.deputy_decided_at ? formatThaiDate(a.deputy_decided_at) : "-"}` +
        (a.deputy_note ? `\nเหตุผล: ${a.deputy_note}` : ""),
    );
  }
  if (a.status === "อนุมัติ" || a.status === "ไม่อนุมัติ") {
    parts.push(
      `ผู้อำนวยการ: ${a.status} โดย ${a.approved_by_name ?? "-"} เมื่อ ${a.approved_at ? formatThaiDate(a.approved_at) : "-"}` +
        (a.approve_note ? `\nเหตุผล: ${a.approve_note}` : ""),
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : "ยังไม่มีความเห็น";
}

export default function ApprovalsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedPdfUrls, setSignedPdfUrls] = useState<Map<string, string>>(new Map());
  const [canApproveDirector, setCanApproveDirector] = useState(false);
  const [canApproveDeputy, setCanApproveDeputy] = useState(false);
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_approvals")
      .select(
        "id, created_by, doc_number, doc_date, activity_name, requested_amount, requested_by_name, approval_pdf_url, status, deputy_decision, deputy_decided_by_name, deputy_decided_at, deputy_note, approved_by_name, approved_at, approve_note, plan_projects(name)",
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
    let note: string | undefined;
    if (decision === "ไม่อนุมัติ") {
      const reason = await promptReason({ title: "เหตุผลที่ไม่อนุมัติ" });
      if (reason === null) return;
      note = reason;
    } else {
      const ok = await confirmWarning({ title: "อนุมัติรายการนี้?", confirmButtonText: "อนุมัติ" });
      if (!ok) return;
    }
    try {
      await updateApprovalStatus(id, decision, note);
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
      await toastSuccess("ย้อนสถานะแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleUpdateDeputyDecision(id: string, decision: "ควร" | "ไม่ควร") {
    let note: string | undefined;
    if (decision === "ไม่ควร") {
      const reason = await promptReason({ title: "เหตุผลที่ไม่ควรอนุมัติ" });
      if (reason === null) return;
      note = reason;
    } else {
      const ok = await confirmWarning({ title: "ความเห็น: ควรอนุญาตและอนุมัติ?", confirmButtonText: "ควรอนุมัติ" });
      if (!ok) return;
    }
    try {
      await updateDeputyDecision(id, decision, note);
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
      await toastSuccess("ย้อนความเห็นแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">การบันทึกขออนุมัติ</h1>
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
                <th>#</th>
                <th>เลขที่</th>
                <th>วันที่</th>
                <th>โครงการ</th>
                <th>กิจกรรม</th>
                <th>ผู้รับผิดชอบ</th>
                <th className="text-right">ขออนุมัติครั้งนี้</th>
                <th>สถานะ</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a, index) => {
                const status = mergedStatus(a);
                const detailText = statusDetailText(a);
                const expanded = expandedStatusId === a.id;
                // รองผู้อำนวยการต้องกด "ควรอนุมัติ" ก่อน ผู้อำนวยการจึงจะกดอนุมัติ/ไม่อนุมัติได้
                const directorCanAct = canApproveDirector && a.status === "รออนุมัติ" && a.deputy_decision === "ควร";
                // แก้ไข/ลบได้เฉพาะเจ้าของบันทึกเองหรือแอดมิน (ครูคนอื่นเห็นรายการได้แต่แก้ไข/ลบไม่ได้)
                const isOwnerOrAdmin = isAdmin || (!!user && a.created_by === user.userId);
                const editableState = isEditableState(a);
                return (
                  <tr key={a.id}>
                    <td className="text-slate-400">{index + 1}</td>
                    <td>{a.doc_number ?? "-"}</td>
                    <td>{formatThaiDate(a.doc_date)}</td>
                    <td>{a.plan_projects?.name ?? "-"}</td>
                    <td>{a.activity_name ?? "-"}</td>
                    <td className="font-medium text-slate-900">{a.requested_by_name ?? "-"}</td>
                    <td className="text-right font-semibold text-red-600">{formatBaht(Number(a.requested_amount))}</td>
                    <td>
                      <button
                        type="button"
                        title={detailText}
                        onClick={() => setExpandedStatusId(expanded ? null : a.id)}
                        className={`${mergedStatusBadgeClass(status)} !text-sm cursor-pointer`}
                      >
                        {status}
                      </button>
                      {expanded && (
                        <p className="mt-1 max-w-xs whitespace-pre-line text-xs text-slate-500">{detailText}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3">
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
                        {directorCanAct && (
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
                      </div>
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
                      {isOwnerOrAdmin &&
                        (editableState ? (
                          <a href={`/approvals/${a.id}/edit`} className="text-sm font-medium text-navy-700 hover:underline">
                            แก้ไข
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">แก้ไขไม่ได้ (มีผู้เห็นชอบแล้ว)</span>
                        ))}
                    </td>
                    <td className="text-right">
                      {isOwnerOrAdmin && editableState && (
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          ลบ
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {approvals.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty">
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
