"use client";

import { useRef, useState } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import type {
  approveProposal as approveProposalAction,
  deleteProposal as deleteProposalAction,
  endorseProposal as endorseProposalAction,
  resetProposalStatus as resetProposalStatusAction,
} from "./actions";

type ActivityRow = {
  name: string;
  period: string;
  responsible: string[];
  compensation: number;
  service: number;
  material: number;
};
type EvaluationRow = { type: string; indicator: string; target: string; method: string; tool: string };

type Proposal = {
  id: string;
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  rationale: string | null;
  objectives: string | null;
  targetQuantity: string | null;
  targetQuality: string | null;
  activities: ActivityRow[];
  budgetAmount: number;
  riskFactors: string | null;
  riskMitigation: string | null;
  evaluationItems: EvaluationRow[];
  expectedResults: string | null;
  status: string;
  endorsedByName: string | null;
  endorsedAt: string | null;
  endorseNote: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approveNote: string | null;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function projectTypeLabel(type: string) {
  return type === "ใหม่" ? "โครงการใหม่" : type === "ต่อเนื่อง" ? "โครงการต่อเนื่อง" : type;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value}</div>
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "อนุมัติแล้ว") return "badge-emerald";
  if (status === "ไม่เห็นชอบ" || status === "ไม่อนุมัติ") return "badge-red";
  return "badge-amber";
}

export function ProposalDetailModal({
  proposal,
  isAdmin,
  canEndorse,
  canApprove,
  canDelete,
  endorseProposal,
  approveProposal,
  resetProposalStatus,
  deleteProposal,
}: {
  proposal: Proposal;
  isAdmin: boolean;
  canEndorse: boolean;
  canApprove: boolean;
  canDelete: boolean;
  endorseProposal: typeof endorseProposalAction;
  approveProposal: typeof approveProposalAction;
  resetProposalStatus: typeof resetProposalStatusAction;
  deleteProposal: typeof deleteProposalAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [endorseSigner, setEndorseSigner] = useState("");
  const [endorseNote, setEndorseNote] = useState("");
  const [approveSigner, setApproveSigner] = useState("");
  const [approveNote, setApproveNote] = useState("");

  async function handleEndorse(decision: "เห็นชอบ" | "ไม่เห็นชอบ") {
    try {
      await endorseProposal(proposal.id, decision, endorseSigner, endorseNote);
      await toastSuccess("บันทึกผลการเห็นชอบแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleApprove(decision: "อนุมัติแล้ว" | "ไม่อนุมัติ") {
    try {
      await approveProposal(proposal.id, decision, approveSigner, approveNote);
      await toastSuccess("บันทึกผลการอนุมัติแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleReset() {
    try {
      await resetProposalStatus(proposal.id);
      await toastSuccess("ย้อนสถานะเป็นรอเห็นชอบแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete() {
    const ok = await confirmDelete({ title: `ลบข้อเสนอโครงการ "${proposal.name}"?` });
    if (!ok) return;
    try {
      await deleteProposal(proposal.id);
      await toastSuccess("ลบข้อเสนอโครงการเรียบร้อยแล้ว");
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <Modal ref={modalRef} title={proposal.name} trigger="ดูรายละเอียด" triggerClassName="btn-secondary btn-sm">
      <div className="grid grid-cols-1 gap-4 text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={statusBadgeClass(proposal.status)}>{proposal.status}</span>
            <span className="text-slate-500">
              ผู้เสนอ: {proposal.proposerName ?? "-"} · {projectTypeLabel(proposal.projectType)} · {proposal.adminGroup}
            </span>
          </div>
          <div className="flex gap-2">
            <a
              href={`/project-proposals/${proposal.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm"
            >
              ส่งออก PDF
            </a>
            <a href={`/project-proposals/${proposal.id}/docx`} className="btn-secondary btn-sm">
              ส่งออก Word
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="สนองกลยุทธ์โรงเรียน" value={proposal.strategyAlignment} />
          <Field label="สอดคล้องกับมาตรฐานการศึกษา" value={proposal.standard} />
          <Field label="ผู้รับผิดชอบ" value={proposal.responsible.join(", ") || "-"} />
          <Field label="สถานที่ดำเนินการ" value={proposal.location} />
          <Field
            label="ระยะเวลาดำเนินการ"
            value={
              proposal.startDate || proposal.endDate
                ? `${proposal.startDate ? formatThaiDate(proposal.startDate) : "-"} ถึง ${proposal.endDate ? formatThaiDate(proposal.endDate) : "-"}`
                : null
            }
          />
          <Field
            label="งบประมาณ / แหล่งเงิน"
            value={`${formatBaht(proposal.budgetAmount)} บาท (${proposal.budgetSource})`}
          />
        </div>

        <Field label="1. หลักการและเหตุผล" value={proposal.rationale} />
        <Field label="2. วัตถุประสงค์" value={proposal.objectives} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="3.1 เป้าหมายเชิงปริมาณ (ผลผลิต)" value={proposal.targetQuantity} />
          <Field label="3.2 เป้าหมายเชิงคุณภาพ (ผลลัพธ์)" value={proposal.targetQuality} />
        </div>

        {proposal.activities.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              4. ขั้นตอนการดำเนินงาน และงบประมาณ
            </div>
            <div className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {proposal.activities.map((a, i) => {
                const rowTotal = (Number(a.compensation) || 0) + (Number(a.service) || 0) + (Number(a.material) || 0);
                return (
                  <div key={i} className="grid grid-cols-1 gap-1.5 p-3 text-sm">
                    <div className="text-left font-medium text-slate-700">
                      {i + 1}. {a.name}
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-left text-slate-500 sm:grid-cols-2">
                      <div>ระยะเวลา: {a.period || "-"}</div>
                      <div>ผู้รับผิดชอบ: {a.responsible.join(", ") || "-"}</div>
                    </div>
                    <div className="text-left font-medium text-navy-800 tabular-nums">
                      งบประมาณ: {formatBaht(rowTotal)} บาท
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(proposal.riskFactors || proposal.riskMitigation) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="7. ปัจจัยความเสี่ยง" value={proposal.riskFactors} />
            <Field label="แนวทางการบริหารความเสี่ยง" value={proposal.riskMitigation} />
          </div>
        )}

        {proposal.evaluationItems.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              8. ตัวชี้วัดและเป้าหมายความสำเร็จ
            </div>
            <div className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {proposal.evaluationItems.map((e, i) => (
                <div key={i} className="grid grid-cols-1 gap-1.5 p-3 text-left text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-slate w-fit">{e.type}</span>
                    <span className="font-medium text-slate-700">{e.indicator}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-slate-500 sm:grid-cols-3">
                    <div>ค่าเป้าหมาย: {e.target || "-"}</div>
                    <div>วิธีวัดและประเมินผล: {e.method || "-"}</div>
                    <div>เครื่องมือที่ใช้: {e.tool || "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="9. ผลที่คาดว่าจะได้รับ" value={proposal.expectedResults} />

        <div className="border-t border-slate-100 pt-4">
          <div className="card-title">ขั้นตอนเห็นชอบ / อนุมัติ</div>

          {proposal.endorsedByName && (
            <p className="mb-2 text-sm text-slate-600">
              เห็นชอบโดย {proposal.endorsedByName} เมื่อ {proposal.endorsedAt?.slice(0, 10)}
              {proposal.endorseNote ? ` — ${proposal.endorseNote}` : ""}
            </p>
          )}
          {proposal.approvedByName && (
            <p className="mb-2 text-sm text-slate-600">
              อนุมัติโดย {proposal.approvedByName} เมื่อ {proposal.approvedAt?.slice(0, 10)}
              {proposal.approveNote ? ` — ${proposal.approveNote}` : ""}
            </p>
          )}

          {canEndorse && proposal.status === "รอเห็นชอบ" && (
            <div className="grid grid-cols-1 gap-2">
              <p className="text-xs text-slate-500">ขั้นที่ 1: ผู้เห็นชอบโครงการ (เช่น รองผู้อำนวยการ)</p>
              <input
                value={endorseSigner}
                onChange={(e) => setEndorseSigner(e.target.value)}
                placeholder="ชื่อผู้เห็นชอบ"
                className="input"
              />
              <textarea
                value={endorseNote}
                onChange={(e) => setEndorseNote(e.target.value)}
                rows={2}
                placeholder="ความเห็น/หมายเหตุ (ไม่บังคับ)"
                className="input"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleEndorse("เห็นชอบ")} className="btn-primary btn-sm">
                  เห็นชอบ
                </button>
                <button type="button" onClick={() => handleEndorse("ไม่เห็นชอบ")} className="btn-danger btn-sm">
                  ไม่เห็นชอบ
                </button>
              </div>
            </div>
          )}

          {canApprove && proposal.status === "รออนุมัติ" && (
            <div className="grid grid-cols-1 gap-2">
              <p className="text-xs text-slate-500">ขั้นที่ 2: ผู้อนุมัติโครงการ (ผู้อำนวยการ)</p>
              <input
                value={approveSigner}
                onChange={(e) => setApproveSigner(e.target.value)}
                placeholder="ชื่อผู้อนุมัติ"
                className="input"
              />
              <textarea
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                rows={2}
                placeholder="ความเห็น/หมายเหตุ (ไม่บังคับ)"
                className="input"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => handleApprove("อนุมัติแล้ว")} className="btn-primary btn-sm">
                  อนุมัติ
                </button>
                <button type="button" onClick={() => handleApprove("ไม่อนุมัติ")} className="btn-danger btn-sm">
                  ไม่อนุมัติ
                </button>
              </div>
            </div>
          )}

          {isAdmin && !["รอเห็นชอบ"].includes(proposal.status) && (
            <button type="button" onClick={handleReset} className="btn-secondary btn-sm mt-2">
              ย้อนเป็นรอเห็นชอบ
            </button>
          )}
        </div>

        {canDelete && (
          <div className="border-t border-slate-100 pt-4">
            <button type="button" onClick={handleDelete} className="btn-danger btn-sm">
              ลบข้อเสนอโครงการนี้
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
