"use client";

// Client Component — ดึงประวัติบันทึกขออนุมัติผ่าน browser Supabase client (ต่อจาก /projects
// ฯลฯ — ดู /root/.claude/plans) หน้า /approvals/new (ฟอร์มสร้างใหม่) และ /approvals/[id]/pdf
// (พิมพ์ PDF) ยังคงเป็น Server Component เดิม ไม่แตะ — ใช้งานไม่บ่อยเท่าหน้ารายการนี้

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { CheckIcon, ChevronRightIcon, ClipboardCheckIcon, SearchIcon } from "@/components/icons";
import { Modal, type ModalHandle } from "@/components/modal";
import { ApprovalTimeline, PendingActionCallout, type FlowStep } from "@/components/approval-flow";
import {
  deleteApproval,
  resetApprovalStatus,
  resetDeputyDecision,
  updateApprovalStatus,
  updateDeputyDecision,
  updatePlanningAck,
  resetPlanningAck,
} from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export type Approval = {
  id: string;
  created_by: string | null;
  doc_number: string | null;
  doc_date: string;
  activity_name: string | null;
  requested_amount: number;
  requested_by_name: string | null;
  status: string;
  planning_ack_by_name?: string | null;
  planning_ack_at?: string | null;
  planning_note?: string | null;
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
export function mergedStatus(a: Approval): "รอเสนอ" | "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ" {
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

export type DecisionMode = "planning" | "deputy" | "director" | "view";

/** ฝ่ายแผนรับทราบแล้วหรือยัง (ขั้นแรกก่อนเสนอรองผู้อำนวยการ) */
export const planningDone = (a: Approval) => !!a.planning_ack_at;

/** โหมดพิจารณาของผู้ใช้คนนี้ต่อรายการ — ลำดับ ฝ่ายแผน → รองผู้อำนวยการ → ผู้อำนวยการ */
export function decisionModeOf(a: Approval, can: { planning: boolean; deputy: boolean; director: boolean }): DecisionMode {
  const status = mergedStatus(a);
  if (status === "รอเสนอ" && !planningDone(a)) return can.planning ? "planning" : "view";
  if (status === "รอเสนอ") return can.deputy ? "deputy" : "view";
  if (status === "รออนุมัติ") return can.director ? "director" : "view";
  return "view";
}

/** ป้ายสถานะ + popup รายละเอียด/พิจารณาอนุมัติ — เนื้อหาและปุ่มในนั้นเปลี่ยนตามบทบาทผู้ใช้กับ
 * สถานะปัจจุบันของรายการ (mode คำนวณจากผู้เรียกใช้) — export ไว้ให้หน้า "ผู้บริหาร" เรียกใช้ตรงๆ
 * (ฝัง popup นี้ในหน้าตัวเองแทนการลิงก์ไป /approvals?open=<id> เพื่อไม่ต้องเปลี่ยนหน้าไปมา) */
export function ApprovalStatusCell({
  approval,
  mode,
  isAdmin,
  canApproveDeputy,
  canApproveDirector,
  canAckPlanning = false,
  onSubmitPlanning,
  onResetPlanning,
  onSubmitDeputy,
  onSubmitDirector,
  onResetDeputy,
  onResetStatus,
  defaultOpen,
  trigger,
  triggerClassName,
}: {
  approval: Approval;
  mode: DecisionMode;
  isAdmin: boolean;
  canApproveDeputy: boolean;
  canApproveDirector: boolean;
  canAckPlanning?: boolean;
  onSubmitPlanning?: (id: string, note?: string) => Promise<void>;
  onResetPlanning?: (id: string) => void;
  onSubmitDeputy: (id: string, decision: "ควร" | "ไม่ควร", note?: string) => Promise<void>;
  onSubmitDirector: (id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) => Promise<void>;
  onResetDeputy: (id: string) => void;
  onResetStatus: (id: string) => void;
  /** เปิดป็อปอัปนี้อัตโนมัติ — ใช้กับลิงก์ลัดจากหน้า "ผู้บริหาร" (/approvals?open=<id>) */
  defaultOpen?: boolean;
  /** ปุ่ม/องค์ประกอบที่กดเพื่อเปิดป็อปอัป — ค่าเริ่มต้นเป็นป้ายสถานะ หน้า "ผู้บริหาร" ใช้ทั้งแถว
   * รายการเป็น trigger แทน เพื่อฝัง popup นี้ไว้ในหน้าตัวเองโดยไม่ต้องเปลี่ยนหน้าไปมา */
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [choice, setChoice] = useState<"ควร" | "ไม่ควร" | "อนุมัติ" | "ไม่อนุมัติ" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const status = mergedStatus(approval);
  const needsNote = choice === "ไม่ควร" || choice === "ไม่อนุมัติ";
  const deputyDone = approval.deputy_decision !== null;
  const flowSteps: FlowStep[] = [
    { label: "บันทึกขออนุมัติ", state: "done", by: approval.requested_by_name },
    {
      label: "ฝ่ายแผนรับทราบ",
      state: planningDone(approval) || deputyDone ? "done" : "current",
      by: approval.planning_ack_by_name,
      at: approval.planning_ack_at,
    },
    {
      label: "รองผู้อำนวยการเสนอความเห็น",
      state: deputyDone ? "done" : planningDone(approval) ? "current" : "pending",
      by: approval.deputy_decided_by_name,
      at: approval.deputy_decided_at,
    },
    {
      label: "ผู้อำนวยการอนุมัติ",
      state:
        approval.status === "ไม่อนุมัติ"
          ? "rejected"
          : approval.status === "อนุมัติ"
            ? "done"
            : status === "รออนุมัติ"
              ? "current"
              : "pending",
      by: approval.approved_by_name,
      at: approval.approved_at,
    },
  ];

  async function handleSavePlanning() {
    if (!onSubmitPlanning) return;
    setSubmitting(true);
    try {
      await onSubmitPlanning(approval.id, note.trim() || undefined);
      setNote("");
      modalRef.current?.close();
    } catch {
      // toast ขึ้นแล้วจากฝั่งเรียก
    } finally {
      setSubmitting(false);
    }
  }

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

  // ป้ายสถานะที่ผู้ใช้คนนี้ต้อง "พิจารณา" จริงๆ (mode ไม่ใช่ view) ให้เพิ่มไอคอนลูกศรต่อท้าย บอกชัดว่า
  // กดเข้าไปได้ ไม่ใช่แค่ป้ายแสดงสถานะเฉยๆ — โหมด view (แค่ดูรายละเอียด) ใช้ป้ายเรียบเหมือนเดิม
  const actionable = mode !== "view";
  const defaultTrigger = actionable ? (
    <span className="inline-flex items-center gap-1">
      {status}
      <ChevronRightIcon className="h-3 w-3" />
    </span>
  ) : (
    status
  );

  return (
    <Modal
      ref={modalRef}
      trigger={trigger ?? defaultTrigger}
      triggerClassName={triggerClassName ?? `${mergedStatusBadgeClass(status)} !text-sm cursor-pointer`}
      title={mode === "planning" ? "ฝ่ายแผนรับทราบ" : mode === "deputy" ? "พิจารณาเสนอผู้อำนวยการ" : mode === "director" ? "พิจารณาอนุมัติ" : "รายละเอียดสถานะ"}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-4">
        <div>
          <div className="card-title">ขั้นตอนเสนอความเห็น / อนุมัติ</div>
          <ApprovalTimeline steps={flowSteps} />
          {approval.planning_note && (
            <p className="mt-2 text-sm text-slate-600">หมายเหตุ (ฝ่ายแผน): {approval.planning_note}</p>
          )}
          {approval.deputy_note && (
            <p className="mt-2 text-sm text-slate-600">ความเห็น (รองผู้อำนวยการ): {approval.deputy_note}</p>
          )}
          {approval.approve_note && (
            <p className="mt-1 text-sm text-slate-600">ความเห็น (ผู้อำนวยการ): {approval.approve_note}</p>
          )}
        </div>

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

        {mode === "planning" && (
          <PendingActionCallout subtitle="ตรวจสอบโครงการ/งบประมาณตามแผน แล้วกดรับทราบเพื่อเสนอรองผู้อำนวยการ">
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                rows={2}
                className="input w-full"
              />
              <button type="button" onClick={handleSavePlanning} disabled={submitting} className="btn-primary w-full">
                {submitting ? "กำลังบันทึก..." : "รับทราบ (เสนอรองผู้อำนวยการ)"}
              </button>
            </div>
          </PendingActionCallout>
        )}

        {(mode === "deputy" || mode === "director") && (
          <PendingActionCallout
            subtitle={
              mode === "deputy"
                ? "บันทึกขออนุมัตินี้รอให้ท่านเสนอความเห็นก่อนส่งต่อผู้อำนวยการ"
                : "บันทึกขออนุมัตินี้รอให้ท่านพิจารณาอนุมัติ"
            }
          >
            <div className="space-y-3">
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
          </PendingActionCallout>
        )}

        {(isAdmin || canAckPlanning) && onResetPlanning && planningDone(approval) && !deputyDone && (
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => onResetPlanning(approval.id)} className="btn-danger btn-sm">
              ↺ ย้อนการรับทราบของฝ่ายแผน
            </button>
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

type ApprovalDetail = {
  subject: string;
  addressed_to: string;
  department: string | null;
  plan_date_text: string | null;
  requested_by_position: string | null;
  budget: number | null;
  paid: number | null;
  remaining: number | null;
};
type ApprovalItem = { name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null; note: string | null };

// ปุ่ม "รายละเอียด" — โหลดข้อมูลเต็มของบันทึกเมื่อเปิด
function ApprovalDetailModal({ approval: a }: { approval: Approval }) {
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [items, setItems] = useState<ApprovalItem[] | null>(null);

  async function load() {
    if (detail) return;
    const supabase = createClient();
    const [{ data: d }, { data: it }] = await Promise.all([
      supabase
        .from("proc_approvals")
        .select("subject, addressed_to, department, plan_date_text, requested_by_position, budget, paid, remaining")
        .eq("id", a.id)
        .maybeSingle(),
      supabase.from("proc_approval_items").select("name, qty, unit, unit_price, total, note").eq("approval_id", a.id).order("seq"),
    ]);
    setDetail(d as ApprovalDetail | null);
    setItems((it as ApprovalItem[] | null) ?? []);
  }

  const money = (n: number | null | undefined) => (n != null ? `${formatBaht(Number(n))} บาท` : "-");
  const rows: [string, ReactNode][] = [
    ["เลขที่", a.doc_number ?? "-"],
    ["วันที่", formatThaiDate(a.doc_date)],
    ["เรื่อง", detail?.subject ?? "-"],
    ["เรียน", detail?.addressed_to ?? "-"],
    ["ฝ่าย/กลุ่ม/สาระฯ/งาน", detail?.department ?? "-"],
    ["โครงการ", a.plan_projects?.name ?? "-"],
    ["กิจกรรม", a.activity_name ?? "-"],
    ["จะดำเนินการวันที่", detail?.plan_date_text ?? "-"],
    ["ผู้ขออนุมัติ", [a.requested_by_name, detail?.requested_by_position].filter(Boolean).join(" · ") || "-"],
    ["งบประมาณโครงการ", money(detail?.budget)],
    ["ใช้ไปแล้ว", money(detail?.paid)],
    ["ขออนุมัติครั้งนี้", money(a.requested_amount)],
    ["คงเหลือ", money(detail?.remaining)],
    ["สถานะ", mergedStatus(a)],
    ["ความเห็นรองผู้อำนวยการ", a.deputy_decision ? `${a.deputy_decision}${a.deputy_note ? ` — ${a.deputy_note}` : ""}` : "-"],
    ["ความเห็นผู้อำนวยการ", a.approved_by_name ? `${a.status}${a.approve_note ? ` — ${a.approve_note}` : ""}` : "-"],
  ];
  const summary = (a.summary_items ?? []).filter((r) => r.amount != null || r.note);

  return (
    <Modal
      title={`บันทึกขออนุมัติ ${a.doc_number ?? ""}`}
      wide
      lazy
      onOpenChange={(open) => open && load()}
      trigger={
        <span className="btn-secondary btn-sm">
          <SearchIcon className="h-3.5 w-3.5" />
          รายละเอียด
        </span>
      }
    >
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line text-slate-900 sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-navy-800">รายการเงินที่ขออนุมัติ</h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2 text-left">รายการ</th>
                  <th className="px-2 py-2 text-right">จำนวนเงิน</th>
                  <th className="px-2 py-2 text-left">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">{r.label}</td>
                    <td className="px-2 py-1 text-right">{r.amount != null ? formatBaht(Number(r.amount)) : "-"}</td>
                    <td className="px-2 py-1 text-slate-500">{r.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {items && items.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-navy-800">รายการวัสดุ</h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">ที่</th>
                  <th className="px-2 py-2 text-left">รายการ</th>
                  <th className="px-2 py-2 text-right">จำนวน</th>
                  <th className="px-2 py-2 text-right">ราคา/หน่วย</th>
                  <th className="px-2 py-2 text-right">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1">
                      {it.name}
                      {it.note ? <span className="text-slate-500"> ({it.note})</span> : null}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {it.qty ?? "-"} {it.unit ?? ""}
                    </td>
                    <td className="px-2 py-1 text-right">{it.unit_price != null ? formatBaht(Number(it.unit_price)) : "-"}</td>
                    <td className="px-2 py-1 text-right">{it.total != null ? formatBaht(Number(it.total)) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ApprovalsPage() {
  const { user, isAdmin, role, loading: authLoading } = useAuth();
  // ลิงก์ลัดจากหน้า "ผู้บริหาร" (/approvals?open=<id>) — เปิดป็อปอัปสถานะของรายการนี้อัตโนมัติ
  const autoOpenId = useSearchParams().get("open");
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canApproveDirector, setCanApproveDirector] = useState(false);
  const [canApproveDeputy, setCanApproveDeputy] = useState(false);
  const [canAckPlanning, setCanAckPlanning] = useState(false);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_approvals")
      .select(
        "id, created_by, doc_number, doc_date, activity_name, requested_amount, requested_by_name, status, planning_ack_by_name, planning_ack_at, planning_note, deputy_decision, deputy_decided_by_name, deputy_decided_at, deputy_note, approved_by_name, approved_at, approve_note, summary_items, plan_projects(name)",
      )
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    const rows = (data as unknown as Approval[]) ?? [];
    setApprovals(rows);

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
    // แอดมินที่สลับบทบาท (เช่นเป็นรองผู้อำนวยการ) ใช้สิทธิ์ตาม role ที่สลับมา
    setCanApproveDirector(isAdmin || role === "director" || myGroupNames.includes("ผู้อำนวยการ"));
    setCanApproveDeputy(isAdmin || role === "deputy_director" || myGroupNames.includes("รองผู้อำนวยการ"));
    setCanAckPlanning(isAdmin || role === "planning_officer" || myGroupNames.includes("ฝ่ายแผน"));
  }, [authLoading, isAdmin, role, user]);

  async function submitPlanningAck(id: string, note?: string) {
    try {
      await updatePlanningAck(id, note);
      await toastSuccess("ฝ่ายแผนรับทราบแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
      throw err;
    }
  }

  async function handleResetPlanning(id: string) {
    const ok = await confirmWarning({ title: "ย้อนการรับทราบของฝ่ายแผน?" });
    if (!ok) return;
    try {
      await resetPlanningAck(id);
      await toastSuccess("ย้อนแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

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

      {/* การ์ดสรุปของทั้งโรงเรียน — ทุกคนเห็น (ครูด้วย) */}
      {approvals !== null && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card" style={{ "--accent": "#b45309" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#b45309" }}>
                <ClipboardCheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">รอเสนอ</div>
                <div className="stat-value">
                  {approvals.filter((a) => mergedStatus(a) === "รอเสนอ").length.toLocaleString("th-TH")}{" "}
                  <span className="stat-suffix">รายการ</span>
                </div>
              </div>
            </div>
          </div>
          <div className="stat-card" style={{ "--accent": "#1b4177" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#1b4177" }}>
                <ClipboardCheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">รออนุมัติ</div>
                <div className="stat-value">
                  {approvals.filter((a) => mergedStatus(a) === "รออนุมัติ").length.toLocaleString("th-TH")}{" "}
                  <span className="stat-suffix">รายการ</span>
                </div>
              </div>
            </div>
          </div>
          <div className="stat-card" style={{ "--accent": "#059669" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#059669" }}>
                <CheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">อนุมัติแล้ว</div>
                <div className="stat-value">
                  {approvals.filter((a) => mergedStatus(a) === "อนุมัติ").length.toLocaleString("th-TH")}{" "}
                  <span className="stat-suffix">รายการ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {approvals === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

          {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว (แพทเทิร์นเดียวกับ asset-register/register-tab.tsx) */}
          <div className="divide-y divide-slate-100 md:hidden">
            {approvals.map((a, index) => {
              const mode: DecisionMode = decisionModeOf(a, { planning: canAckPlanning, deputy: canApproveDeputy, director: canApproveDirector });
              const isOwnerOrAdmin = isAdmin || (!!user && a.created_by === user.userId);
              const editableState = isEditableState(a);
              return (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">#{index + 1}</span>
                    <span className="font-medium text-slate-900">{a.doc_number ?? "-"}</span>
                    <span className="text-xs text-slate-500">{formatThaiDate(a.doc_date)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.plan_projects?.name ?? "-"} · {a.activity_name ?? "-"}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">ผู้รับผิดชอบ: {a.requested_by_name ?? "-"}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-red-600">
                    {formatBaht(Number(a.requested_amount))} บาท
                  </p>
                  <div className="mt-2">
                    <ApprovalStatusCell
                      approval={a}
                      mode={mode}
                      isAdmin={isAdmin}
                      canApproveDeputy={canApproveDeputy}
                      canApproveDirector={canApproveDirector}
canAckPlanning={canAckPlanning}
onSubmitPlanning={submitPlanningAck}
onResetPlanning={handleResetPlanning}
                      onSubmitDeputy={submitDeputyDecision}
                      onSubmitDirector={submitDirectorDecision}
                      onResetDeputy={handleResetDeputyDecision}
                      onResetStatus={handleResetStatus}
                      defaultOpen={a.id === autoOpenId}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ApprovalDetailModal approval={a} />
                    <a
                      href={`/approvals/${a.id}/pdf`}
                      target="_blank"
                      className="btn-secondary btn-sm"
                    >
                      PDF
                    </a>
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
                    {isOwnerOrAdmin && editableState && (
                      <button type="button" onClick={() => handleDelete(a.id)} className="btn-danger btn-sm">
                        ลบ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {approvals.length === 0 && <p className="table-empty">ยังไม่มีข้อมูล</p>}
          </div>

          {/* จอกว้าง md ขึ้นไป: ตาราง */}
          <table className="hidden table-base min-w-0 md:table [&_td]:px-3 [&_th]:px-3">
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
              </tr>
            </thead>
            <tbody>
              {approvals.map((a, index) => {
                const mode: DecisionMode = decisionModeOf(a, { planning: canAckPlanning, deputy: canApproveDeputy, director: canApproveDirector });
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
canAckPlanning={canAckPlanning}
onSubmitPlanning={submitPlanningAck}
onResetPlanning={handleResetPlanning}
                        onSubmitDeputy={submitDeputyDecision}
                        onSubmitDirector={submitDirectorDecision}
                        onResetDeputy={handleResetDeputyDecision}
                        onResetStatus={handleResetStatus}
                        defaultOpen={a.id === autoOpenId}
                      />
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ApprovalDetailModal approval={a} />
                        <a
                          href={`/approvals/${a.id}/pdf`}
                          target="_blank"
                          className="btn-secondary btn-sm"
                        >
                          PDF
                        </a>
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
                        {isOwnerOrAdmin && editableState && (
                          <button type="button" onClick={() => handleDelete(a.id)} className="btn-danger btn-sm">
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
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
