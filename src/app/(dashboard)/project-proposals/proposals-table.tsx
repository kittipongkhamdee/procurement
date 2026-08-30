"use client";

import { ProposalDetailModal } from "./proposal-detail-modal";
import type {
  approveProposal as approveProposalAction,
  cancelEndorsement as cancelEndorsementAction,
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
type ProposalRow = {
  id: string;
  name: string;
  proposerName: string | null;
  createdBy: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
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
  endorseProposal,
  cancelEndorsement,
  approveProposal,
  resetProposalStatus,
  deleteProposal,
}: {
  rows: ProposalRow[];
  isAdmin: boolean;
  canEndorse: boolean;
  canApprove: boolean;
  currentUserId: string | null;
  endorseProposal: typeof endorseProposalAction;
  cancelEndorsement: typeof cancelEndorsementAction;
  approveProposal: typeof approveProposalAction;
  resetProposalStatus: typeof resetProposalStatusAction;
  deleteProposal: typeof deleteProposalAction;
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
          const canDelete = r.status === "รอเห็นชอบ" && (isAdmin || r.createdBy === currentUserId);
          return (
            <tr key={r.id}>
              <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
              <td className="min-w-[10rem] max-w-[16rem] break-words font-medium text-slate-900">{r.name}</td>
              <td className="whitespace-nowrap">{r.adminGroup}</td>
              <td className="whitespace-nowrap">{r.proposerName ?? "-"}</td>
              <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budgetAmount)}</td>
              <td className="whitespace-nowrap text-center">
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
                {r.endorsedByName && (
                  <div className="mt-0.5 text-xs text-slate-400">เห็นชอบโดย {r.endorsedByName}</div>
                )}
              </td>
              <td className="text-right">
                <ProposalDetailModal
                  proposal={r}
                  isAdmin={isAdmin}
                  canEndorse={canEndorse}
                  canApprove={canApprove}
                  canDelete={canDelete}
                  endorseProposal={endorseProposal}
                  cancelEndorsement={cancelEndorsement}
                  approveProposal={approveProposal}
                  resetProposalStatus={resetProposalStatus}
                  deleteProposal={deleteProposal}
                />
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
