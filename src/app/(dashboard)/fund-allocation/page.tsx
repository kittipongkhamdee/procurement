"use client";

// หน้า "การจัดสรรเงิน" — shell แบบแท็บ 3 แท็บ: รายรับ / จัดสรรเงิน / จัดโครงการ ใช้ปีงบประมาณเดียวกัน
// ทั้งหน้า (ดู /root/.claude/plans) — client-fetch pattern เดียวกับ /projects

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { RevenueTab } from "./revenue-tab";
import { GroupAllocationTab } from "./group-allocation-tab";
import { ProjectAllocationTab } from "./project-allocation-tab";

type Option = { id: string; name: string };
type BudgetYear = { id: string; year: number; is_open: boolean };

const TABS = [
  { key: "revenue", label: "รายรับ" },
  { key: "group", label: "จัดสรรเงิน" },
  { key: "project", label: "จัดโครงการ" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function FundAllocationPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>("revenue");
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [budgetYearId, setBudgetYearId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (authLoading || loading) return <PageLoadingSkeleton />;

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
          <p className="page-subtitle">ประมาณการรายรับ จัดสรรงบประมาณตามกลุ่มบริหารงาน และจัดสรรให้แต่ละโครงการ</p>
        </div>
      </div>

      <div className="mt-6 max-w-xs">
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

      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {!budgetYearId ? (
          <p className="p-4 text-sm text-slate-400">ยังไม่มีปีงบประมาณ</p>
        ) : (
          <>
            {tab === "revenue" && <RevenueTab budgetYearId={budgetYearId} />}
            {tab === "group" && <GroupAllocationTab budgetYearId={budgetYearId} adminGroups={adminGroups} />}
            {tab === "project" && (
              <ProjectAllocationTab
                budgetYearId={budgetYearId}
                budgetYears={budgetYears}
                adminGroups={adminGroups}
                budgetSources={budgetSources}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
