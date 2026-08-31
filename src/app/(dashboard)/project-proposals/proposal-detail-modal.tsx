"use client";

import { useRef, useState, type ReactNode } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { WordFileIcon, PdfFileIcon } from "@/components/icons";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import type {
  approveProposal as approveProposalAction,
  cancelEndorsement as cancelEndorsementAction,
  deleteProposal as deleteProposalAction,
  deleteProposalFile as deleteProposalFileAction,
  endorseProposal as endorseProposalAction,
  resetProposalStatus as resetProposalStatusAction,
} from "./actions";

type ActivityRow = {
  name: string;
  responsible: string[];
  budget: number;
};

type Proposal = {
  id: string;
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  responsible: string[];
  strategyAlignment: string | null;
  fileUrlWord: string | null;
  fileUrlPdf: string | null;
  activities: ActivityRow[];
  budgetAmount: number;
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-sm font-bold text-navy-800">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="border-b border-slate-200 pb-1 text-sm font-bold text-navy-800">{children}</div>;
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
  cancelEndorsement,
  approveProposal,
  resetProposalStatus,
  deleteProposal,
  deleteProposalFile,
}: {
  proposal: Proposal;
  isAdmin: boolean;
  canEndorse: boolean;
  canApprove: boolean;
  canDelete: boolean;
  endorseProposal: typeof endorseProposalAction;
  cancelEndorsement: typeof cancelEndorsementAction;
  approveProposal: typeof approveProposalAction;
  resetProposalStatus: typeof resetProposalStatusAction;
  deleteProposal: typeof deleteProposalAction;
  deleteProposalFile: typeof deleteProposalFileAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [endorseNote, setEndorseNote] = useState("");
  const [endorseRejecting, setEndorseRejecting] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [approveRejecting, setApproveRejecting] = useState(false);

  async function handleEndorse(decision: "เห็นชอบ" | "ไม่เห็นชอบ") {
    if (decision === "ไม่เห็นชอบ" && !endorseNote.trim()) {
      await toastError("กรุณาระบุความเห็น/ข้อเสนอแนะให้ครูปรับปรุงแก้ไข");
      return;
    }
    try {
      await endorseProposal(proposal.id, decision, endorseNote);
      await toastSuccess("บันทึกผลการเห็นชอบแล้ว");
      setEndorseRejecting(false);
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleApprove(decision: "อนุมัติแล้ว" | "ไม่อนุมัติ") {
    if (decision === "ไม่อนุมัติ" && !approveNote.trim()) {
      await toastError("กรุณาระบุความเห็น/ข้อเสนอแนะให้ครูปรับปรุงแก้ไข");
      return;
    }
    try {
      await approveProposal(proposal.id, decision, approveNote);
      await toastSuccess("บันทึกผลการอนุมัติแล้ว");
      setApproveRejecting(false);
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCancelEndorsement() {
    try {
      await cancelEndorsement(proposal.id);
      await toastSuccess("ยกเลิกการเห็นชอบแล้ว");
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

  async function handleDeleteFile(field: "file_url_word" | "file_url_pdf") {
    const ok = await confirmDelete({ title: "ลบไฟล์นี้?" });
    if (!ok) return;
    try {
      await deleteProposalFile(proposal.id, field);
      await toastSuccess("ลบไฟล์เรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <Modal ref={modalRef} title={proposal.name} trigger="ดูรายละเอียด" triggerClassName="btn-secondary btn-sm">
      <div className="grid grid-cols-1 gap-4 text-left">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={statusBadgeClass(proposal.status)}>{proposal.status}</span>
          <span className="text-slate-500">
            ผู้เสนอ: {proposal.proposerName ?? "-"} · {proposal.adminGroup}
          </span>
        </div>

        {(() => {
          const approverOnly = (canEndorse || canApprove) && !isAdmin;
          const showWordFile = !!proposal.fileUrlWord && !approverOnly;
          const showPdfFile = !!proposal.fileUrlPdf;
          if (!showWordFile && !showPdfFile) return null;
          return (
          <div className="flex flex-wrap items-center gap-3">
            {showWordFile && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-1.5 pl-2 pr-3">
                <a
                  href={proposal.fileUrlWord!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-semibold text-blue-800"
                >
                  <WordFileIcon className="h-6 w-6 shrink-0" />
                  เปิดไฟล์โครงการ (Word)
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFile("file_url_word")}
                    aria-label="ลบไฟล์ Word"
                    className="text-blue-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </span>
            )}
            {showPdfFile && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1.5 pl-2 pr-3">
                <a
                  href={proposal.fileUrlPdf!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-semibold text-red-800"
                >
                  <PdfFileIcon className="h-6 w-6 shrink-0" />
                  เปิดไฟล์โครงการ (PDF)
                </a>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFile("file_url_pdf")}
                    aria-label="ลบไฟล์ PDF"
                    className="text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              </span>
            )}
          </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="สนองกลยุทธ์โรงเรียน" value={proposal.strategyAlignment} />
          <Field label="สอดคล้องกับมาตรฐานการศึกษา" value={proposal.standard} />
          <Field label="ผู้รับผิดชอบ" value={proposal.responsible.join(", ") || "-"} />
        </div>

        {proposal.activities.length > 0 && (
          <div>
            <SectionTitle>ขั้นตอนการดำเนินงาน และงบประมาณ</SectionTitle>
            <div className="mt-1 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
              {proposal.activities.map((a, i) => {
                const rowTotal = Number(a.budget) || 0;
                return (
                  <div key={i} className="grid grid-cols-1 gap-1.5 p-3 text-sm">
                    <div className="text-left font-medium text-slate-700">
                      {i + 1}. {a.name}
                    </div>
                    <div className="text-left text-slate-500">ผู้รับผิดชอบ: {a.responsible.join(", ") || "-"}</div>
                    <div className="text-left font-medium text-navy-800 tabular-nums">
                      งบประมาณ: {formatBaht(rowTotal)} บาท
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-left text-sm font-bold text-navy-800">
              รวมงบประมาณทั้งสิ้น: {formatBaht(proposal.budgetAmount)} บาท (แหล่งเงิน: {proposal.budgetSource})
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="card-title">ขั้นตอนเห็นชอบ / อนุมัติ</div>

          {proposal.endorsedByName && (
            <p className="mb-2 text-sm text-slate-600">
              เห็นชอบโดย {proposal.endorsedByName} เมื่อ {formatThaiDate(proposal.endorsedAt)}
              {proposal.endorseNote ? ` — ${proposal.endorseNote}` : ""}
            </p>
          )}
          {proposal.approvedByName && (
            <p className="mb-2 text-sm text-slate-600">
              อนุมัติโดย {proposal.approvedByName} เมื่อ {formatThaiDate(proposal.approvedAt)}
              {proposal.approveNote ? ` — ${proposal.approveNote}` : ""}
            </p>
          )}

          {canEndorse && proposal.status === "รออนุมัติ" && (
            <button type="button" onClick={handleCancelEndorsement} className="btn-secondary btn-sm mb-2">
              ยกเลิกเห็นชอบ
            </button>
          )}

          {canEndorse && proposal.status === "รอเห็นชอบ" && (
            <div className="grid grid-cols-1 gap-2">
              {endorseRejecting && (
                <textarea
                  value={endorseNote}
                  onChange={(e) => setEndorseNote(e.target.value)}
                  rows={2}
                  placeholder="ระบุความเห็น/ข้อเสนอแนะให้ครูปรับปรุงแก้ไข (จำเป็น)"
                  className="input"
                  autoFocus
                />
              )}
              <div className="flex flex-wrap gap-3">
                {endorseRejecting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEndorse("ไม่เห็นชอบ")}
                      className="btn-danger flex-1 py-3 text-base"
                    >
                      ยืนยันไม่เห็นชอบ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEndorseRejecting(false);
                        setEndorseNote("");
                      }}
                      className="btn-secondary flex-1 py-3 text-base"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEndorse("เห็นชอบ")}
                      className="btn-primary flex-1 py-3 text-base"
                    >
                      เห็นชอบ
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndorseRejecting(true)}
                      className="btn-danger flex-1 py-3 text-base"
                    >
                      ไม่เห็นชอบ
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {canApprove && proposal.status === "รออนุมัติ" && (
            <div className="grid grid-cols-1 gap-2">
              {approveRejecting && (
                <textarea
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  rows={2}
                  placeholder="ระบุความเห็น/ข้อเสนอแนะให้ครูปรับปรุงแก้ไข (จำเป็น)"
                  className="input"
                  autoFocus
                />
              )}
              <div className="flex flex-wrap gap-3">
                {approveRejecting ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove("ไม่อนุมัติ")}
                      className="btn-danger flex-1 py-3 text-base"
                    >
                      ยืนยันไม่อนุมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApproveRejecting(false);
                        setApproveNote("");
                      }}
                      className="btn-secondary flex-1 py-3 text-base"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove("อนุมัติแล้ว")}
                      className="btn-primary flex-1 py-3 text-base"
                    >
                      อนุมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => setApproveRejecting(true)}
                      className="btn-danger flex-1 py-3 text-base"
                    >
                      ไม่อนุมัติ
                    </button>
                  </>
                )}
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
