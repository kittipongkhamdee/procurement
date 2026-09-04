"use client";

// แท็บ "จัดโครงการ" — รายละเอียดจัดสรรงบประมาณแยกตามโครงการ/กิจกรรม (เนื้อหาเดิมของหน้านี้ ย้ายมา
// เป็นแท็บ) เพิ่มแถบเทียบ "งบที่จัดสรรให้กลุ่มนี้" (จากแท็บจัดสรรเงิน) กับ "รวมที่ใช้ไปในโครงการ"

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { updateProjectBudget } from "../projects/actions";

type Option = { id: string; name: string };
type ProjectRow = {
  id: string;
  name: string;
  adminGroup: string;
  budgetSource: string;
  hasActivities: boolean;
  activitiesBudget: number;
  directBudget: number;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const ALL = "__all__";

export function ProjectAllocationTab({
  budgetYearId,
  adminGroups,
  budgetSources,
}: {
  budgetYearId: string;
  adminGroups: Option[];
  budgetSources: Option[];
}) {
  const [adminGroupId, setAdminGroupId] = useState<string>(ALL);
  const [budgetSourceId, setBudgetSourceId] = useState<string>(ALL);
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [groupAllocated, setGroupAllocated] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadProjects = useCallback(async (yearId: string) => {
    const supabase = createClient();
    const { data: projects } = await supabase
      .from("plan_projects")
      .select("id, name, budget, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)")
      .eq("budget_year_id", yearId)
      .order("sort_order");

    setRows(
      (projects ?? []).map((p) => {
        const activities = p.plan_activities as unknown as { budget: number }[];
        return {
          id: p.id,
          name: p.name,
          adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
          budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
          hasActivities: activities.length > 0,
          activitiesBudget: activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0),
          directBudget: Number(p.budget ?? 0),
        };
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects(budgetYearId);
  }, [budgetYearId, loadProjects]);

  useEffect(() => {
    if (adminGroupId === ALL) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroupAllocated(null);
      return;
    }
    let active = true;
    const supabase = createClient();
    supabase
      .from("plan_group_allocations")
      .select("allocated_amount")
      .eq("budget_year_id", budgetYearId)
      .eq("admin_group_id", adminGroupId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setGroupAllocated(data ? Number(data.allocated_amount) : 0);
      });
    return () => {
      active = false;
    };
  }, [budgetYearId, adminGroupId]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (adminGroupId !== ALL && r.adminGroup !== adminGroups.find((g) => g.id === adminGroupId)?.name) return false;
      if (budgetSourceId !== ALL && r.budgetSource !== budgetSources.find((s) => s.id === budgetSourceId)?.name)
        return false;
      return true;
    });
  }, [rows, adminGroupId, budgetSourceId, adminGroups, budgetSources]);

  const totalAllocated = filteredRows.reduce(
    (sum, r) => sum + (r.hasActivities ? r.activitiesBudget : r.directBudget),
    0,
  );

  async function handleSave(row: ProjectRow) {
    const raw = drafts[row.id];
    const value = Number(raw);
    if (raw === undefined || Number.isNaN(value) || value < 0) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setSavingId(row.id);
    try {
      await updateProjectBudget(row.id, value);
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? { ...r, directBudget: value } : r)) : prev));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await toastSuccess("บันทึกงบประมาณเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  if (rows === null) return <p className="p-4 text-sm text-slate-400">กำลังโหลด...</p>;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">แหล่งงบประมาณ</label>
          <select value={budgetSourceId} onChange={(e) => setBudgetSourceId(e.target.value)} className="input">
            <option value={ALL}>ทั้งหมด</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">กลุ่มบริหารงาน</label>
          <select value={adminGroupId} onChange={(e) => setAdminGroupId(e.target.value)} className="input">
            <option value={ALL}>ทั้งหมด</option>
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groupAllocated !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-500">
            งบที่จัดสรรให้กลุ่มนี้: <span className="font-semibold text-navy-800">{formatBaht(groupAllocated)}</span>
          </span>
          <span className="text-slate-500">
            รวมที่ใช้ไปในโครงการ: <span className="font-semibold text-navy-800">{formatBaht(totalAllocated)}</span>
          </span>
          <span className={groupAllocated - totalAllocated < 0 ? "text-red-600" : "text-emerald-700"}>
            คงเหลือ:{" "}
            <span className="font-semibold">{formatBaht(groupAllocated - totalAllocated)}</span>
          </span>
        </div>
      )}

      <div className="table-shell mt-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>โครงการ</th>
              <th className="whitespace-nowrap">กลุ่มบริหาร</th>
              <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
              <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.id}>
                <td className="min-w-[10rem] max-w-[18rem]">
                  <span className="break-words font-medium text-slate-900">{r.name}</span>
                </td>
                <td className="whitespace-nowrap">{r.adminGroup}</td>
                <td className="whitespace-nowrap">{r.budgetSource}</td>
                <td className="whitespace-nowrap text-right">
                  {r.hasActivities ? (
                    <span className="tabular-nums text-slate-500" title="รวมจากกิจกรรมย่อย — แก้ไขได้ที่หน้าโครงการ">
                      {formatBaht(r.activitiesBudget)}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={drafts[r.id] ?? r.directBudget}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="input w-36 text-right"
                    />
                  )}
                </td>
                <td className="whitespace-nowrap text-right">
                  {r.hasActivities ? (
                    <a href="/projects" className="text-xs font-medium text-navy-800 hover:underline">
                      จัดการที่โครงการ
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={drafts[r.id] === undefined || savingId === r.id}
                      onClick={() => handleSave(r)}
                      className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {savingId === r.id ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  ไม่พบโครงการตามเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
          </tbody>
          {filteredRows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right font-semibold text-slate-600">
                  รวมงบประมาณที่จัดสรร
                </td>
                <td className="whitespace-nowrap text-right font-bold text-navy-800 tabular-nums">
                  {formatBaht(totalAllocated)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
