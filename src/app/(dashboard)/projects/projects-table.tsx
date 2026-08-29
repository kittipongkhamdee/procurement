"use client";

import { Fragment, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { ProjectEditModal } from "./project-edit-modal";
import type { Tables } from "@/lib/supabase/database.types";
import type {
  createActivity as createActivityAction,
  deleteActivity as deleteActivityAction,
  deleteProject as deleteProjectAction,
  updateActivity as updateActivityAction,
  updateProject as updateProjectAction,
} from "./actions";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;
type Activity = { id: string; name: string | null; budget: number; responsible: string[] | null };

type ProjectRow = {
  id: string;
  name: string;
  projectBudget: number;
  budgetYearId: string;
  adminGroupId: string;
  budgetSourceId: string | null;
  adminGroup: string;
  budgetSource: string;
  activities: Activity[];
  budget: number;
  spent: number;
  remaining: number;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function ProjectsTable({
  rows,
  isAdmin,
  adminGroups,
  budgetSources,
  teachers,
  updateProject,
  deleteProject,
  createActivity,
  updateActivity,
  deleteActivity,
}: {
  rows: ProjectRow[];
  isAdmin: boolean;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  updateProject: typeof updateProjectAction;
  deleteProject: typeof deleteProjectAction;
  createActivity: typeof createActivityAction;
  updateActivity: typeof updateActivityAction;
  deleteActivity: typeof deleteActivityAction;
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

  const colSpan = isAdmin ? 8 : 7;

  return (
    <table className="table-base">
      <thead>
        <tr>
          <th className="w-10 text-center">#</th>
          <th>โครงการ</th>
          <th>กลุ่มบริหาร</th>
          <th>แหล่งเงินงบประมาณ</th>
          <th className="text-right">งบประมาณ</th>
          <th className="text-right">เบิกจ่ายแล้ว</th>
          <th className="text-right">คงเหลือ</th>
          {isAdmin && <th></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isOpen = expanded.has(r.id);
          return (
            <Fragment key={r.id}>
              <tr onClick={() => toggle(r.id)} className="cursor-pointer">
                <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                <td className="font-medium text-slate-900">
                  <span className="inline-flex items-center gap-1.5">
                    <ChevronRightIcon
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    {r.name}
                  </span>
                </td>
                <td>{r.adminGroup}</td>
                <td>{r.budgetSource}</td>
                <td className="text-right tabular-nums">{formatBaht(r.budget)}</td>
                <td className="text-right tabular-nums text-emerald-700">{formatBaht(r.spent)}</td>
                <td className="text-right tabular-nums font-semibold text-amber-700">{formatBaht(r.remaining)}</td>
                {isAdmin && (
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <ProjectEditModal
                      projectId={r.id}
                      name={r.name}
                      budgetYearId={r.budgetYearId}
                      adminGroupId={r.adminGroupId}
                      budgetSourceId={r.budgetSourceId}
                      projectBudget={r.projectBudget}
                      activities={r.activities}
                      adminGroups={adminGroups}
                      budgetSources={budgetSources}
                      teachers={teachers}
                      updateProject={updateProject}
                      deleteProject={deleteProject}
                      createActivity={createActivity}
                      updateActivity={updateActivity}
                      deleteActivity={deleteActivity}
                    />
                  </td>
                )}
              </tr>
              {isOpen && (
                <tr>
                  <td colSpan={colSpan} className="bg-slate-50 p-0">
                    {r.activities.length > 0 ? (
                      <div className="divide-y divide-slate-200 px-4 py-1 sm:px-10">
                        {r.activities.map((a) => (
                          <div
                            key={a.id}
                            className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                          >
                            <span className="text-slate-700">{a.name}</span>
                            <span className="text-slate-500">
                              {(a.responsible ?? []).join(", ") || "ไม่ระบุผู้รับผิดชอบ"}
                            </span>
                            <span className="shrink-0 font-medium text-navy-800 tabular-nums">
                              {formatBaht(a.budget)} บาท
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-sm text-slate-400 sm:px-10">
                        ไม่มีกิจกรรมย่อย (งบประมาณโครงการโดยตรง {formatBaht(r.projectBudget)} บาท)
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {rows.length === 0 && (
          <tr>
            <td colSpan={colSpan} className="table-empty">
              ยังไม่มีโครงการในปีงบประมาณนี้
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
