"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
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
  summary_items: { label: string; amount: number | null; note: string | null }[] | null;
  plan_projects: { name: string } | null;
};

/** สถานะรวมของบันทึก — รองผู้อำนวยการเสนอความเห็นแล้ว (ไม่ว่าเห็นควรหรือไม่) จะเลื่อนสถานะเป็น
 * "รออนุมัติ" เสมอ (ส่งต่อให้ผู้อำนวยการตัดสินใจ ความเห็นของรองผู้อำนวยการเป็นข้อมูลประกอบเท่านั้น) */
function mergedStatus(a: Approval): "รอเสนอ" | "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ" {
  if (a.status === "อนุมัติ") return "อนุมัติ";
  if (a.status === "ไม่อนุมัติ") return "ไม่อนุมัติ";
  if (a.deputy_decision !== null) return "รออนุมัติ";
  return "รอเสนอ";
}

function mergedStatusBadgeClass(label: string) {
  if (label === "อนุมัติ") return "badge-emerald";
  if (label === "ไม่อนุมัติ") return "badge-red";
  if (label === "รออนุมัติ") return "badge-amber";
  return "badge-slate";
}

/** แก้ไข/ลบได้จนกว่ารองผู้อำนวยการจะเสนอความเห็น (ไม่ว่าเห็นควรหรือไม่) หรือผู้อำนวยการอนุมัติแล้ว
 * — ถ้าผู้อำนวยการ "ไม่อนุมัติ" ยังแก้ไขได้ (แก้แล้วบันทึกจะย้อนสถานะเป็น "รอเสนอ" ใหม่) */
function isEditableState(a: Approval) {
  if (a.status === "อนุมัติ") return false;
  if (a.status === "ไม่อนุมัติ") return true;
  return a.deputy_decision === null;
}

type DecisionMode = "deputy" | "director" | "view";

/** ป้ายสถานะ + popup รายละเอียด/พิจารณาอนุมัติ — เนื้อหาและปุ่มในนั้นเปลี่ยนตามบทบาทผู้ใช้กับ
 * สถานะปัจจุบันของรายการ (mode คำนวณจากผู้เรียกใช้) */
function ApprovalStatusCell({
  approval,
  mode,
  isAdmin,
  canApproveDeputy,
  canApproveDirector,
  onSubmitDeputy,
  onSubmitDirector,
  onResetDeputy,
  onResetStatus,
}: {
  approval: Approval;
  mode: DecisionMode;
  isAdmin: boolean;
  canApproveDeputy: boolean;
  canApproveDirector: boolean;
  onSubmitDeputy: (id: string, decision: "ควร" | "ไม่ควร", note?: string) => Promise<void>;
  onSubmitDirector: (id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) => Promise<void>;
  onResetDeputy: (id: string) => void;
  onResetStatus: (id: string) => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [choice, setChoice] = useState<"ควร" | "ไม่ควร" | "อนุมัติ" | "ไม่อนุมัติ" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const status = mergedStatus(approval);
  const needsNote = choice === "ไม่ควร" || choice === "ไม่อนุมัติ";

  async function handleSave() {
    if (!choice) return;
    const trimmed = note.trim();
    if (needsNote && !trimmed) return;
    setSubmitting(true);
    try {
      if (mode === "deputy") await onSubmitDeputy(approval.id, choice as "ควร" | "ไม่ควร", needsNote ? trimmed : undefined);
      else if (mode === "director")
        await onSubmitDirector(approval.id, choice as "อนุมัติ" | "ไม่อนุมัติ", needsNote ? trimmed : undefined);
      setChoice(null);
      setNote("");
      modalRef.current?.close();
    } catch {
      // toast ผิดพลาดขึ้นแล้วจากฝั่งเรียก — เปิด popup ค้างไว้ให้แก้ไข/ลองใหม่ได้
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      ref={modalRef}
      trigger={status}
      triggerClassName={`${mergedStatusBadgeClass(status)} !text-sm cursor-pointer`}
      title={mode === "deputy" ? "พิจารณาเสนอผู้อำนวยการ" : mode === "director" ? "พิจารณาอนุมัติ" : "รายละเอียดสถานะ"}
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-400">เลขที่</dt>
            <dd>{approval.doc_number ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">วันที่</dt>
            <dd>{formatThaiDate(approval.doc_date)}</dd>
          </div>
          <div>
            <dt className="text-slate-400">โครงการ</dt>
            <dd>{approval.plan_projects?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">กิจกรรม</dt>
            <dd>{approval.activity_name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">ผู้รับผิดชอบ</dt>
            <dd>{approval.requested_by_name ?? "-"}</dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2">ที่</th>
                <th className="px-2 py-2 text-left">รายการ</th>
                <th className="w-28 px-2 py-2 text-right">จำนวนเงิน</th>
                <th className="px-2 py-2 text-left">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(approval.summary_items ?? []).map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1 text-slate-700">{row.label}</td>
                  <td className="px-2 py-1 text-right">{row.amount != null ? formatBaht(row.amount) : ""}</td>
                  <td className="px-2 py-1 text-slate-500">{row.note ?? ""}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="px-2 py-2 text-right">
                  รวมทั้งสิ้น
                </td>
                <td className="px-2 py-2 text-right text-red-600">{formatBaht(Number(approval.requested_amount))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {approval.deputy_decision !== null && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-navy-900">
              ความเห็นรองผู้อำนวยการ: {approval.deputy_decision === "ควร" ? "เห็นควรอนุมัติ" : "ไม่เห็นควรอนุมัติ"}
            </p>
            <p className="text-slate-500">
              โดย {approval.deputy_decided_by_name ?? "-"} เมื่อ{" "}
              {approval.deputy_decided_at ? formatThaiDate(approval.deputy_decided_at) : "-"}
            </p>
            {approval.deputy_note && <p className="mt-1 whitespace-pre-line">ความคิดเห็น: {approval.deputy_note}</p>}
          </div>
        )}

        {(approval.status === "อนุมัติ" || approval.status === "ไม่อนุมัติ") && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-navy-900">ผู้อำนวยการ: {approval.status}</p>
            <p className="text-slate-500">
              โดย {approval.approved_by_name ?? "-"} เมื่อ {approval.approved_at ? formatThaiDate(approval.approved_at) : "-"}
            </p>
            {approval.approve_note && <p className="mt-1 whitespace-pre-line">ความคิดเห็น: {approval.approve_note}</p>}
          </div>
        )}

        {mode === "view" && approval.deputy_decision === null && approval.status === "รออนุมัติ" && (
          <p className="text-sm text-slate-400">ยังไม่มีความเห็น</p>
        )}

        {(mode === "deputy" || mode === "director") && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex gap-2">
              {mode === "deputy" ? (
                <>
                  <button
                    type="button"
                    onClick={() => setChoice("ควร")}
                    className={choice === "ควร" ? "btn-primary" : "btn-secondary"}
                  >
                    เห็นควรอนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoice("ไม่ควร")}
                    className={choice === "ไม่ควร" ? "btn-primary" : "btn-secondary"}
                  >
                    ไม่เห็นควรอนุมัติ
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setChoice("อนุมัติ")}
                    className={choice === "อนุมัติ" ? "btn-primary" : "btn-secondary"}
                  >
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => setChoice("ไม่อนุมัติ")}
                    className={choice === "ไม่อนุมัติ" ? "btn-primary" : "btn-secondary"}
                  >
                    ไม่อนุมัติ
                  </button>
                </>
              )}
            </div>
            {needsNote && (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                placeholder="กรอกความคิดเห็น (บังคับ)"
                rows={3}
                className="input w-full"
              />
            )}
            {choice && (
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting || (needsNote && !note.trim())}
                className="btn-primary w-full"
              >
                {submitting ? "กำลังบันทึก..." : mode === "deputy" ? "บันทึก (เสนอผู้อำนวยการ)" : "บันทึก"}
              </button>
            )}
          </div>
        )}

        {((isAdmin || canApproveDeputy) && approval.deputy_decision !== null) ||
        ((isAdmin || canApproveDirector) && approval.status !== "รออนุมัติ") ? (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            {(isAdmin || canApproveDeputy) && approval.deputy_decision !== null && (
              <button type="button" onClick={() => onResetDeputy(approval.id)} className="btn-danger btn-sm">
                ↺ ย้อนความเห็นรองผู้อำนวยการ
              </button>
            )}
            {(isAdmin || canApproveDirector) && approval.status !== "รออนุมัติ" && (
              <button type="button" onClick={() => onResetStatus(approval.id)} className="btn-danger btn-sm">
                ↺ ย้อนสถานะผู้อำนวยการ
              </button>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

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
        "id, created_by, doc_number, doc_date, activity_name, requested_amount, requested_by_name, approval_pdf_url, status, deputy_decision, deputy_decided_by_name, deputy_decided_at, deputy_note, approved_by_name, approved_at, approve_note, summary_items, plan_projects(name)",
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

  async function submitDirectorDecision(id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) {
    try {
      await updateApprovalStatus(id, decision, note);
      await toastSuccess(`บันทึกสถานะ "${decision}" แล้ว`);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
      throw err;
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

  async function submitDeputyDecision(id: string, decision: "ควร" | "ไม่ควร", note?: string) {
    try {
      await updateDeputyDecision(id, decision, note);
      await toastSuccess("บันทึกความเห็นของรองผู้อำนวยการแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
      throw err;
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
                let mode: DecisionMode = "view";
                if (canApproveDeputy && status === "รอเสนอ") mode = "deputy";
                else if (canApproveDirector && status === "รออนุมัติ") mode = "director";
                // แก้ไข/ลบได้เฉพาะเจ้าของบันทึกเองหรือแอดมิน (ครูคนอื่นเห็นรายการได้แต่แก้ไข/ลบไม่ได้)
                const isOwnerOrAdmin = isAdmin || (!!user && a.created_by === user.userId);
                const editableState = isEditableState(a);
                return (
                  <tr key={a.id}>
                    <td className="text-slate-400">{index + 1}</td>
                    <td>{a.doc_number ?? "-"}</td>
                    <td>{formatThaiDate(a.doc_date)}</td>
                    <td>
                      <div className="max-w-[220px] whitespace-normal break-words">{a.plan_projects?.name ?? "-"}</div>
                    </td>
                    <td>
                      <div className="max-w-[220px] whitespace-normal break-words">{a.activity_name ?? "-"}</div>
                    </td>
                    <td className="font-medium text-slate-900">{a.requested_by_name ?? "-"}</td>
                    <td className="text-right font-semibold text-red-600">{formatBaht(Number(a.requested_amount))}</td>
                    <td>
                      <ApprovalStatusCell
                        approval={a}
                        mode={mode}
                        isAdmin={isAdmin}
                        canApproveDeputy={canApproveDeputy}
                        canApproveDirector={canApproveDirector}
                        onSubmitDeputy={submitDeputyDecision}
                        onSubmitDirector={submitDirectorDecision}
                        onResetDeputy={handleResetDeputyDecision}
                        onResetStatus={handleResetStatus}
                      />
                    </td>
                    <td className="text-right">
                      <a
                        href={(a.approval_pdf_url && signedPdfUrls.get(a.approval_pdf_url)) || `/approvals/${a.id}/pdf`}
                        target="_blank"
                        className="btn-secondary btn-sm"
                      >
                        PDF
                      </a>
                    </td>
                    <td className="text-right">
                      {isOwnerOrAdmin &&
                        (editableState ? (
                          <a href={`/approvals/${a.id}/edit`} className="btn-secondary btn-sm">
                            แก้ไข
                          </a>
                        ) : (
                          <button
                            type="button"
                            title="แก้ไขไม่ได้ (มีผู้เห็นชอบแล้ว)"
                            onClick={() => toastError("แก้ไขไม่ได้ (มีผู้เห็นชอบแล้ว)")}
                            className="btn-secondary btn-sm cursor-not-allowed opacity-50"
                          >
                            แก้ไข
                          </button>
                        ))}
                    </td>
                    <td className="text-right">
                      {isOwnerOrAdmin && editableState && (
                        <button type="button" onClick={() => handleDelete(a.id)} className="btn-danger btn-sm">
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
