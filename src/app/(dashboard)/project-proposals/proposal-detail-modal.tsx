"use client";

import { useRef, useState } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { updateProposalStatus as updateProposalStatusAction, deleteProposal as deleteProposalAction } from "./actions";

type Proposal = {
  id: string;
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
  rationale: string | null;
  objectives: string | null;
  targetQuantity: string | null;
  targetQuality: string | null;
  successIndicators: string | null;
  procedures: string | null;
  budgetAmount: number;
  expectedResults: string | null;
  evaluationMethod: string | null;
  status: string;
  statusNote: string | null;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
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

export function ProposalDetailModal({
  proposal,
  isAdmin,
  canDelete,
  updateProposalStatus,
  deleteProposal,
}: {
  proposal: Proposal;
  isAdmin: boolean;
  canDelete: boolean;
  updateProposalStatus: typeof updateProposalStatusAction;
  deleteProposal: typeof deleteProposalAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [note, setNote] = useState(proposal.statusNote ?? "");

  async function handleStatus(status: "เห็นชอบ" | "ไม่เห็นชอบ" | "รอพิจารณา") {
    try {
      await updateProposalStatus(proposal.id, status, note);
      await toastSuccess("บันทึกผลการพิจารณาแล้ว");
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
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={
              proposal.status === "เห็นชอบ"
                ? "badge-emerald"
                : proposal.status === "ไม่เห็นชอบ"
                  ? "badge-red"
                  : "badge-amber"
            }
          >
            {proposal.status}
          </span>
          <span className="text-slate-500">
            ผู้เสนอ: {proposal.proposerName ?? "-"} · {proposal.projectType} · {proposal.adminGroup}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ผู้รับผิดชอบ" value={proposal.responsible.join(", ") || "-"} />
          <Field label="สนองกลยุทธ์/มาตรฐาน" value={proposal.strategyAlignment} />
          <Field
            label="ระยะเวลาดำเนินการ"
            value={proposal.startDate || proposal.endDate ? `${proposal.startDate ?? "-"} ถึง ${proposal.endDate ?? "-"}` : null}
          />
          <Field
            label="งบประมาณ / แหล่งเงิน"
            value={`${formatBaht(proposal.budgetAmount)} บาท (${proposal.budgetSource})`}
          />
        </div>

        <Field label="หลักการและเหตุผล" value={proposal.rationale} />
        <Field label="วัตถุประสงค์" value={proposal.objectives} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="เป้าหมายเชิงปริมาณ" value={proposal.targetQuantity} />
          <Field label="เป้าหมายเชิงคุณภาพ" value={proposal.targetQuality} />
        </div>
        <Field label="ตัวชี้วัดความสำเร็จ" value={proposal.successIndicators} />
        <Field label="วิธีดำเนินการ / ขั้นตอนการดำเนินงาน" value={proposal.procedures} />
        <Field label="ผลที่คาดว่าจะได้รับ" value={proposal.expectedResults} />
        <Field label="การติดตามและประเมินผล" value={proposal.evaluationMethod} />

        {isAdmin && (
          <div className="border-t border-slate-100 pt-4">
            <div className="card-title">ผลการพิจารณา (ผู้อนุมัติ)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="ความเห็น/หมายเหตุ (ไม่บังคับ)"
              className="input mb-3"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleStatus("เห็นชอบ")} className="btn-primary btn-sm">
                เห็นชอบ
              </button>
              <button type="button" onClick={() => handleStatus("ไม่เห็นชอบ")} className="btn-danger btn-sm">
                ไม่เห็นชอบ
              </button>
              {proposal.status !== "รอพิจารณา" && (
                <button type="button" onClick={() => handleStatus("รอพิจารณา")} className="btn-secondary btn-sm">
                  ย้อนเป็นรอพิจารณา
                </button>
              )}
            </div>
          </div>
        )}

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
