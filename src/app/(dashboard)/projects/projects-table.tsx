"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRightIcon, DownloadIcon, SearchIcon } from "@/components/icons";
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

function ActivitiesDetail({ activities, projectBudget }: { activities: Activity[]; projectBudget: number }) {
  if (activities.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-slate-400">
        ไม่มีกิจกรรมย่อย (งบประมาณโครงการโดยตรง {formatBaht(projectBudget)} บาท)
      </p>
    );
  }
  return (
    <div className="divide-y divide-slate-200 px-4 py-1">
      {activities.map((a, j) => (
        <div key={a.id} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
  onChanged,
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
  onChanged?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.adminGroup.toLowerCase().includes(q) ||
        r.budgetSource.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function exportToExcel() {
    const header = ["ลำดับ", "ชื่อโครงการ", "กลุ่มบริหาร", "แหล่งเงินงบประมาณ", "งบประมาณ", "เบิกจ่ายแล้ว", "คงเหลือ"];
    const escapeCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [header.map(escapeCell).join(",")];
    filteredRows.forEach((r, i) => {
      lines.push(
        [i + 1, r.name, r.adminGroup, r.budgetSource, r.budget.toFixed(2), r.spent.toFixed(2), r.remaining.toFixed(2)]
          .map(escapeCell)
          .join(","),
      );
    });
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `โครงการ-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const colSpan = isAdmin ? 8 : 7;
  const pageOffset = (currentPage - 1) * pageSize;

  function editModal(r: ProjectRow, textSizeClass?: string) {
    return (
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
        onChanged={onChanged}
        textSizeClass={textSizeClass}
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200/80 px-4 py-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="ค้นหาชื่อโครงการ, กลุ่มบริหาร, แหล่งเงินงบประมาณ..."
          className="w-full border-0 bg-transparent p-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={exportToExcel}
          disabled={filteredRows.length === 0}
          className="btn-secondary btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DownloadIcon className="h-4 w-4" />
          <span className="hidden sm:inline">ส่งออก Excel</span>
        </button>
      </div>

      {/* มือถือ: การ์ดแสดงรายการ (ชื่อโครงการขึ้นบรรทัดเต็มความกว้าง ไม่บีบเป็นคอลัมน์แคบ) */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {pageRows.map((r, i) => {
          const isOpen = expanded.has(r.id);
          return (
            <div key={r.id}>
              <div className="flex items-start gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-slate-400">{pageOffset + i + 1}</span>
                  <ChevronRightIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{r.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="badge-slate">{r.adminGroup}</span>
                      <span className="tabular-nums text-amber-700">คงเหลือ {formatBaht(r.remaining)} บาท</span>
                    </span>
                  </span>
                </button>
                {isAdmin && <div className="shrink-0">{editModal(r)}</div>}
              </div>
              {isOpen && (
                <div className="bg-slate-50">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-xs text-slate-500">
                    <span>แหล่งเงิน: {r.budgetSource}</span>
                    <span>งบประมาณ: {formatBaht(r.budget)}</span>
                    <span className="text-emerald-700">เบิกจ่ายแล้ว: {formatBaht(r.spent)}</span>
                  </div>
                  <ActivitiesDetail activities={r.activities} projectBudget={r.projectBudget} />
                </div>
              )}
            </div>
          );
        })}
        {pageRows.length === 0 && (
          <p className="table-empty">{query ? "ไม่พบโครงการที่ค้นหา" : "ยังไม่มีโครงการในปีงบประมาณนี้"}</p>
        )}
      </div>

      {/* จอกว้าง: ตาราง */}
      <table className="hidden table-base sm:table">
        <thead>
          <tr>
            <th className="w-10 text-center">#</th>
            <th>โครงการ</th>
            <th className="whitespace-nowrap">กลุ่มบริหาร</th>
            <th className="whitespace-nowrap">แหล่งเงินงบประมาณ</th>
            <th className="whitespace-nowrap text-right">งบประมาณ</th>
            <th className="whitespace-nowrap text-right">เบิกจ่ายแล้ว</th>
            <th className="whitespace-nowrap text-right">คงเหลือ</th>
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r, i) => {
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr onClick={() => toggle(r.id)} className="cursor-pointer">
                  <td className="text-center tabular-nums text-slate-400">{pageOffset + i + 1}</td>
                  <td className="min-w-[10rem] max-w-[16rem] font-medium text-slate-900">
                    <span className="inline-flex items-start gap-1.5">
                      <ChevronRightIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                      <span className="break-words">{r.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{r.adminGroup}</td>
                  <td className="whitespace-nowrap">{r.budgetSource}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budget)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums text-emerald-700">
                    {formatBaht(r.spent)}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums font-semibold text-amber-700">
                    {formatBaht(r.remaining)}
                  </td>
                  {isAdmin && (
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {editModal(r, "text-sm")}
                    </td>
                  )}
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={colSpan} className="bg-slate-50 p-0 pl-[2.375rem]">
                      <ActivitiesDetail activities={r.activities} projectBudget={r.projectBudget} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {pageRows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="table-empty">
                {query ? "ไม่พบโครงการที่ค้นหา" : "ยังไม่มีโครงการในปีงบประมาณนี้"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {filteredRows.length > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-sm">
          <span className="text-slate-500">
            หน้า {currentPage} จาก {totalPages} ({filteredRows.length.toLocaleString("th-TH")} โครงการ)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </>
  );
}
