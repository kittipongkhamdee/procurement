"use client";

// แท็บ "จัดโครงการ" — รายละเอียดจัดสรรงบประมาณแยกตามโครงการ/กิจกรรม แก้ไขได้ทุกคอลัมน์แบบอินไลน์
// (คลิกแล้วพิมพ์/เลือกได้ทันที บันทึกอัตโนมัติเมื่อออกจากช่อง) เพิ่ม/ลบโครงการได้ (ลบมีอันยืนยันก่อน)
// เพิ่มแถบเทียบ "งบที่จัดสรรให้กลุ่มนี้" (จากแท็บจัดสรรเงิน) กับ "รวมที่ใช้ไปในโครงการ"

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { deleteProject, updateProjectBudget } from "../projects/actions";
import { createSimpleProject, updateProjectFields } from "./actions";

type Option = { id: string; name: string };
type ProjectRow = {
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
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const loadProjects = useCallback(async (yearId: string) => {
    const supabase = createClient();
    const { data: projects } = await supabase
      .from("plan_projects")
      .select(
        "id, name, budget, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)",
      )
      .eq("budget_year_id", yearId)
      .order("sort_order");

    setRows(
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
      if (adminGroupId !== ALL && r.adminGroupId !== adminGroupId) return false;
      if (budgetSourceId !== ALL && r.budgetSourceId !== budgetSourceId) return false;
      return true;
    });
  }, [rows, adminGroupId, budgetSourceId]);

  const totalAllocated = filteredRows.reduce(
    (sum, r) => sum + (r.hasActivities ? r.activitiesBudget : r.directBudget),
    0,
  );

  function patchRow(id: string, patch: Partial<ProjectRow>) {
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
  }

  async function handleNameBlur(row: ProjectRow) {
    const draft = nameDrafts[row.id];
    if (draft === undefined || draft.trim() === "" || draft === row.name) {
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    setSavingId(row.id);
    try {
      await updateProjectFields(row.id, { name: draft.trim() });
      patchRow(row.id, { name: draft.trim() });
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleGroupChange(row: ProjectRow, groupId: string) {
    setSavingId(row.id);
    try {
      await updateProjectFields(row.id, { admin_group_id: groupId });
      patchRow(row.id, { adminGroupId: groupId, adminGroup: adminGroups.find((g) => g.id === groupId)?.name ?? "-" });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSourceChange(row: ProjectRow, sourceId: string) {
    setSavingId(row.id);
    try {
      await updateProjectFields(row.id, { budget_source_id: sourceId || null });
      patchRow(row.id, {
        budgetSourceId: sourceId || null,
        budgetSource: budgetSources.find((s) => s.id === sourceId)?.name ?? "-",
      });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleBudgetBlur(row: ProjectRow) {
    const raw = budgetDrafts[row.id];
    if (raw === undefined) return;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (value === row.directBudget) {
      setBudgetDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    setSavingId(row.id);
    try {
      await updateProjectBudget(row.id, value);
      patchRow(row.id, { directBudget: value });
      setBudgetDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddProject() {
    if (adminGroups.length === 0) {
      await toastError("ยังไม่มีกลุ่มบริหารงาน กรุณาเพิ่มก่อน");
      return;
    }
    const groupId = adminGroupId !== ALL ? adminGroupId : adminGroups[0].id;
    const sourceId = budgetSourceId !== ALL ? budgetSourceId : null;
    setAdding(true);
    try {
      await createSimpleProject(budgetYearId, groupId, sourceId);
      await toastSuccess("เพิ่มโครงการเรียบร้อยแล้ว — แก้ไขชื่อโครงการได้เลย");
      await loadProjects(budgetYearId);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(row: ProjectRow) {
    const ok = await confirmDelete({
      title: `ลบโครงการ "${row.name}"?`,
      text: row.hasActivities ? "กิจกรรมย่อยทั้งหมดในโครงการนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนได้" : "ไม่สามารถกู้คืนได้",
    });
    if (!ok) return;
    setSavingId(row.id);
    try {
      await deleteProject(row.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      await toastSuccess("ลบโครงการเรียบร้อยแล้ว");
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
            คงเหลือ: <span className="font-semibold">{formatBaht(groupAllocated - totalAllocated)}</span>
          </span>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={handleAddProject} disabled={adding} className="btn-primary btn-sm">
          {adding ? "กำลังเพิ่ม..." : "+ เพิ่มโครงการ"}
        </button>
      </div>

      <div className="table-shell mt-2">
        <table className="table-base">
          <thead>
            <tr>
              <th>โครงการ</th>
              <th className="whitespace-nowrap">กลุ่มบริหาร</th>
              <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
              <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const isSaving = savingId === r.id;
              return (
                <tr key={r.id}>
                  <td className="min-w-[10rem] max-w-[18rem]">
                    <input
                      type="text"
                      value={nameDrafts[r.id] ?? r.name}
                      onChange={(e) => setNameDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      onBlur={() => handleNameBlur(r)}
                      disabled={isSaving}
                      className="input w-full font-medium text-slate-900 disabled:bg-slate-100"
                    />
                  </td>
                  <td className="whitespace-nowrap">
                    <select
                      value={r.adminGroupId}
                      onChange={(e) => handleGroupChange(r, e.target.value)}
                      disabled={isSaving}
                      className="input disabled:bg-slate-100"
                    >
                      {adminGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap">
                    <select
                      value={r.budgetSourceId ?? ""}
                      onChange={(e) => handleSourceChange(r, e.target.value)}
                      disabled={isSaving}
                      className="input disabled:bg-slate-100"
                    >
                      <option value="">ไม่ระบุ</option>
                      {budgetSources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {r.hasActivities ? (
                      <a
                        href="/projects"
                        className="text-sm tabular-nums text-slate-500 hover:underline"
                        title="รวมจากกิจกรรมย่อย — แก้ไขได้ที่หน้าโครงการ"
                      >
                        {formatBaht(r.activitiesBudget)}
                      </a>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={budgetDrafts[r.id] ?? r.directBudget}
                        onChange={(e) => setBudgetDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        onBlur={() => handleBudgetBlur(r)}
                        disabled={isSaving}
                        className="input w-36 text-right disabled:bg-slate-100"
                      />
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      disabled={isSaving}
                      className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
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
