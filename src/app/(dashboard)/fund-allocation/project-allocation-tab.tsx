"use client";

// แท็บ "จัดโครงการ" — จุดเริ่มต้นเตรียมข้อมูลโครงการสำหรับปีงบประมาณใหม่ โดย "คัดลอก" รายการโครงการ
// จากปีงบประมาณเดิม (เลือกได้) มาสร้างเป็น "ข้อเสนอโครงการ" (plan_project_proposals) ของปีที่เลือกไว้ใน
// หน้านี้ — ยังไม่ใช่โครงการจริง ต้องไปผ่านกระบวนการเห็นชอบ/อนุมัติต่อที่เมนู "เสนอโครงการ" ก่อน
// (ไม่เขียนลง plan_projects ตรงๆ) ส่วนล่างของแท็บแสดงรายการโครงการที่อนุมัติแล้วจริงของปีนี้แบบอ่าน
// อย่างเดียว พร้อมแถบเทียบงบที่จัดสรรให้กลุ่มกับยอดที่ใช้ไปแล้ว

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { copyProjectsToProposals } from "./actions";

type Option = { id: string; name: string };
type BudgetYear = { id: string; year: number; is_open: boolean };

type SourceProjectRow = {
  id: string;
  name: string;
  adminGroup: string;
  budgetSource: string;
  budget: number;
  alreadyCopied: boolean;
};

type CurrentProjectRow = {
  id: string;
  name: string;
  adminGroupId: string;
  adminGroup: string;
  budgetSourceId: string | null;
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
  budgetYears,
  adminGroups,
  budgetSources,
}: {
  budgetYearId: string;
  budgetYears: BudgetYear[];
  adminGroups: Option[];
  budgetSources: Option[];
}) {
  const targetYear = budgetYears.find((y) => y.id === budgetYearId) ?? null;
  const otherYears = budgetYears.filter((y) => y.id !== budgetYearId);

  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [sourceRows, setSourceRows] = useState<SourceProjectRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);

  const [adminGroupId, setAdminGroupId] = useState<string>(ALL);
  const [budgetSourceId, setBudgetSourceId] = useState<string>(ALL);
  const [currentRows, setCurrentRows] = useState<CurrentProjectRow[] | null>(null);
  const [groupAllocated, setGroupAllocated] = useState<number | null>(null);

  useEffect(() => {
    // เลือกปีงบประมาณที่เก่ากว่าปีเป้าหมายที่ใกล้ที่สุดเป็นค่าเริ่มต้น (ปีก่อนหน้า)
    if (sourceYearId || otherYears.length === 0 || !targetYear) return;
    const older = otherYears.filter((y) => y.year < targetYear.year).sort((a, b) => b.year - a.year);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceYearId((older[0] ?? otherYears[0]).id);
  }, [otherYears, targetYear, sourceYearId]);

  const loadSourceProjects = useCallback(
    async (srcYearId: string) => {
      if (!srcYearId) {
        setSourceRows([]);
        return;
      }
      const supabase = createClient();
      const [{ data: projects }, { data: existingProposals }] = await Promise.all([
        supabase
          .from("plan_projects")
          .select("id, name, budget, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)")
          .eq("budget_year_id", srcYearId)
          .order("sort_order"),
        supabase.from("plan_project_proposals").select("name").eq("budget_year_id", budgetYearId),
      ]);
      const copiedNames = new Set((existingProposals ?? []).map((p) => p.name));

      setSourceRows(
        (projects ?? []).map((p) => {
          const activities = p.plan_activities as unknown as { budget: number }[];
          const budget =
            activities.length > 0
              ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0)
              : Number(p.budget ?? 0);
          return {
            id: p.id,
            name: p.name,
            adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
            budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
            budget,
            alreadyCopied: copiedNames.has(p.name),
          };
        }),
      );
      setSelectedIds(new Set());
    },
    [budgetYearId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSourceProjects(sourceYearId);
  }, [sourceYearId, loadSourceProjects]);

  const loadCurrentProjects = useCallback(async () => {
    const supabase = createClient();
    const { data: projects } = await supabase
      .from("plan_projects")
      .select(
        "id, name, budget, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)",
      )
      .eq("budget_year_id", budgetYearId)
      .order("sort_order");

    setCurrentRows(
      (projects ?? []).map((p) => {
        const activities = p.plan_activities as unknown as { budget: number }[];
        return {
          id: p.id,
          name: p.name,
          adminGroupId: p.admin_group_id,
          adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
          budgetSourceId: p.budget_source_id,
          budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
          hasActivities: activities.length > 0,
          activitiesBudget: activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0),
          directBudget: Number(p.budget ?? 0),
        };
      }),
    );
  }, [budgetYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrentProjects();
  }, [loadCurrentProjects]);

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

  const filteredCurrentRows = useMemo(() => {
    if (!currentRows) return [];
    return currentRows.filter((r) => {
      if (adminGroupId !== ALL && r.adminGroupId !== adminGroupId) return false;
      if (budgetSourceId !== ALL && r.budgetSourceId !== budgetSourceId) return false;
      return true;
    });
  }, [currentRows, adminGroupId, budgetSourceId]);

  const totalCurrentBudget = filteredCurrentRows.reduce(
    (sum, r) => sum + (r.hasActivities ? r.activitiesBudget : r.directBudget),
    0,
  );

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectableRows = (sourceRows ?? []).filter((r) => !r.alreadyCopied);

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === selectableRows.length ? new Set() : new Set(selectableRows.map((r) => r.id)),
    );
  }

  async function handleCopy() {
    if (selectedIds.size === 0) return;
    setCopying(true);
    try {
      await copyProjectsToProposals(budgetYearId, Array.from(selectedIds));
      await toastSuccess(
        `คัดลอกเป็นข้อเสนอโครงการเรียบร้อยแล้ว ${selectedIds.size} รายการ — ไปดำเนินการต่อได้ที่เมนู "เสนอโครงการ"`,
      );
      await loadSourceProjects(sourceYearId);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <div className="card-title mb-2 text-base font-bold text-navy-800">
        คัดลอกโครงการจากปีงบประมาณเดิม {targetYear ? `→ เป็นข้อเสนอโครงการปี ${targetYear.year}` : ""}
      </div>
      <p className="mb-3 text-sm text-slate-500">
        เลือกโครงการจากปีงบประมาณเดิมที่ต้องการนำมาเริ่มต้นในปีนี้ ระบบจะสร้างเป็น &quot;ข้อเสนอโครงการ&quot;
        (สถานะรอเห็นชอบ) ให้ไปดำเนินการเห็นชอบ/อนุมัติต่อที่เมนู &quot;เสนอโครงการ&quot; — ยังไม่ใช่โครงการจริง
      </p>

      <div className="max-w-xs">
        <label className="label">ปีงบประมาณต้นทาง</label>
        <select value={sourceYearId} onChange={(e) => setSourceYearId(e.target.value)} className="input">
          {otherYears.length === 0 && <option value="">ไม่มีปีงบประมาณอื่น</option>}
          {otherYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.year}
            </option>
          ))}
        </select>
      </div>

      <div className="table-shell mt-3">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectableRows.length > 0 && selectedIds.size === selectableRows.length}
                  onChange={toggleSelectAll}
                  disabled={selectableRows.length === 0}
                />
              </th>
              <th>โครงการ</th>
              <th className="whitespace-nowrap">กลุ่มบริหาร</th>
              <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
              <th className="whitespace-nowrap text-right">งบประมาณ</th>
            </tr>
          </thead>
          <tbody>
            {(sourceRows ?? []).map((r) => (
              <tr key={r.id} className={r.alreadyCopied ? "opacity-50" : ""}>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    disabled={r.alreadyCopied}
                    onChange={() => toggleSelected(r.id)}
                  />
                </td>
                <td className="min-w-[10rem] max-w-[18rem]">
                  <span className="break-words font-medium text-slate-900">{r.name}</span>
                  {r.alreadyCopied && <span className="ml-2 text-xs text-slate-400">(คัดลอกแล้ว)</span>}
                </td>
                <td className="whitespace-nowrap">{r.adminGroup}</td>
                <td className="whitespace-nowrap">{r.budgetSource}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budget)}</td>
              </tr>
            ))}
            {sourceRows !== null && sourceRows.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  ไม่พบโครงการในปีงบประมาณต้นทางที่เลือก
                </td>
              </tr>
            )}
            {sourceRows === null && (
              <tr>
                <td colSpan={5} className="table-empty">
                  กำลังโหลด...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          disabled={selectedIds.size === 0 || copying}
          className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copying ? "กำลังคัดลอก..." : `คัดลอกที่เลือก (${selectedIds.size}) เป็นข้อเสนอโครงการ`}
        </button>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="card-title mb-2 text-base font-bold text-navy-800">
          โครงการที่มีอยู่แล้วในปีงบประมาณนี้ {targetYear ? `(${targetYear.year})` : ""}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          รายการนี้แสดงเฉพาะโครงการที่ผ่านการอนุมัติจริงแล้ว (จากเมนู &quot;เสนอโครงการ&quot;) — ดูอย่างเดียว
          แก้ไขได้ที่หน้า &quot;โครงการ&quot;
        </p>

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
              รวมที่ใช้ไปในโครงการ:{" "}
              <span className="font-semibold text-navy-800">{formatBaht(totalCurrentBudget)}</span>
            </span>
            <span className={groupAllocated - totalCurrentBudget < 0 ? "text-red-600" : "text-emerald-700"}>
              คงเหลือ: <span className="font-semibold">{formatBaht(groupAllocated - totalCurrentBudget)}</span>
            </span>
          </div>
        )}

        <div className="table-shell mt-3">
          <table className="table-base">
            <thead>
              <tr>
                <th>โครงการ</th>
                <th className="whitespace-nowrap">กลุ่มบริหาร</th>
                <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
                <th className="whitespace-nowrap text-right">งบประมาณ</th>
              </tr>
            </thead>
            <tbody>
              {filteredCurrentRows.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-[10rem] max-w-[18rem]">
                    <span className="break-words font-medium text-slate-900">{r.name}</span>
                  </td>
                  <td className="whitespace-nowrap">{r.adminGroup}</td>
                  <td className="whitespace-nowrap">{r.budgetSource}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {formatBaht(r.hasActivities ? r.activitiesBudget : r.directBudget)}
                  </td>
                </tr>
              ))}
              {filteredCurrentRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    ยังไม่มีโครงการที่อนุมัติแล้วในปีงบประมาณนี้
                  </td>
                </tr>
              )}
            </tbody>
            {filteredCurrentRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right font-semibold text-slate-600">
                    รวมงบประมาณ
                  </td>
                  <td className="whitespace-nowrap text-right font-bold text-navy-800 tabular-nums">
                    {formatBaht(totalCurrentBudget)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
