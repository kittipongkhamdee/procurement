"use client";

import { Modal } from "@/components/modal";
import type { Tables } from "@/lib/supabase/database.types";
import { ProposalDetailModal } from "./proposal-detail-modal";
import { ProposalForm } from "./proposal-form";
import type {
  approveProposal as approveProposalAction,
  cancelEndorsement as cancelEndorsementAction,
  deleteProposal as deleteProposalAction,
  deleteProposalFile as deleteProposalFileAction,
  endorseProposal as endorseProposalAction,
  resetProposalStatus as resetProposalStatusAction,
  updateProposal as updateProposalAction,
} from "./actions";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;
type Strategy = Pick<Tables<"plan_strategies">, "id" | "name">;
type Standard = Pick<Tables<"plan_standards">, "id" | "name">;

type ActivityRow = {
  name: string;
  responsible: string[];
  budget: number;
};
type IndicatorRow = {
  indicator: string;
  target: string;
};
type ProposalRow = {
  id: string;
  name: string;
  proposerName: string | null;
  createdBy: string | null;
  adminGroup: string;
  adminGroupId: string | null;
  budgetSource: string;
  budgetSourceId: string | null;
  standard: string | null;
  responsible: string[];
  strategyAlignment: string | null;
  fileUrlWord: string | null;
  fileUrlPdf: string | null;
  fileUrlWordPath: string | null;
  fileUrlPdfPath: string | null;
  activities: ActivityRow[];
  indicatorsQuantity: IndicatorRow[];
  indicatorsQuality: IndicatorRow[];
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

function statusBadgeClass(status: string) {
  if (status === "อนุมัติแล้ว") return "badge-emerald";
  if (status === "ไม่เห็นชอบ" || status === "ไม่อนุมัติ") return "badge-red";
  return "badge-amber";
}

export function ProposalsTable({
  rows,
  isAdmin,
  canEndorse,
  canApprove,
  currentUserId,
  adminGroups,
  budgetSources,
  teachers,
  strategies,
  standards,
  endorseProposal,
  cancelEndorsement,
  approveProposal,
  resetProposalStatus,
  deleteProposal,
  deleteProposalFile,
  updateProposal,
}: {
  rows: ProposalRow[];
  isAdmin: boolean;
  canEndorse: boolean;
  canApprove: boolean;
  currentUserId: string | null;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  strategies: Strategy[];
  standards: Standard[];
  endorseProposal: typeof endorseProposalAction;
  cancelEndorsement: typeof cancelEndorsementAction;
  approveProposal: typeof approveProposalAction;
  resetProposalStatus: typeof resetProposalStatusAction;
  deleteProposal: typeof deleteProposalAction;
  deleteProposalFile: typeof deleteProposalFileAction;
  updateProposal: typeof updateProposalAction;
}) {
  return (
    <table className="table-base min-w-0">
      <thead>
        <tr>
          <th className="w-10 text-center">#</th>
          <th>ชื่อโครงการ</th>
          <th className="whitespace-nowrap">กลุ่มบริหาร</th>
          <th className="whitespace-nowrap">ผู้เสนอ</th>
          <th className="whitespace-nowrap text-right">งบประมาณ</th>
          <th className="whitespace-nowrap text-center">สถานะ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const canEdit = r.status === "รอเห็นชอบ" && (isAdmin || r.createdBy === currentUserId);
          return (
            <tr key={r.id}>
              <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
              <td className="min-w-[10rem] max-w-[16rem] break-words font-medium text-slate-900">{r.name}</td>
              <td className="whitespace-nowrap">{r.adminGroup}</td>
              <td className="whitespace-nowrap">{r.proposerName ?? "-"}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budgetAmount)}</td>
              <td className="whitespace-nowrap text-center">
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  {canEdit && (
                    <Modal title="แก้ไขข้อเสนอโครงการ" trigger="แก้ไข" triggerClassName="btn-secondary btn-sm" closeOnSubmit>
                      <ProposalForm
                        action={updateProposal.bind(null, r.id)}
                        budgetYearId=""
                        adminGroups={adminGroups}
                        budgetSources={budgetSources}
                        teachers={teachers}
                        strategies={strategies}
                        standards={standards}
                        submitLabel="บันทึกการแก้ไข"
                        successMessage="บันทึกการแก้ไขเรียบร้อยแล้ว"
                        initial={{
                          name: r.name,
                          standard: r.standard,
                          strategyAlignment: r.strategyAlignment,
                          adminGroupId: r.adminGroupId,
                          responsible: r.responsible,
                          activities: r.activities.map((a) => ({
                            name: a.name,
                            responsible: a.responsible,
                            budget: String(a.budget),
                          })),
                          budgetAmount: r.budgetAmount,
                          budgetSourceId: r.budgetSourceId,
                          fileUrlWordPath: r.fileUrlWordPath,
                          fileUrlPdfPath: r.fileUrlPdfPath,
                          indicatorsQuantity: r.indicatorsQuantity,
                          indicatorsQuality: r.indicatorsQuality,
                        }}
                      />
                    </Modal>
                  )}
                  <ProposalDetailModal
                    proposal={r}
                    isAdmin={isAdmin}
                    canEndorse={canEndorse}
                    canApprove={canApprove}
                    canDelete={canEdit}
                    endorseProposal={endorseProposal}
                    cancelEndorsement={cancelEndorsement}
                    approveProposal={approveProposal}
                    resetProposalStatus={resetProposalStatus}
                    deleteProposal={deleteProposal}
                    deleteProposalFile={deleteProposalFile}
                  />
                </div>
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="table-empty">
              ยังไม่มีข้อเสนอโครงการ
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
