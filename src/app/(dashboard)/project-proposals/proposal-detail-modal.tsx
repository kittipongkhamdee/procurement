"use client";

import { useRef, useState } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { updateProposalStatus as updateProposalStatusAction, deleteProposal as deleteProposalAction } from "./actions";

type ActivityRow = { name: string; period: string; responsible: string[] };
type EvaluationRow = { indicator: string; method: string; tool: string };

type Proposal = {
  id: string;
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  planName: string | null;
  standard: string | null;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
  rationale: string | null;
  objectives: string | null;
  targetQuantity: string | null;
  targetQuality: string | null;
  activities: ActivityRow[];
  budgetAmount: number;
  evaluationItems: EvaluationRow[];
  expectedResults: string | null;
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
          <Field label="แผนงาน" value={proposal.planName} />
          <Field label="สนองมาตรฐาน" value={proposal.standard} />
          <Field label="ผู้รับผิดชอบ" value={proposal.responsible.join(", ") || "-"} />
          <Field label="สนองกลยุทธ์/ประเด็นกลยุทธ์" value={proposal.strategyAlignment} />
          <Field
            label="ระยะเวลาดำเนินการ"
            value={proposal.startDate || proposal.endDate ? `${proposal.startDate ?? "-"} ถึง ${proposal.endDate ?? "-"}` : null}
          />
          <Field
            label="งบประมาณ / แหล่งเงิน"
            value={`${formatBaht(proposal.budgetAmount)} บาท (${proposal.budgetSource})`}
          />
        </div>

        <Field label="๑. หลักการและเหตุผล" value={proposal.rationale} />
        <Field label="๒. วัตถุประสงค์" value={proposal.objectives} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="๓. เป้าหมายเชิงปริมาณ" value={proposal.targetQuantity} />
          <Field label="เป้าหมายเชิงคุณภาพ" value={proposal.targetQuality} />
        </div>

        {proposal.activities.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              ๔. กิจกรรม / ขั้นตอนการดำเนินงาน
            </div>
            <div className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {proposal.activities.map((a, i) => (
                <div key={i} className="grid grid-cols-1 gap-1 p-2 text-sm sm:grid-cols-[1fr_8rem_10rem]">
                  <span className="text-slate-700">{a.name}</span>
                  <span className="text-slate-500">{a.period || "-"}</span>
                  <span className="text-slate-500">{a.responsible.join(", ") || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field
          label="๕. งบประมาณที่ใช้"
          value={`${formatBaht(proposal.budgetAmount)} บาท (${proposal.budgetSource})`}
        />

        {proposal.evaluationItems.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">๖. การประเมินผล</div>
            <div className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {proposal.evaluationItems.map((e, i) => (
                <div key={i} className="grid grid-cols-1 gap-1 p-2 text-sm sm:grid-cols-3">
                  <span className="text-slate-700">{e.indicator}</span>
                  <span className="text-slate-500">{e.method || "-"}</span>
                  <span className="text-slate-500">{e.tool || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="๗. ผลที่คาดว่าจะได้รับ" value={proposal.expectedResults} />

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
