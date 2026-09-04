"use client";

// แท็บ "จัดโครงการ" — เตรียม "ร่างโครงการ" (plan_draft_projects) สำหรับปีงบประมาณใหม่ ยังไม่ใช่
// โครงการจริงและไม่ใช่ข้อเสนอโครงการ โดย:
// 1) คัดลอกรายการจากปีงบประมาณเดิมมาเป็นร่างตั้งต้น (แก้ไขได้ทุกอย่างหลังคัดลอก)
// 2) แก้ไข/เพิ่ม/ลบ ชื่อโครงการ/กลุ่มบริหาร/แหล่งงบประมาณ/งบประมาณ แบบคลิกแก้ไขได้เลย บันทึกอัตโนมัติ
// ครูจะไปเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู "เสนอโครงการ" ต่อไป (หรือพิมพ์ใหม่เองก็ได้)
// ส่วนล่างของแท็บแสดงรายการโครงการที่อนุมัติแล้วจริงของปีนี้แบบอ่านอย่างเดียว พร้อมแถบเทียบงบที่
// จัดสรรให้กลุ่มกับยอดที่ใช้ไปแล้ว

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { copyProjectsToDraft, createDraftProject, deleteDraftProject, updateDraftProject } from "./actions";

type Option = { id: string; name: string };
type BudgetYear = { id: string; year: number; is_open: boolean };

type SourceProjectRow = {
  id: string;
  name: string;
  adminGroupId: string | null;
  adminGroup: string;
  budgetSourceId: string | null;
  budgetSource: string;
  budget: number;
};

type DraftRow = {
  id: string;
  name: string;
  adminGroupId: string | null;
  budgetSourceId: string | null;
  budget: number;
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
  const [sourceAdminGroupId, setSourceAdminGroupId] = useState<string>(ALL);
  const [sourceBudgetSourceId, setSourceBudgetSourceId] = useState<string>(ALL);

  const [draftRows, setDraftRows] = useState<DraftRow[] | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [adminGroupId, setAdminGroupId] = useState<string>(ALL);
  const [budgetSourceId, setBudgetSourceId] = useState<string>(ALL);
  const [currentRows, setCurrentRows] = useState<CurrentProjectRow[] | null>(null);
  const [groupAllocated, setGroupAllocated] = useState<number | null>(null);

  useEffect(() => {
    if (sourceYearId || otherYears.length === 0 || !targetYear) return;
    const older = otherYears.filter((y) => y.year < targetYear.year).sort((a, b) => b.year - a.year);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSourceYearId((older[0] ?? otherYears[0]).id);
  }, [otherYears, targetYear, sourceYearId]);

  const loadSourceProjects = useCallback(async (srcYearId: string) => {
    if (!srcYearId) {
      setSourceRows([]);
      return;
    }
    const supabase = createClient();
    const { data: projects } = await supabase
      .from("plan_projects")
      .select(
        "id, name, budget, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)",
      )
      .eq("budget_year_id", srcYearId)
      .order("sort_order");

    setSourceRows(
      (projects ?? []).map((p) => {
        const activities = p.plan_activities as unknown as { budget: number }[];
        const budget =
          activities.length > 0 ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
        return {
          id: p.id,
          name: p.name,
          adminGroupId: p.admin_group_id,
          adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
          budgetSourceId: p.budget_source_id,
          budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
          budget,
        };
      }),
    );
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSourceProjects(sourceYearId);
  }, [sourceYearId, loadSourceProjects]);

  const loadDraftRows = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("plan_draft_projects")
      .select("id, name, admin_group_id, budget_source_id, budget")
      .eq("budget_year_id", budgetYearId)
      .order("sort_order")
      .order("created_at");
    setDraftRows(
      (data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        adminGroupId: d.admin_group_id,
        budgetSourceId: d.budget_source_id,
        budget: Number(d.budget ?? 0),
      })),
    );
  }, [budgetYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDraftRows();
  }, [loadDraftRows]);

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

  const filteredSourceRows = useMemo(() => {
    if (!sourceRows) return [];
    return sourceRows.filter((r) => {
      if (sourceAdminGroupId !== ALL && r.adminGroupId !== sourceAdminGroupId) return false;
      if (sourceBudgetSourceId !== ALL && r.budgetSourceId !== sourceBudgetSourceId) return false;
      return true;
    });
  }, [sourceRows, sourceAdminGroupId, sourceBudgetSourceId]);

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

  function toggleSelectAll() {
    const rows = filteredSourceRows;
    setSelectedIds((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  async function handleCopy() {
    if (selectedIds.size === 0) return;
    setCopying(true);
    try {
      await copyProjectsToDraft(budgetYearId, Array.from(selectedIds));
      await toastSuccess(`คัดลอกเป็นร่างโครงการเรียบร้อยแล้ว ${selectedIds.size} รายการ`);
      setSelectedIds(new Set());
      await loadDraftRows();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  function patchDraft(id: string, patch: Partial<DraftRow>) {
    setDraftRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
  }

  async function handleNameBlur(row: DraftRow) {
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
      await updateDraftProject(row.id, { name: draft.trim() });
      patchDraft(row.id, { name: draft.trim() });
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

  async function handleGroupChange(row: DraftRow, groupId: string) {
    setSavingId(row.id);
    try {
      await updateDraftProject(row.id, { admin_group_id: groupId || null });
      patchDraft(row.id, { adminGroupId: groupId || null });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSourceChange(row: DraftRow, sourceId: string) {
    setSavingId(row.id);
    try {
      await updateDraftProject(row.id, { budget_source_id: sourceId || null });
      patchDraft(row.id, { budgetSourceId: sourceId || null });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleBudgetBlur(row: DraftRow) {
    const raw = budgetDrafts[row.id];
    if (raw === undefined) return;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (value === row.budget) {
      setBudgetDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    setSavingId(row.id);
    try {
      await updateDraftProject(row.id, { budget: value });
      patchDraft(row.id, { budget: value });
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

  async function handleAddDraft() {
    setAdding(true);
    try {
      await createDraftProject(budgetYearId);
      await loadDraftRows();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteDraft(row: DraftRow) {
    const ok = await confirmDelete({ title: `ลบร่างโครงการ "${row.name}"?`, text: "ไม่สามารถกู้คืนได้" });
    if (!ok) return;
    setSavingId(row.id);
    try {
      await deleteDraftProject(row.id);
      setDraftRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      await toastSuccess("ลบร่างโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="card-title mb-2 text-base font-bold text-navy-800">คัดลอกโครงการจากปีงบประมาณเดิม</div>
      <p className="mb-3 text-sm text-slate-500">เลือกโครงการจากปีงบประมาณเดิมเพื่อนำมาเป็นร่างตั้งต้นในปีนี้ (แก้ไขได้ทุกอย่างในตารางด้านล่างหลังคัดลอก)</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
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
        <div>
          <label className="label">กลุ่มบริหารงาน</label>
          <select value={sourceAdminGroupId} onChange={(e) => setSourceAdminGroupId(e.target.value)} className="input">
            <option value={ALL}>ทั้งหมด</option>
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">แหล่งงบประมาณ</label>
          <select value={sourceBudgetSourceId} onChange={(e) => setSourceBudgetSourceId(e.target.value)} className="input">
            <option value={ALL}>ทั้งหมด</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-shell mt-3">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={filteredSourceRows.length > 0 && selectedIds.size === filteredSourceRows.length}
                  onChange={toggleSelectAll}
                  disabled={filteredSourceRows.length === 0}
                />
              </th>
              <th>โครงการ</th>
              <th className="whitespace-nowrap">กลุ่มบริหาร</th>
              <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
              <th className="whitespace-nowrap text-right">งบประมาณ</th>
            </tr>
          </thead>
          <tbody>
            {filteredSourceRows.map((r) => (
              <tr key={r.id}>
                <td className="text-center">
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                </td>
                <td className="min-w-[10rem] max-w-[18rem]">
                  <span className="break-words font-medium text-slate-900">{r.name}</span>
                </td>
                <td className="whitespace-nowrap">{r.adminGroup}</td>
                <td className="whitespace-nowrap">{r.budgetSource}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budget)}</td>
              </tr>
            ))}
            {sourceRows !== null && filteredSourceRows.length === 0 && (
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
          {copying ? "กำลังคัดลอก..." : `คัดลอกที่เลือก (${selectedIds.size}) เป็นร่างโครงการ`}
        </button>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="card-title mb-2 text-base font-bold text-navy-800">
          ร่างโครงการปีงบประมาณนี้ {targetYear ? `(${targetYear.year})` : ""}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          แก้ไขได้ทุกช่อง บันทึกอัตโนมัติ — ครูจะเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู
          &quot;เสนอโครงการ&quot; (หรือพิมพ์ชื่อใหม่เองก็ได้)
        </p>

        <div className="flex justify-end">
          <button type="button" onClick={handleAddDraft} disabled={adding} className="btn-primary btn-sm">
            {adding ? "กำลังเพิ่ม..." : "+ เพิ่มร่างโครงการ"}
          </button>
        </div>

        <div className="table-shell mt-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>โครงการ</th>
                <th className="whitespace-nowrap">กลุ่มบริหาร</th>
                <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
                <th className="whitespace-nowrap text-right">งบประมาณ</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {(draftRows ?? []).map((r) => {
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
                        value={r.adminGroupId ?? ""}
                        onChange={(e) => handleGroupChange(r, e.target.value)}
                        disabled={isSaving}
                        className="input disabled:bg-slate-100"
                      >
                        <option value="">ไม่ระบุ</option>
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
                      <input
                        type="number"
                        step="0.01"
                        value={budgetDrafts[r.id] ?? r.budget}
                        onChange={(e) => setBudgetDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        onBlur={() => handleBudgetBlur(r)}
                        disabled={isSaving}
                        className="input w-36 text-right disabled:bg-slate-100"
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDraft(r)}
                        disabled={isSaving}
                        className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {draftRows !== null && draftRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    ยังไม่มีร่างโครงการ — คัดลอกจากปีเดิมด้านบน หรือกด &quot;+ เพิ่มร่างโครงการ&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
