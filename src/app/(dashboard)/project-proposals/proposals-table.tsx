"use client";

import { Fragment } from "react";
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
  objectives: string[];
  strategyAlignment: string | null;
  fileUrlWord: string | null;
  fileUrlPdf: string | null;
  fileUrlPdfPreview: string | null;
  adminGroupOrder: number;
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
  onChanged,
  autoOpenId,
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
  onChanged?: () => void;
  /** เปิดป็อปอัปรายละเอียดของรายการนี้อัตโนมัติ — มาจากลิงก์ลัดหน้า "ผู้บริหาร" (?open=<id>) */
  autoOpenId?: string | null;
}) {
  // จัดกลุ่มตามกลุ่มบริหารงาน (ลำดับตาม sort_order ของกลุ่ม เหมือนหน้า "โครงการ"/"รายงานโครงการ") — Array.sort เสถียร
  // จึงคงลำดับเดิม (ใหม่สุดก่อน) ภายในกลุ่มเดียวกัน
  const sortedRows = [...rows].sort(
    (a, b) => a.adminGroupOrder - b.adminGroupOrder || a.adminGroup.localeCompare(b.adminGroup, "th"),
  );
  const groupCounts = new Map<string, number>();
  for (const r of sortedRows) groupCounts.set(r.adminGroup, (groupCounts.get(r.adminGroup) ?? 0) + 1);
  const renderGroupHeader = (name: string) => (
    <>
      {name}{" "}
      <span className="font-normal text-slate-500">({(groupCounts.get(name) ?? 0).toLocaleString("th-TH")} โครงการ)</span>
    </>
  );

  return (
    <>
      {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว (แพทเทิร์นเดียวกับ asset-register/register-tab.tsx) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sortedRows.map((r, i) => {
          const canEdit = r.status === "รอเห็นชอบ" && (isAdmin || r.createdBy === currentUserId);
          const showGroupHeader = i === 0 || sortedRows[i - 1].adminGroup !== r.adminGroup;
          return (
            <Fragment key={r.id}>
            {showGroupHeader && (
              <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {renderGroupHeader(r.adminGroup)}
              </div>
            )}
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">#{i + 1}</span>
                <span className="break-words font-medium text-slate-900">{r.name}</span>
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {r.adminGroup} · {r.proposerName ?? "-"}
              </p>
              <p className="mt-1 text-sm tabular-nums text-slate-700">{formatBaht(r.budgetAmount)} บาท</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.fileUrlPdf && (
                  <a href={r.fileUrlPdf} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                    ดู PDF
                  </a>
                )}
                {canEdit && (
                  <Modal title="แก้ไขข้อเสนอโครงการ" trigger="แก้ไข" triggerClassName="btn-secondary btn-sm" closeOnSubmit wide>
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
                      onSuccess={onChanged}
                      initial={{
                        name: r.name,
                        standard: r.standard,
                        strategyAlignment: r.strategyAlignment,
                        adminGroupId: r.adminGroupId,
                        responsible: r.responsible,
                        objectives: r.objectives,
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
                  onChanged={onChanged}
                  defaultOpen={r.id === autoOpenId}
                />
              </div>
            </div>
            </Fragment>
          );
        })}
        {rows.length === 0 && <p className="table-empty">ยังไม่มีข้อเสนอโครงการ</p>}
      </div>

      {/* จอกว้าง md ขึ้นไป: ตาราง */}
      <table className="hidden table-base min-w-0 md:table [&_td]:px-3 [&_th]:px-3">
        <thead>
          <tr>
            <th className="w-10 text-center">#</th>
            <th>ชื่อโครงการ</th>
            <th>กลุ่มบริหาร</th>
            <th>ผู้เสนอ</th>
            <th className="whitespace-nowrap text-right">งบประมาณ</th>
            <th className="whitespace-nowrap text-center">สถานะ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => {
            const canEdit = r.status === "รอเห็นชอบ" && (isAdmin || r.createdBy === currentUserId);
            const showGroupHeader = i === 0 || sortedRows[i - 1].adminGroup !== r.adminGroup;
            return (
              <Fragment key={r.id}>
              {showGroupHeader && (
                <tr className="bg-slate-100">
                  <td colSpan={7} className="py-2 font-semibold text-slate-700">
                    {renderGroupHeader(r.adminGroup)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                <td className="min-w-[10rem] max-w-[16rem] break-words font-medium text-slate-900">{r.name}</td>
                <td>{r.adminGroup}</td>
                <td>{r.proposerName ?? "-"}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budgetAmount)}</td>
                <td className="whitespace-nowrap text-center">
                  <span className={`${statusBadgeClass(r.status)} !text-sm`}>{r.status}</span>
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {r.fileUrlPdf && (
                      <a href={r.fileUrlPdf} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                        ดู PDF
                      </a>
                    )}
                    {canEdit && (
                      <Modal title="แก้ไขข้อเสนอโครงการ" trigger="แก้ไข" triggerClassName="btn-secondary btn-sm" closeOnSubmit wide>
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
                          onSuccess={onChanged}
                          initial={{
                            name: r.name,
                            standard: r.standard,
                            strategyAlignment: r.strategyAlignment,
                            adminGroupId: r.adminGroupId,
                            responsible: r.responsible,
                            objectives: r.objectives,
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
                      onChanged={onChanged}
                      defaultOpen={r.id === autoOpenId}
                    />
                  </div>
                </td>
              </tr>
              </Fragment>
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
    </>
  );
}
