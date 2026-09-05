"use client";

// หน้า "สรุปภาพรวม" — รายงานสรุปการดำเนินงานและการใช้งบประมาณตามแผนปฏิบัติการประจำปี พิมพ์ลง A4
// แนวตั้ง/ส่งออก PDF ได้ (ใช้ window.print() ของเบราว์เซอร์ ไม่ได้สร้างไฟล์ react-pdf แยก เพราะหน้านี้มี
// กราฟที่ react-pdf วาดไม่ได้ตรงๆ — ดีไซน์อนุมัติจากผู้ใช้แล้วผ่าน artifact mockup ก่อนเขียนหน้านี้)
//
// ที่มาของตัวเลข "เบิกจ่ายแล้ว" ทั้งหมดในหน้านี้ยึดจาก proc_approvals (บันทึกขออนุมัติ) ที่
// status = "อนุมัติ" เท่านั้น — ไม่ใช้ proc_project_disbursements (เมนู "เบิกจ่ายงบประมาณโครงการ")
// ตามที่ผู้ใช้ยืนยันไว้ เพราะการเบิกจ่ายจริงในระบบนี้อ้างอิงบันทึกขออนุมัติเป็นหลัก
//
// "สรุปงบที่ใช้ (แยกตามประเภทรายจ่าย)" ดึงจาก proc_approvals.summary_items ซึ่งเป็นรายการย่อย 5
// หมวดคงที่ต่อเอกสาร 1 ใบ (ดู SUMMARY_LABELS ใน approvals/approval-form.tsx) — จับคู่ด้วยข้อความ
// label ตรงๆ แทนตำแหน่ง index กันกรณีลำดับที่บันทึกไว้ไม่ตรงกัน

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSchoolSettings } from "@/lib/school-settings";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { PrinterIcon } from "@/components/icons";

const SUMMARY_LABELS = [
  "จัดซื้อจัดจ้าง",
  "ค่าเบี้ยเลี้ยง/ค่าตอบแทน",
  "ค่าเดินทางไปราชการ",
  "ค่าสาธารณูปโภค",
  "อื่นๆ (ระบุ)",
];
const SUMMARY_DISPLAY_LABELS = ["จัดซื้อจัดจ้าง", "เบี้ยเลี้ยง/ค่าตอบแทน", "เดินทางไปราชการ", "สาธารณูปโภค", "อื่นๆ"];
const CAT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

const GOOD = "#059669"; // เบิกจ่ายแล้ว / เสร็จสิ้น
const WARN = "#d97706"; // คงเหลือ / กำลังดำเนินการ
const NEUTRAL = "#94a3b8"; // ยังไม่ดำเนินการ
const BRAND = "#123361";

type ProjectRow = {
  id: string;
  name: string;
  adminGroupId: string | null;
  budgetSourceId: string | null;
  budget: number;
  activityCount: number;
};
type GroupItem = { id: string; name: string };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}
// ย่อเป็น "ล้านบาท" เฉพาะยอดตั้งแต่ 1 ล้านขึ้นไป — ยอดน้อยกว่านั้นหารล้านแล้วปัดเหลือ 2 ตำแหน่งจะ
// กลายเป็น "0.00M" ดูเหมือนไม่มีข้อมูลทั้งที่มีจริง จึงโชว์เป็นจำนวนเงินตรงๆ แทน
function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

// วงกลมโดนัท 2-3 สัดส่วน วาดด้วย stroke-dasharray ต่อกันเป็นเส้นรอบวง (r=15.9 ให้เส้นรอบวง = 100
// พอดี แปลง % เป็นความยาวเส้นได้ตรงๆ โดยไม่ต้องคำนวณ circumference เอง)
function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  // เริ่มที่ตำแหน่ง 12 นาฬิกา (ค่า default ของ SVG คือ 3 นาฬิกา จึงชดเชย 25 หน่วย) แล้วไล่สะสม
  // offset ของแต่ละส่วนไว้ล่วงหน้าเป็น array ก่อน render กันการ mutate ตัวแปรระหว่าง map
  const arcs = segments.reduce<{ segPct: number; color: string; offset: number }[]>((acc, seg) => {
    const segPct = (seg.value / total) * 100;
    const prevOffset = acc.length > 0 ? acc[acc.length - 1].offset - acc[acc.length - 1].segPct : 25;
    acc.push({ segPct, color: seg.color, offset: prevOffset });
    return acc;
  }, []);
  return (
    <svg width="92" height="92" viewBox="0 0 42 42" role="img" aria-label={centerLabel}>
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#eef1f5" strokeWidth="6" />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke={arc.color}
          strokeWidth="6"
          strokeDasharray={`${arc.segPct} ${100 - arc.segPct}`}
          strokeDashoffset={arc.offset}
        />
      ))}
      <text x="21" y="19.5" textAnchor="middle" fontSize="6.2" fontWeight="700" fill="#0c2447">
        {centerValue}
      </text>
      <text x="21" y="26" textAnchor="middle" fontSize="3.4" fill="#8a93a6">
        {centerLabel}
      </text>
    </svg>
  );
}

export default function DashboardPage() {
  const { schoolName, logoUrl } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<{ id: string; year: number } | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [adminGroups, setAdminGroups] = useState<GroupItem[]>([]);
  const [budgetSources, setBudgetSources] = useState<GroupItem[]>([]);
  const [approvedByProject, setApprovedByProject] = useState<Map<string, number>>(new Map());
  const [expenseTotals, setExpenseTotals] = useState<number[]>([0, 0, 0, 0, 0]);
  const [completedProjectIds, setCompletedProjectIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: budgetYears }, { data: adminGroupsData }, { data: budgetSourcesData }] = await Promise.all([
      supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false }),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    ]);

    const year = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;
    setCurrentYear(year ? { id: year.id, year: year.year } : null);
    setAdminGroups(adminGroupsData ?? []);
    setBudgetSources(budgetSourcesData ?? []);

    if (!year) {
      setProjects([]);
      setApprovedByProject(new Map());
      setExpenseTotals([0, 0, 0, 0, 0]);
      setCompletedProjectIds(new Set());
      setLoading(false);
      return;
    }

    const [{ data: projectsData }, { data: approvals }, { data: reports }] = await Promise.all([
      supabase
        .from("plan_projects")
        .select("id, name, admin_group_id, budget_source_id, budget, plan_activities(budget)")
        .eq("budget_year_id", year.id),
      supabase.from("proc_approvals").select("project_id, requested_amount, summary_items").eq("status", "อนุมัติ"),
      supabase.from("proc_project_reports").select("project_id, not_implemented"),
    ]);

    const rows: ProjectRow[] = (projectsData ?? []).map((p) => {
      const activities = (p.plan_activities as unknown as { budget: number }[]) ?? [];
      const budget =
        activities.length > 0 ? activities.reduce((s, a) => s + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
      return {
        id: p.id,
        name: p.name,
        adminGroupId: p.admin_group_id,
        budgetSourceId: p.budget_source_id,
        budget,
        activityCount: activities.length,
      };
    });
    setProjects(rows);

    const projectIds = new Set(rows.map((r) => r.id));

    const nextApprovedByProject = new Map<string, number>();
    const nextExpenseTotals = [0, 0, 0, 0, 0];
    for (const a of approvals ?? []) {
      if (!a.project_id || !projectIds.has(a.project_id)) continue;
      nextApprovedByProject.set(
        a.project_id,
        (nextApprovedByProject.get(a.project_id) ?? 0) + Number(a.requested_amount ?? 0),
      );
      const items = (a.summary_items as { label: string; amount: number | null }[] | null) ?? [];
      for (const item of items) {
        const idx = SUMMARY_LABELS.indexOf(item.label);
        if (idx >= 0) nextExpenseTotals[idx] += Number(item.amount ?? 0);
      }
    }
    setApprovedByProject(nextApprovedByProject);
    setExpenseTotals(nextExpenseTotals);

    const nextCompleted = new Set<string>();
    for (const r of reports ?? []) {
      if (r.project_id && projectIds.has(r.project_id) && r.not_implemented === false) nextCompleted.add(r.project_id);
    }
    setCompletedProjectIds(nextCompleted);

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const computed = useMemo(() => {
    const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
    const totalSpent = Array.from(approvedByProject.values()).reduce((s, v) => s + v, 0);
    const totalRemaining = totalBudget - totalSpent;
    const totalActivities = projects.reduce((s, p) => s + p.activityCount, 0);

    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    for (const p of projects) {
      if (completedProjectIds.has(p.id)) completed++;
      else if ((approvedByProject.get(p.id) ?? 0) > 0) inProgress++;
      else notStarted++;
    }

    const bySource = budgetSources.map((s) => {
      const inSource = projects.filter((p) => p.budgetSourceId === s.id);
      const budget = inSource.reduce((sum, p) => sum + p.budget, 0);
      const spent = inSource.reduce((sum, p) => sum + (approvedByProject.get(p.id) ?? 0), 0);
      return { id: s.id, name: s.name, budget, spent, remaining: budget - spent };
    });

    const byGroup = adminGroups.map((g) => {
      const inGroup = projects.filter((p) => p.adminGroupId === g.id);
      const budget = inGroup.reduce((sum, p) => sum + p.budget, 0);
      const spent = inGroup.reduce((sum, p) => sum + (approvedByProject.get(p.id) ?? 0), 0);
      return { id: g.id, name: g.name, budget, spent, remaining: budget - spent };
    });

    const expenseTotal = expenseTotals.reduce((s, v) => s + v, 0);

    return { totalBudget, totalSpent, totalRemaining, totalActivities, completed, inProgress, notStarted, bySource, byGroup, expenseTotal };
  }, [projects, approvedByProject, completedProjectIds, budgetSources, adminGroups, expenseTotals]);

  if (loading) return <PageLoadingSkeleton />;

  const projectCount = projects.length;
  const { totalBudget, totalSpent, totalRemaining, totalActivities, completed, inProgress, notStarted, bySource, byGroup, expenseTotal } =
    computed;

  return (
    <div className="print-compact">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .print-compact .card { padding: 14px 16px !important; }
          .print-compact .stat-card { padding: 12px 14px 12px 18px !important; }
          .print-compact .table-base th,
          .print-compact .table-base td { padding: 7px 10px !important; }
        }
      `}</style>

      <div className="page-header print:hidden">
        <div>
          <h1 className="page-title">สรุปภาพรวม</h1>
          <p className="page-subtitle">
            สรุปการดำเนินงานและการใช้งบประมาณตามแผนปฏิบัติการ
            {currentYear ? ` ปีงบประมาณ ${currentYear.year}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-primary">
          <PrinterIcon className="h-4 w-4" />
          พิมพ์ / ส่งออก PDF
        </button>
      </div>

      {/* หัวเอกสารสำหรับตอนพิมพ์เท่านั้น (จอปกติไม่แสดง เพราะซ้ำกับ page-header ด้านบน) */}
      <div className="hidden items-center justify-between border-b-2 border-navy-800 pb-3 print:mb-3 print:flex">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={schoolName} className="h-10 w-10 object-contain" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-950 text-sm font-bold text-gold-400">
              {schoolName.charAt(0) || "ร"}
            </span>
          )}
          <div className="text-sm text-slate-600">
            <b className="block text-slate-900">{schoolName}</b>
            ระบบบริหารงานงบประมาณ
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-navy-800">สรุปภาพรวมการดำเนินงานและการใช้งบประมาณ</div>
          <p className="text-xs text-slate-500">
            ตามแผนปฏิบัติการประจำปีงบประมาณ {currentYear?.year ?? "-"} · พิมพ์เมื่อ{" "}
            {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {!currentYear ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          ยังไม่มีปีงบประมาณที่เปิดใช้งานอยู่ กรุณากำหนดที่หน้าตั้งค่าระบบก่อน
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4 print:gap-3">
            <div className="stat-card" style={{ "--accent": BRAND } as React.CSSProperties}>
              <div className="stat-label">จำนวนโครงการ</div>
              <div className="stat-value">
                {projectCount.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{totalActivities.toLocaleString("th-TH")} กิจกรรม</p>
            </div>
            <div className="stat-card" style={{ "--accent": BRAND } as React.CSSProperties}>
              <div className="stat-label">งบประมาณทั้งหมด</div>
              <div className="stat-value text-lg">{formatBaht(totalBudget)}</div>
              <p className="mt-1 text-xs text-slate-400">บาท</p>
            </div>
            <div className="stat-card" style={{ "--accent": GOOD } as React.CSSProperties}>
              <div className="stat-label">เบิกจ่ายแล้ว</div>
              <div className="stat-value text-lg text-emerald-600">{formatBaht(totalSpent)}</div>
              <p className="mt-1 text-xs text-slate-400">{pct(totalSpent, totalBudget).toFixed(1)}% ของงบทั้งหมด</p>
            </div>
            <div className="stat-card" style={{ "--accent": WARN } as React.CSSProperties}>
              <div className="stat-label">งบคงเหลือ</div>
              <div className="stat-value text-lg text-amber-600">{formatBaht(totalRemaining)}</div>
              <p className="mt-1 text-xs text-slate-400">{pct(totalRemaining, totalBudget).toFixed(1)}% ของงบทั้งหมด</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-3">
            <div className="card">
              <div className="card-title">สถานะโครงการ ({projectCount.toLocaleString("th-TH")} โครงการ)</div>
              <div className="flex items-center gap-4 print:gap-3">
                <Donut
                  segments={[
                    { value: completed, color: GOOD },
                    { value: inProgress, color: WARN },
                    { value: notStarted, color: NEUTRAL },
                  ]}
                  centerValue={String(projectCount)}
                  centerLabel="โครงการ"
                />
                <div className="min-w-0 flex-1 space-y-2 text-sm print:space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: GOOD }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">เสร็จสิ้น</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{completed}</span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
                      {pct(completed, projectCount).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: WARN }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">กำลังดำเนินการ</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{inProgress}</span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
                      {pct(inProgress, projectCount).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: NEUTRAL }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">ยังไม่ดำเนินการ</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{notStarted}</span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
                      {pct(notStarted, projectCount).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">การใช้งบประมาณโดยรวม</div>
              <div className="flex items-center gap-4 print:gap-3">
                <Donut
                  segments={[
                    { value: totalSpent, color: GOOD },
                    { value: Math.max(totalRemaining, 0), color: WARN },
                  ]}
                  centerValue={`${pct(totalSpent, totalBudget).toFixed(1)}%`}
                  centerLabel="เบิกจ่ายแล้ว"
                />
                <div className="min-w-0 flex-1 space-y-2 text-sm print:space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: GOOD }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">เบิกจ่ายแล้ว</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatBaht(totalSpent)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: WARN }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">คงเหลือ</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatBaht(totalRemaining)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: BRAND }} />
                    <span className="min-w-0 flex-1 truncate text-slate-600">รวมทั้งสิ้น</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatBaht(totalBudget)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 print:mt-3 print:grid-cols-2 print:gap-3">
            <div className="card">
              <div className="card-title">งบประมาณแยกตามประเภทเงิน</div>
              <div className="mb-3 flex gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: GOOD }} />
                  เบิกจ่ายแล้ว
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm opacity-60" style={{ background: WARN }} />
                  คงเหลือ
                </span>
              </div>
              <div className="space-y-4 print:space-y-3">
                {bySource.map((s) => {
                  const spentPct = pct(s.spent, s.budget);
                  return (
                    <div key={s.id}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="font-medium text-slate-900">{s.name}</span>
                        <span className="tabular-nums text-slate-500">{formatBaht(s.budget)} บาท</span>
                      </div>
                      <div className="flex h-3.5 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                        <div style={{ width: `${spentPct}%`, background: GOOD }} />
                        <div style={{ width: `${100 - spentPct}%`, background: WARN, opacity: 0.55 }} />
                      </div>
                      <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-400">
                        <span>จ่ายแล้ว {spentPct.toFixed(1)}%</span>
                        <span>คงเหลือ {(100 - spentPct).toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
                {bySource.length === 0 && <p className="table-empty">ยังไม่มีแหล่งเงินงบประมาณ</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-title">สรุปงบที่ใช้ (แยกตามประเภทรายจ่าย)</div>
              <div className="flex items-center gap-4 print:gap-3">
                <div
                  className="relative h-[104px] w-[104px] shrink-0 rounded-full border border-slate-200"
                  style={{
                    background: `conic-gradient(${(() => {
                      let acc = 0;
                      return SUMMARY_DISPLAY_LABELS.map((_, i) => {
                        const start = acc;
                        acc += pct(expenseTotals[i], expenseTotal);
                        return `${CAT_COLORS[i]} ${start}% ${acc}%`;
                      }).join(", ");
                    })()})`,
                  }}
                >
                  <div className="absolute left-1/2 top-1/2 flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-slate-200 bg-white">
                    <b className="text-sm font-bold tabular-nums text-slate-900">{formatCompact(expenseTotal)}</b>
                    <span className="text-[9px] text-slate-400">รวมจ่าย</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 text-sm print:space-y-1">
                  {SUMMARY_DISPLAY_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CAT_COLORS[i] }} />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{label}</span>
                      <span className="shrink-0 text-right leading-tight">
                        <span className="block font-semibold tabular-nums text-slate-900">
                          {formatBaht(expenseTotals[i])}
                        </span>
                        <span className="block text-[10px] tabular-nums text-slate-400">
                          {pct(expenseTotals[i], expenseTotal).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 table-shell print:mt-3">
            <div className="card-title px-4 pt-4">งบประมาณแยกตามกลุ่มบริหารงาน</div>
            <table className="table-base">
              <thead>
                <tr>
                  <th>กลุ่มบริหารงาน</th>
                  <th className="whitespace-nowrap">สัดส่วนการใช้งบ</th>
                  <th className="whitespace-nowrap text-right">ตั้งงบไว้ (บาท)</th>
                  <th className="whitespace-nowrap text-right">จ่ายแล้ว (บาท)</th>
                  <th className="whitespace-nowrap text-right">คงเหลือ (บาท)</th>
                  <th className="whitespace-nowrap text-right">% จ่ายแล้ว</th>
                </tr>
              </thead>
              <tbody>
                {byGroup.map((g) => {
                  const spentPct = pct(g.spent, g.budget);
                  return (
                    <tr key={g.id}>
                      <td className="font-medium text-slate-900">{g.name}</td>
                      <td className="min-w-[120px]">
                        <div className="flex h-2.5 overflow-hidden rounded-sm border border-slate-200 bg-slate-100">
                          <div style={{ width: `${spentPct}%`, background: GOOD }} />
                          <div style={{ width: `${100 - spentPct}%`, background: WARN, opacity: 0.55 }} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(g.budget)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(g.spent)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(g.remaining)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{spentPct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {byGroup.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      ยังไม่มีกลุ่มบริหารงาน
                    </td>
                  </tr>
                )}
              </tbody>
              {byGroup.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="font-bold text-slate-700">รวมทั้งสิ้น</td>
                    <td></td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalBudget)}
                    </td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalSpent)}
                    </td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalRemaining)}
                    </td>
                    <td className="whitespace-nowrap text-right font-bold tabular-nums text-navy-800">
                      {pct(totalSpent, totalBudget).toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
