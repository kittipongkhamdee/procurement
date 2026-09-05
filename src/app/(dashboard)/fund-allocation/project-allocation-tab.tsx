"use client";

// แท็บ "จัดโครงการ" — เตรียม "ร่างโครงการ" (plan_draft_projects) สำหรับปีงบประมาณใหม่ ยังไม่ใช่
// โครงการจริงและไม่ใช่ข้อเสนอโครงการ โดย:
// 1) คัดลอกรายการจากปีงบประมาณเดิมมาเป็นร่างตั้งต้น (แก้ไขได้ทุกอย่างหลังคัดลอก)
// 2) แก้ไข/เพิ่ม/ลบ ชื่อโครงการ/กลุ่มบริหาร/แหล่งงบประมาณ/งบประมาณ ต่อรายการผ่านปุ่มแก้ไข/บันทึก
// ครูจะไปเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู "เสนอโครงการ" ต่อไป (หรือพิมพ์ใหม่เองก็ได้)
// โครงการที่ผ่านการอนุมัติจริงแล้วดูได้ที่เมนู "เสนอโครงการ" อยู่แล้ว จึงไม่ต้องแสดงซ้ำในแท็บนี้

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import {
  copyProjectsToDraft,
  createDraftProject,
  deleteDraftProject,
  setDraftEditOpen,
  updateDraftProject,
} from "./actions";
import { computeAllItemTotals, rateKey, type GradeKey, type ItemKey } from "./revenue-calc";

// ชื่อแหล่งงบประมาณ (plan_budget_sources.name) ที่มีที่มาจากเงินอุดหนุนรายหัว (คำนวณได้จากแท็บ
// "รายรับ") -> รายการรายรับที่นับรวมเป็น "งบประมาณที่จัดสรร" ของแหล่งนั้น ส่วน "เงินรายได้สถานศึกษา"
// ใช้ยอดจาก plan_school_income แทน (ดู SCHOOL_INCOME_SOURCE_NAME) แหล่งงบอื่นนอกเหนือจากนี้ยังไม่มี
// สูตรคำนวณอัตโนมัติ ถือว่ายังไม่จัดสรร (0)
const BUDGET_SOURCE_REVENUE_ITEMS: Record<string, ItemKey[]> = {
  ค่าจัดการเรียนการสอน: ["teaching", "topup"],
  ค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน: ["student_activity"],
};

// แหล่งงบประมาณที่ไม่ได้มาจากเงินอุดหนุนรายหัว — ใช้ยอด "รายได้สถานศึกษา" ที่กรอกไว้ที่แท็บ
// "นักเรียนและรายหัว" (plan_school_income) แทน
const SCHOOL_INCOME_SOURCE_NAME = "เงินรายได้สถานศึกษา";

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

type DraftEditState = {
  name: string;
  adminGroupId: string;
  budgetSourceId: string;
  budget: string;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const ALL = "__all__";

const SUB_TABS = [
  { key: "copy", label: "คัดลอกโครงการเดิม" },
  { key: "draft", label: "ร่างโครงการปีงบประมาณนี้" },
] as const;
type SubTabKey = (typeof SUB_TABS)[number]["key"];

export function ProjectAllocationTab({
  budgetYearId,
  budgetYears,
  adminGroups,
  budgetSources,
  isAdmin,
}: {
  budgetYearId: string;
  budgetYears: BudgetYear[];
  adminGroups: Option[];
  budgetSources: Option[];
  isAdmin: boolean;
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
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftEditState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [draftSearch, setDraftSearch] = useState("");
  const [draftAdminGroupId, setDraftAdminGroupId] = useState<string>(ALL);
  const [draftBudgetSourceId, setDraftBudgetSourceId] = useState<string>(ALL);

  const [groupAllocations, setGroupAllocations] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [schoolIncome, setSchoolIncome] = useState(0);
  const [draftOpenEdit, setDraftOpenEdit] = useState(false);
  const [togglingOpenEdit, setTogglingOpenEdit] = useState(false);
  const canEditDraft = isAdmin || draftOpenEdit;

  const [subTab, setSubTab] = useState<SubTabKey>("copy");

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

  const loadSummaryData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: allocData }, { data: countsData }, { data: ratesData }, { data: incomeData }, { data: yearData }] =
      await Promise.all([
        supabase.from("plan_group_allocations").select("admin_group_id, allocated_amount").eq("budget_year_id", budgetYearId),
        supabase.from("plan_student_counts").select("grade_key, student_count").eq("budget_year_id", budgetYearId),
        supabase
          .from("plan_revenue_rates")
          .select("item_key, grade_key, rate_per_student")
          .eq("budget_year_id", budgetYearId),
        supabase.from("plan_school_income").select("amount").eq("budget_year_id", budgetYearId).maybeSingle(),
        supabase.from("plan_budget_years").select("draft_projects_open_edit").eq("id", budgetYearId).maybeSingle(),
      ]);

    const nextAllocations: Record<string, number> = {};
    for (const row of allocData ?? []) nextAllocations[row.admin_group_id] = Number(row.allocated_amount);
    setGroupAllocations(nextAllocations);

    const nextCounts: Partial<Record<GradeKey, number>> = {};
    for (const row of countsData ?? []) nextCounts[row.grade_key as GradeKey] = Number(row.student_count);
    setCounts(nextCounts);

    const nextRates: Record<string, number> = {};
    for (const row of ratesData ?? [])
      nextRates[rateKey(row.item_key as ItemKey, row.grade_key as GradeKey)] = Number(row.rate_per_student);
    setRates(nextRates);

    setSchoolIncome(Number(incomeData?.amount ?? 0));
    setDraftOpenEdit(yearData?.draft_projects_open_edit ?? false);
  }, [budgetYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSummaryData();
  }, [loadSummaryData]);

  const itemTotalByKey = useMemo(() => {
    const totals = computeAllItemTotals(counts, rates);
    return Object.fromEntries(totals.map((i) => [i.key, i.total])) as Record<ItemKey, number>;
  }, [counts, rates]);

  const sourceSummaryRows = useMemo(() => {
    const rows = draftRows ?? [];
    return budgetSources.map((s) => {
      const items = BUDGET_SOURCE_REVENUE_ITEMS[s.name];
      const allocated =
        s.name === SCHOOL_INCOME_SOURCE_NAME
          ? schoolIncome
          : items
            ? items.reduce((sum, k) => sum + (itemTotalByKey[k] ?? 0), 0)
            : 0;
      const draftTotal = rows.filter((r) => r.budgetSourceId === s.id).reduce((sum, r) => sum + r.budget, 0);
      return { id: s.id, label: s.name, allocated, draftTotal, diff: allocated - draftTotal };
    });
  }, [budgetSources, draftRows, itemTotalByKey, schoolIncome]);

  const groupSummaryRows = useMemo(() => {
    const rows = draftRows ?? [];
    return adminGroups.map((g) => {
      const allocated = groupAllocations[g.id] ?? 0;
      const draftTotal = rows.filter((r) => r.adminGroupId === g.id).reduce((sum, r) => sum + r.budget, 0);
      return { id: g.id, label: g.name, allocated, draftTotal, diff: allocated - draftTotal };
    });
  }, [adminGroups, draftRows, groupAllocations]);

  const filteredSourceRows = useMemo(() => {
    if (!sourceRows) return [];
    return sourceRows.filter((r) => {
      if (sourceAdminGroupId !== ALL && r.adminGroupId !== sourceAdminGroupId) return false;
      if (sourceBudgetSourceId !== ALL && r.budgetSourceId !== sourceBudgetSourceId) return false;
      return true;
    });
  }, [sourceRows, sourceAdminGroupId, sourceBudgetSourceId]);

  const filteredDraftRows = useMemo(() => {
    if (!draftRows) return [];
    const search = draftSearch.trim().toLowerCase();
    return draftRows.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search)) return false;
      if (draftAdminGroupId !== ALL && r.adminGroupId !== draftAdminGroupId) return false;
      if (draftBudgetSourceId !== ALL && r.budgetSourceId !== draftBudgetSourceId) return false;
      return true;
    });
  }, [draftRows, draftSearch, draftAdminGroupId, draftBudgetSourceId]);

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

  function startEditDraft(row: DraftRow) {
    setEditingRowId(row.id);
    setEditDraft({
      name: row.name,
      adminGroupId: row.adminGroupId ?? "",
      budgetSourceId: row.budgetSourceId ?? "",
      budget: String(row.budget),
    });
  }

  function cancelEditDraft() {
    setEditingRowId(null);
    setEditDraft(null);
  }

  async function saveEditDraft(row: DraftRow) {
    if (!editDraft) return;
    const name = editDraft.name.trim();
    if (!name) {
      await toastError("กรุณากรอกชื่อโครงการ");
      return;
    }
    const budget = Number(editDraft.budget);
    if (Number.isNaN(budget) || budget < 0) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setSavingId(row.id);
    try {
      const adminGroupId = editDraft.adminGroupId || null;
      const budgetSourceId = editDraft.budgetSourceId || null;
      await updateDraftProject(row.id, budgetYearId, {
        name,
        admin_group_id: adminGroupId,
        budget_source_id: budgetSourceId,
        budget,
      });
      patchDraft(row.id, { name, adminGroupId, budgetSourceId, budget });
      setEditingRowId(null);
      setEditDraft(null);
      await toastSuccess("บันทึกร่างโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddDraft() {
    setAdding(true);
    try {
      const created = await createDraftProject(budgetYearId);
      if (created) {
        const row: DraftRow = {
          id: created.id,
          name: created.name,
          adminGroupId: created.admin_group_id,
          budgetSourceId: created.budget_source_id,
          budget: Number(created.budget ?? 0),
        };
        setDraftRows((prev) => [row, ...(prev ?? [])]);
        setDraftSearch("");
        setDraftAdminGroupId(ALL);
        setDraftBudgetSourceId(ALL);
        setEditingRowId(row.id);
        setEditDraft({
          name: row.name,
          adminGroupId: row.adminGroupId ?? "",
          budgetSourceId: row.budgetSourceId ?? "",
          budget: String(row.budget),
        });
      }
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
      if (editingRowId === row.id) {
        setEditingRowId(null);
        setEditDraft(null);
      }
      await toastSuccess("ลบร่างโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleOpenEdit() {
    const next = !draftOpenEdit;
    setTogglingOpenEdit(true);
    try {
      await setDraftEditOpen(budgetYearId, next);
      setDraftOpenEdit(next);
      await toastSuccess(next ? "เปิดการแก้ไขให้ทุกคนแล้ว" : "ปิดการแก้ไขให้ทุกคนแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setTogglingOpenEdit(false);
    }
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              subTab === t.key
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "copy" && (
        <div className="mt-4">
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
                  {isAdmin && (
                    <th className="w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredSourceRows.length > 0 && selectedIds.size === filteredSourceRows.length}
                        onChange={toggleSelectAll}
                        disabled={filteredSourceRows.length === 0}
                      />
                    </th>
                  )}
                  <th>โครงการ</th>
                  <th className="whitespace-nowrap">กลุ่มบริหาร</th>
                  <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
                  <th className="whitespace-nowrap text-right">งบประมาณ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSourceRows.map((r) => (
                  <tr key={r.id}>
                    {isAdmin && (
                      <td className="text-center">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                      </td>
                    )}
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
                    <td colSpan={isAdmin ? 5 : 4} className="table-empty">
                      ไม่พบโครงการในปีงบประมาณต้นทางที่เลือก
                    </td>
                  </tr>
                )}
                {sourceRows === null && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} className="table-empty">
                      กำลังโหลด...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isAdmin && (
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
          )}
        </div>
      )}

      {subTab === "draft" && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="card-title text-base font-bold text-navy-800">
              ร่างโครงการปีงบประมาณนี้ {targetYear ? `(${targetYear.year})` : ""}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={handleToggleOpenEdit}
                disabled={togglingOpenEdit}
                className={`btn-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  draftOpenEdit ? "btn-danger" : "btn-primary"
                }`}
              >
                {togglingOpenEdit
                  ? "กำลังบันทึก..."
                  : draftOpenEdit
                    ? "ปิดการแก้ไขให้ทุกคน"
                    : "เปิดการแก้ไขให้ทุกคน"}
              </button>
            )}
          </div>
          {draftOpenEdit && (
            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              เปิดให้ครูทุกคนเพิ่ม/แก้ไขร่างโครงการได้อยู่ (การลบยังจำกัดเฉพาะผู้ดูแลระบบ)
            </p>
          )}
          <p className="mb-3 text-sm text-slate-500">
            {canEditDraft
              ? "กด \"แก้ไข\" ต่อรายการเพื่อแก้ไขแล้วกด \"บันทึก\""
              : "ดูรายการได้อย่างเดียว"}{" "}
            — ครูจะเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู &quot;เสนอโครงการ&quot;
            (หรือพิมพ์ชื่อใหม่เองก็ได้)
          </p>

          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="card-title mb-2 text-sm font-bold text-navy-800">เทียบตามแหล่งงบประมาณ</div>
              <div className="table-shell">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>แหล่งเงิน</th>
                      <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
                      <th className="whitespace-nowrap text-right">งบร่างโครงการ</th>
                      <th className="whitespace-nowrap text-right">ผลต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceSummaryRows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium text-slate-900">{r.label}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.allocated)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.draftTotal)}</td>
                        <td
                          className={`whitespace-nowrap text-right tabular-nums font-semibold ${
                            Math.abs(r.diff) < 0.005 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatBaht(r.diff)}
                        </td>
                      </tr>
                    ))}
                    {sourceSummaryRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="table-empty">
                          ยังไม่มีแหล่งงบประมาณ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="card-title mb-2 text-sm font-bold text-navy-800">เทียบตามกลุ่มบริหารงาน</div>
              <div className="table-shell">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>กลุ่มบริหารงาน</th>
                      <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
                      <th className="whitespace-nowrap text-right">งบร่างโครงการ</th>
                      <th className="whitespace-nowrap text-right">ผลต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummaryRows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium text-slate-900">{r.label}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.allocated)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.draftTotal)}</td>
                        <td
                          className={`whitespace-nowrap text-right tabular-nums font-semibold ${
                            Math.abs(r.diff) < 0.005 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatBaht(r.diff)}
                        </td>
                      </tr>
                    ))}
                    {groupSummaryRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="table-empty">
                          ยังไม่มีกลุ่มบริหารงาน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">ค้นหาชื่อโครงการ</label>
                  <input
                    type="text"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อโครงการ..."
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">กลุ่มบริหารงาน</label>
                  <select
                    value={draftAdminGroupId}
                    onChange={(e) => setDraftAdminGroupId(e.target.value)}
                    className="input"
                  >
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
                  <select
                    value={draftBudgetSourceId}
                    onChange={(e) => setDraftBudgetSourceId(e.target.value)}
                    className="input"
                  >
                    <option value={ALL}>ทั้งหมด</option>
                    {budgetSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {canEditDraft && (
                <button
                  type="button"
                  onClick={handleAddDraft}
                  disabled={adding || editingRowId !== null}
                  className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {adding ? "กำลังเพิ่ม..." : "+ เพิ่มร่างโครงการ"}
                </button>
              )}
            </div>

            <div className="table-shell mt-2">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>โครงการ</th>
                    <th className="whitespace-nowrap">กลุ่มบริหาร</th>
                    <th className="whitespace-nowrap">แหล่งงบประมาณ</th>
                    <th className="whitespace-nowrap text-right">งบประมาณ</th>
                    <th className="whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDraftRows.map((r, i) => {
                    const isSaving = savingId === r.id;
                    const isEditing = editingRowId === r.id;
                    return (
                      <tr key={r.id}>
                        <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                        <td className="min-w-[10rem] max-w-[18rem]">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft?.name ?? ""}
                              onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              disabled={isSaving}
                              className="input w-full font-medium text-slate-900 disabled:bg-slate-100"
                            />
                          ) : (
                            <span className="break-words font-medium text-slate-900">{r.name}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={editDraft?.adminGroupId ?? ""}
                              onChange={(e) =>
                                setEditDraft((prev) => (prev ? { ...prev, adminGroupId: e.target.value } : prev))
                              }
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
                          ) : (
                            adminGroups.find((g) => g.id === r.adminGroupId)?.name ?? "ไม่ระบุ"
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={editDraft?.budgetSourceId ?? ""}
                              onChange={(e) =>
                                setEditDraft((prev) => (prev ? { ...prev, budgetSourceId: e.target.value } : prev))
                              }
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
                          ) : (
                            budgetSources.find((s) => s.id === r.budgetSourceId)?.name ?? "ไม่ระบุ"
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editDraft?.budget ?? ""}
                              onChange={(e) =>
                                setEditDraft((prev) => (prev ? { ...prev, budget: e.target.value } : prev))
                              }
                              disabled={isSaving}
                              className="input w-36 text-right disabled:bg-slate-100"
                            />
                          ) : (
                            <span className="tabular-nums">{formatBaht(r.budget)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEditDraft}
                                disabled={isSaving}
                                className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditDraft(r)}
                                disabled={isSaving}
                                className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              {canEditDraft && (
                                <button
                                  type="button"
                                  onClick={() => startEditDraft(r)}
                                  disabled={editingRowId !== null}
                                  className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  แก้ไข
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDraft(r)}
                                  disabled={isSaving || editingRowId !== null}
                                  className="btn-danger btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  ลบ
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {draftRows !== null && filteredDraftRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        {draftRows.length === 0
                          ? "ยังไม่มีร่างโครงการ — คัดลอกจากปีเดิมด้านบน หรือกด \"+ เพิ่มร่างโครงการ\""
                          : "ไม่พบร่างโครงการตามตัวกรองที่เลือก"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      )}
    </div>
  );
}
