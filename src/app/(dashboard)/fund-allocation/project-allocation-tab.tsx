"use client";

// แท็บ "คัดลอกโครงการเดิม" / "ร่างโครงการปีงบประมาณนี้" (แท็บหลักของหน้า ใช้คอมโพเนนต์นี้ร่วมกัน ส่ง section มา) — เตรียม "ร่างโครงการ" (plan_draft_projects) สำหรับปีงบประมาณใหม่ ยังไม่ใช่
// โครงการจริงและไม่ใช่ข้อเสนอโครงการ โดย:
// 1) คัดลอกรายการจากปีงบประมาณเดิมมาเป็นร่างตั้งต้น (แก้ไขได้ทุกอย่างหลังคัดลอก)
// 2) แก้ไข/เพิ่ม/ลบ ชื่อโครงการ/กลุ่มบริหาร/แหล่งงบประมาณ/งบประมาณ ต่อรายการผ่านปุ่มแก้ไข/บันทึก
// ครูจะไปเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู "เสนอโครงการ" ต่อไป (หรือพิมพ์ใหม่เองก็ได้)
// โครงการที่ผ่านการอนุมัติจริงแล้วดูได้ที่เมนู "เสนอโครงการ" อยู่แล้ว จึงไม่ต้องแสดงซ้ำในแท็บนี้

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { copyProjectsToDraft } from "./actions";
import { DraftCompare } from "./draft-compare";
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
  editingByName: string | null;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const ALL = "__all__";

type SubTabKey = "copy" | "draft";

// ล็อกแก้ไขหมดอายุหลังเวลานี้ — ต้องตรงกับ EDIT_LOCK_MINUTES ใน actions.ts
const EDIT_LOCK_MINUTES = 10;

export function ProjectAllocationTab({
  section,
  budgetYearId,
  budgetYears,
  adminGroups,
  budgetSources,
  isAdmin,
}: {
  /** ส่วนที่แสดง: คัดลอกโครงการเดิม หรือ ร่างโครงการปีงบประมาณนี้ (เลือกจากแท็บหลักของหน้า) */
  section: SubTabKey;
  budgetYearId: string;
  budgetYears: BudgetYear[];
  adminGroups: Option[];
  budgetSources: Option[];
  isAdmin: boolean;
}) {
  const { user } = useAuth();
  const myUserId = user?.userId ?? null;
  const targetYear = budgetYears.find((y) => y.id === budgetYearId) ?? null;
  const otherYears = budgetYears.filter((y) => y.id !== budgetYearId);

  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [sourceRows, setSourceRows] = useState<SourceProjectRow[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copying, setCopying] = useState(false);
  const [sourceAdminGroupId, setSourceAdminGroupId] = useState<string>(ALL);
  const [sourceBudgetSourceId, setSourceBudgetSourceId] = useState<string>(ALL);

  const [draftRows, setDraftRows] = useState<DraftRow[] | null>(null);


  const [groupAllocations, setGroupAllocations] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [schoolIncome, setSchoolIncome] = useState(0);
  // แก้ไข/เพิ่มร่างโครงการได้เฉพาะผู้ดูแลระบบ (ผู้ดูแลระบบเป็นคนกำหนดร่างโครงการเอง)
  const canEditDraft = isAdmin;

  const subTab = section;

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
      .select("id, name, admin_group_id, budget_source_id, budget, editing_by, editing_by_name, editing_at")
      .eq("budget_year_id", budgetYearId)
      .order("sort_order")
      .order("created_at")
      // แถวที่คัดลอกมาพร้อมกันมี sort_order และ created_at เท่ากันหมด — ต้องมีตัวตัดสินสุดท้ายที่คงที่ ไม่งั้น
      // Postgres คืนลำดับของแถวที่เท่ากันตามตำแหน่งจริงในตาราง ซึ่งเปลี่ยนทุกครั้งที่แถวถูก UPDATE (กดแก้ไข/บันทึก)
      .order("id");
    setDraftRows(
      (data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        adminGroupId: d.admin_group_id,
        budgetSourceId: d.budget_source_id,
        budget: Number(d.budget ?? 0),
        // แสดง "กำลังแก้ไขโดย…" เฉพาะล็อกของคนอื่นที่ยังไม่หมดอายุ — ล็อกของตัวเองที่ค้างไว้ (ปิดแท็บ/เปลี่ยนหน้า
        // ระหว่างแก้ไข) และล็อกที่หมดอายุแล้วถือว่าว่าง กดแก้ไขต่อได้ (ฝั่ง server ก็ยอมจองซ้ำในกรณีเหล่านี้)
        editingByName:
          d.editing_by_name &&
          d.editing_by !== myUserId &&
          d.editing_at &&
          Date.now() - new Date(d.editing_at).getTime() < EDIT_LOCK_MINUTES * 60 * 1000
            ? d.editing_by_name
            : null,
      })),
    );
  }, [budgetYearId, myUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDraftRows();
  }, [loadDraftRows]);

  // โพลข้อมูลร่างโครงการเป็นระยะขณะอยู่แท็บนี้ เพื่อให้เห็นว่าใครกำลังแก้ไขแถวไหนอยู่โดยไม่ต้องรีเฟรชเอง
  useEffect(() => {
    if (subTab !== "draft") return;
    const interval = setInterval(() => {
      loadDraftRows();
    }, 8000);
    return () => clearInterval(interval);
  }, [subTab, loadDraftRows]);

  const loadSummaryData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: allocData }, { data: countsData }, { data: ratesData }, { data: incomeData }] =
      await Promise.all([
        supabase.from("plan_group_allocations").select("admin_group_id, allocated_amount").eq("budget_year_id", budgetYearId),
        supabase.from("plan_student_counts").select("grade_key, student_count").eq("budget_year_id", budgetYearId),
        supabase
          .from("plan_revenue_rates")
          .select("item_key, grade_key, rate_per_student")
          .eq("budget_year_id", budgetYearId),
        supabase.from("plan_school_income").select("amount").eq("budget_year_id", budgetYearId).maybeSingle(),
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
      const result = await copyProjectsToDraft(budgetYearId, Array.from(selectedIds));
      const skippedText = result.skipped > 0 ? ` (ข้าม ${result.skipped} รายการที่มีอยู่ในร่างแล้ว)` : "";
      await toastSuccess(`คัดลอกเป็นร่างโครงการเรียบร้อยแล้ว ${result.copied} รายการ${skippedText}`);
      setSelectedIds(new Set());
      await loadDraftRows();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
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
            {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredSourceRows.map((r, i) => (
                <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      aria-label={`เลือก ${r.name}`}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-slate-400">#{i + 1}</span>{" "}
                    <span className="break-words font-medium text-slate-900">{r.name}</span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.adminGroup} · {r.budgetSource}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-slate-700">{formatBaht(r.budget)} บาท</p>
                  </div>
                </div>
              ))}
              {sourceRows !== null && filteredSourceRows.length === 0 && (
                <p className="table-empty">ไม่พบโครงการในปีงบประมาณต้นทางที่เลือก</p>
              )}
              {sourceRows === null && <p className="table-empty">กำลังโหลด...</p>}
            </div>

            {/* จอกว้าง md ขึ้นไป: ตาราง */}
            <table className="hidden table-base min-w-0 md:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th className="w-14 text-center">ลำดับ</th>
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
                  <th>กลุ่มบริหาร</th>
                  <th>แหล่งงบประมาณ</th>
                  <th className="whitespace-nowrap text-right">งบประมาณ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSourceRows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                    {isAdmin && (
                      <td className="text-center">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                      </td>
                    )}
                    <td className="min-w-[10rem] max-w-[18rem]">
                      <span className="break-words font-medium text-slate-900">{r.name}</span>
                    </td>
                    <td>{r.adminGroup}</td>
                    <td>{r.budgetSource}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.budget)}</td>
                  </tr>
                ))}
                {sourceRows !== null && filteredSourceRows.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="table-empty">
                      ไม่พบโครงการในปีงบประมาณต้นทางที่เลือก
                    </td>
                  </tr>
                )}
                {sourceRows === null && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="table-empty">
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
          </div>
          <p className="mb-3 text-sm text-slate-500">
            {canEditDraft
              ? "ตารางเทียบกับโครงการปีก่อน — กด \"แก้ไข\" ต่อรายการเพื่อกรอกวงเงินปีนี้ (รวมกิจกรรมย่อย) แล้วกด \"บันทึก\""
              : "ดูรายการได้อย่างเดียว"}{" "}
            — ครูจะเลือกจากรายการนี้ตอนสร้างข้อเสนอโครงการจริงที่เมนู &quot;เสนอโครงการ&quot;
          </p>

          <div className="mb-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <div>
              <div className="card-title mb-2 text-sm font-bold text-navy-800">เทียบตามแหล่งงบประมาณ</div>
              <div className="table-shell">
                {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {sourceSummaryRows.map((r, i) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-words font-medium text-slate-900">
                          <span className="text-xs text-slate-400">#{i + 1}</span> {r.label}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums font-semibold ${
                            Math.abs(r.diff) < 0.005 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatBaht(r.diff)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        จัดสรร {formatBaht(r.allocated)} · ร่างโครงการ {formatBaht(r.draftTotal)}
                      </p>
                    </div>
                  ))}
                  {sourceSummaryRows.length === 0 && <p className="table-empty">ยังไม่มีแหล่งงบประมาณ</p>}
                </div>

                {/* จอกว้าง md ขึ้นไป: ตาราง */}
                <table className="hidden table-base min-w-0 md:table [&_td]:px-3 [&_th]:px-3">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">ลำดับ</th>
                      <th>แหล่งเงิน</th>
                      <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
                      <th className="whitespace-nowrap text-right">งบร่างโครงการ</th>
                      <th className="whitespace-nowrap text-right">ผลต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceSummaryRows.map((r, i) => (
                      <tr key={r.id}>
                        <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
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
                        <td colSpan={5} className="table-empty">
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
                {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการทีละแถว */}
                <div className="divide-y divide-slate-100 md:hidden">
                  {groupSummaryRows.map((r, i) => (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-words font-medium text-slate-900">
                          <span className="text-xs text-slate-400">#{i + 1}</span> {r.label}
                        </span>
                        <span
                          className={`shrink-0 tabular-nums font-semibold ${
                            Math.abs(r.diff) < 0.005 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {formatBaht(r.diff)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        จัดสรร {formatBaht(r.allocated)} · ร่างโครงการ {formatBaht(r.draftTotal)}
                      </p>
                    </div>
                  ))}
                  {groupSummaryRows.length === 0 && <p className="table-empty">ยังไม่มีกลุ่มบริหารงาน</p>}
                </div>

                {/* จอกว้าง md ขึ้นไป: ตาราง */}
                <table className="hidden table-base min-w-0 md:table [&_td]:px-3 [&_th]:px-3">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">ลำดับ</th>
                      <th>กลุ่มบริหารงาน</th>
                      <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร</th>
                      <th className="whitespace-nowrap text-right">งบร่างโครงการ</th>
                      <th className="whitespace-nowrap text-right">ผลต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummaryRows.map((r, i) => (
                      <tr key={r.id}>
                        <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
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
                        <td colSpan={5} className="table-empty">
                          ยังไม่มีกลุ่มบริหารงาน
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DraftCompare
            budgetYearId={budgetYearId}
            budgetYears={budgetYears}
            adminGroups={adminGroups}
            budgetSources={budgetSources}
            isAdmin={isAdmin}
            canEditDraft={canEditDraft}
            groupAllocations={groupAllocations}
            myUserId={myUserId}
            onChanged={loadDraftRows}
          />
        </div>
      )}
    </div>
  );
}
