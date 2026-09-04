"use client";

// หน้า "การจัดสรรเงิน" — แยกออกมาจาก /projects โดยเฉพาะสำหรับงานจัดสรรงบประมาณให้แต่ละโครงการ
// จัดกลุ่ม/กรองตาม 3 มิติ: ปีงบประมาณ, แหล่งงบประมาณ, กลุ่มบริหารงาน — ใช้ client-fetch pattern
// เดียวกับ /projects (ดู /root/.claude/plans)

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
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

export default function FundAllocationPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [budgetYears, setBudgetYears] = useState<{ id: string; year: number; is_open: boolean }[]>([]);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [budgetYearId, setBudgetYearId] = useState<string | null>(null);
  const [adminGroupId, setAdminGroupId] = useState<string>(ALL);
  const [budgetSourceId, setBudgetSourceId] = useState<string>(ALL);
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();

    const [{ data: yearsData }, { data: groupsData }, { data: sourcesData }] = await Promise.all([
      supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false }),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    ]);
    setBudgetYears(yearsData ?? []);
    setAdminGroups(groupsData ?? []);
    setBudgetSources(sourcesData ?? []);

    setBudgetYearId((prev) => prev ?? (yearsData?.find((y) => y.is_open) ?? yearsData?.[0])?.id ?? null);
  }, []);

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
    reload();
  }, [reload]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (budgetYearId) loadProjects(budgetYearId);
  }, [budgetYearId, loadProjects]);

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

  if (authLoading || rows === null) return <PageLoadingSkeleton />;

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">การจัดสรรเงิน</h1>
          <p className="page-subtitle">จัดสรรงบประมาณให้แต่ละโครงการ ตามปีงบประมาณ แหล่งเงิน และกลุ่มบริหาร</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">ปีงบประมาณ</label>
          <select
            value={budgetYearId ?? ""}
            onChange={(e) => setBudgetYearId(e.target.value)}
            className="input"
          >
            {budgetYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year}
                {y.is_open ? " (เปิดใช้งาน)" : ""}
              </option>
            ))}
          </select>
        </div>
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

      <div className="table-shell mt-6">
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
