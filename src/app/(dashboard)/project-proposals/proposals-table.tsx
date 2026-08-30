"use client";

import { ProposalDetailModal } from "./proposal-detail-modal";
import type { updateProposalStatus as updateProposalStatusAction, deleteProposal as deleteProposalAction } from "./actions";

type ProposalRow = {
  id: string;
  name: string;
  proposerName: string | null;
  createdBy: string | null;
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

function statusBadgeClass(status: string) {
  if (status === "เห็นชอบ") return "badge-emerald";
  if (status === "ไม่เห็นชอบ") return "badge-red";
  return "badge-amber";
}

export function ProposalsTable({
  rows,
  isAdmin,
  currentUserId,
  updateProposalStatus,
  deleteProposal,
}: {
  rows: ProposalRow[];
  isAdmin: boolean;
  currentUserId: string | null;
  updateProposalStatus: typeof updateProposalStatusAction;
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
          const canDelete = r.status === "รอพิจารณา" && (isAdmin || r.createdBy === currentUserId);
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
                <ProposalDetailModal
                  proposal={r}
                  isAdmin={isAdmin}
                  canDelete={canDelete}
                  updateProposalStatus={updateProposalStatus}
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
