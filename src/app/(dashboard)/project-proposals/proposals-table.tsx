"use client";

import { Fragment, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
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
  budgetYearId: string | null;
  draftProjectId: string | null;
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

function ActivitiesDetail({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-400">ไม่มีกิจกรรมย่อย</p>;
  }
  return (
    <div className="divide-y divide-slate-200 px-4 py-1">
      {activities.map((a, j) => (
        <div key={j} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span className="text-slate-700">
            <span className="text-slate-400">{j + 1}.</span> {a.name}
          </span>
          <span className="text-slate-500">{(a.responsible ?? []).join(", ") || "ไม่ระบุผู้รับผิดชอบ"}</span>
          <span className="shrink-0 font-medium text-navy-800 tabular-nums">{formatBaht(a.budget)} บาท</span>
        </div>
      ))}
    </div>
  );
}

// จอกว้าง: กิจกรรมย่อยเป็น <tr> จริงในตารางเดียวกับแถวโครงการ (คอลัมน์: # | ชื่อ | กลุ่มบริหาร+ผู้เสนอ(ผู้รับผิดชอบ) | งบ | สถานะ | ปุ่ม)
function ActivityRows({ activities }: { activities: ActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <tr className="bg-slate-50">
        <td colSpan={7} className="px-4 py-3 pl-[2.375rem] text-sm text-slate-400">
          ไม่มีกิจกรรมย่อย
        </td>
      </tr>
    );
  }
  return (
    <>
      {activities.map((a, j) => (
        <tr key={j} className="bg-slate-50">
          <td></td>
          <td className="min-w-[10rem] max-w-[16rem] py-1.5 pl-[2.375rem] text-sm text-slate-700">
            <span className="break-words">
              <span className="text-slate-400">{j + 1}.</span> {a.name}
            </span>
          </td>
          <td colSpan={2} className="py-1.5 text-sm text-slate-500">
            {(a.responsible ?? []).join(", ") || "ไม่ระบุผู้รับผิดชอบ"}
          </td>
          <td className="whitespace-nowrap py-1.5 text-right text-sm font-medium tabular-nums text-navy-800">
            {formatBaht(a.budget)}
          </td>
          <td></td>
          <td></td>
        </tr>
      ))}
    </>
  );
}

export function ProposalsTable({
  rows,
  isAdmin,
  canEndorse,
  canApprove,
  currentUserId,
  draftSummaryByGroup = {},
  lockedActivitiesByDraft = {},
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
  /** จำนวนร่างโครงการและที่เสนอแล้ว แยกตามกลุ่มบริหาร (ปีงบประมาณปัจจุบัน) ไว้แสดงที่หัวกลุ่ม */
  draftSummaryByGroup?: Record<string, { total: number; proposed: number }>;
  /** ร่างโครงการที่กำหนดกิจกรรม+งบครบแล้ว (draftId -> กิจกรรม) — ครูแก้ชื่อ/งบกิจกรรมของข้อเสนอที่ผูกกับร่างนี้ไม่ได้ */
  lockedActivitiesByDraft?: Record<string, { name: string; budget: number }[]>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
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
      {draftSummaryByGroup[name] &&
        (() => {
          const { total, proposed } = draftSummaryByGroup[name];
          const remaining = total - proposed;
          return (
            <>
              <span className="ml-2 font-normal text-slate-500">
                เสนอแล้ว {proposed.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} ร่างโครงการ
              </span>
              {remaining > 0 ? (
                <span className="ml-1 text-amber-700">เหลือ {remaining.toLocaleString("th-TH")}</span>
              ) : (
                <span className="ml-1 text-emerald-700">ครบแล้ว</span>
              )}
            </>
          );
        })()}
    </>
  );

  return (
    <>
      {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว (แพทเทิร์นเดียวกับ asset-register/register-tab.tsx) */}
      <div className="divide-y divide-slate-100 md:hidden">
        {sortedRows.map((r, i) => {
          const canEdit = r.status === "รอเห็นชอบ" && (isAdmin || r.createdBy === currentUserId);
          const showGroupHeader = i === 0 || sortedRows[i - 1].adminGroup !== r.adminGroup;
          const isOpen = expanded.has(r.id);
          return (
            <Fragment key={r.id}>
            {showGroupHeader && (
              <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {renderGroupHeader(r.adminGroup)}
              </div>
            )}
            <div className="px-4 py-3">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                aria-expanded={isOpen}
                className="flex w-full flex-wrap items-center gap-2 text-left"
              >
                <span className="text-xs text-slate-400">#{i + 1}</span>
                <ChevronRightIcon
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="min-w-0 break-words font-medium text-slate-900">{r.name}</span>
                <span className={statusBadgeClass(r.status)}>{r.status}</span>
              </button>
              <p className="mt-0.5 text-xs text-slate-500">
                {r.adminGroup} · {r.proposerName ?? "-"}
              </p>
              <p className="mt-1 text-sm tabular-nums text-slate-700">{formatBaht(r.budgetAmount)} บาท</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {canEdit && (
                  <Modal lazy title="แก้ไขข้อเสนอโครงการ" trigger="แก้ไข" triggerClassName="btn-secondary btn-sm" closeOnSubmit wide>
                    <ProposalForm
                      action={updateProposal.bind(null, r.id)}
                      lockBudget={!isAdmin}
                      lockedDraftActivities={r.draftProjectId ? lockedActivitiesByDraft[r.draftProjectId] : undefined}
                      existingProposalNames={sortedRows
                        .filter((x) => x.id !== r.id && x.budgetYearId === r.budgetYearId)
                        .map((x) => x.name)}
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
              {isOpen && (
                <div className="-mx-4 mt-2 bg-slate-50">
                  <ActivitiesDetail activities={r.activities} />
                </div>
              )}
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
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
              {showGroupHeader && (
                <tr className="bg-slate-100">
                  <td colSpan={7} className="py-2 font-semibold text-slate-700">
                    {renderGroupHeader(r.adminGroup)}
                  </td>
                </tr>
              )}
              <tr onClick={() => toggle(r.id)} className="cursor-pointer">
                <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                <td className="min-w-[10rem] max-w-[16rem] font-medium text-slate-900">
                  <span className="inline-flex items-start gap-1.5">
                    <ChevronRightIcon
                      className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="break-words">{r.name}</span>
                  </span>
                </td>
                <td>{r.adminGroup}</td>
                <td>{r.proposerName ?? "-"}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budgetAmount)}</td>
                <td className="whitespace-nowrap text-center">
                  <span className={`${statusBadgeClass(r.status)} !text-sm`}>{r.status}</span>
                </td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    {canEdit && (
                      <Modal lazy title="แก้ไขข้อเสนอโครงการ" trigger="แก้ไข" triggerClassName="btn-secondary btn-sm" closeOnSubmit wide>
                        <ProposalForm
                          action={updateProposal.bind(null, r.id)}
                          lockBudget={!isAdmin}
                      lockedDraftActivities={r.draftProjectId ? lockedActivitiesByDraft[r.draftProjectId] : undefined}
                          existingProposalNames={sortedRows
                            .filter((x) => x.id !== r.id && x.budgetYearId === r.budgetYearId)
                            .map((x) => x.name)}
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
              {isOpen && <ActivityRows activities={r.activities} />}
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
