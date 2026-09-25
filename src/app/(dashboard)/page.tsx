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
import { PendingActionsPanel } from "./pending-actions-panel";

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
const WARN = "#d97706"; // คงเหลือ
// "กำลังดำเนินการ" ใช้เขียวเฉดอ่อนกว่า GOOD (เสร็จสิ้น) เพื่อให้ทั้งคู่อยู่ในโทนเขียวเดียวกัน
// (สื่อว่าเป็นไปด้วยดีทั้งคู่) แต่ยังแยกจากกันได้ชัดด้วยความเข้ม
const INPROGRESS = "#34d399"; // กำลังดำเนินการ
const NEUTRAL = "#cbd5e1"; // ยังไม่ดำเนินการ — เทาจางกว่าเดิม (#94a3b8) ให้ดูเป็นสถานะ "ยังไม่เริ่ม" เฉยๆ ไม่เด่นเกิน
const BRAND = "#123361";
// สีวนใช้ต่อวงในเกจครึ่งวงกลมซ้อน "งบประมาณแยกตามประเภทเงิน" — แค่แยกแยะแต่ละวง ไม่ได้มีความหมาย
// เชิงสถานะแบบ GOOD/WARN/NEUTRAL จึงแยกชุดสีต่างหาก วนซ้ำถ้าประเภทเงินมีมากกว่าจำนวนสีที่กำหนด
const SOURCE_RING_COLORS = ["#1b4177", "#c19a2e", "#059669", "#0891b2", "#7c3aed"];

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
function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function PieChart({ values, colors, size = 150 }: { values: number[]; colors: string[]; size?: number }) {
  const total = values.reduce((sum, v) => sum + v, 0);
  const r = size / 2;
  if (total <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="ยังไม่มีรายจ่าย">
        <circle cx={r} cy={r} r={r - 1} fill="#e2e8f0" />
        <text x={r} y={r + 4} textAnchor="middle" fontSize="12" fill="#64748b">
          ยังไม่มีรายจ่าย
        </text>
      </svg>
    );
  }
  const nonZero = values.filter((v) => v > 0).length;
  const startAngles = values.map(
    (_, i) => -Math.PI / 2 + (values.slice(0, i).reduce((sum, v) => sum + v, 0) / total) * Math.PI * 2,
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="สัดส่วนงบที่ใช้แยกตามประเภทรายจ่าย">
      {values.map((v, i) => {
        if (v <= 0) return null;
        const color = colors[i % colors.length];
        if (nonZero === 1) return <circle key={i} cx={r} cy={r} r={r - 1} fill={color} />;
        const sweep = (v / total) * Math.PI * 2;
        const start = startAngles[i];
        const end = start + sweep;
        const x1 = r + (r - 1) * Math.cos(start);
        const y1 = r + (r - 1) * Math.sin(start);
        const x2 = r + (r - 1) * Math.cos(end);
        const y2 = r + (r - 1) * Math.sin(end);
        const largeArc = sweep > Math.PI ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${r} ${r} L ${x1} ${y1} A ${r - 1} ${r - 1} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        );
      })}
    </svg>
  );
}

// แถบพื้นหลัง 3 ช่วง (0-50 / 50-80 / 80-100%) เป็นเกณฑ์อ่านระดับ, แถบเขียวคือ % เบิกจ่ายจริง,
// เส้นตั้งคือเป้าตามสัดส่วนเวลาที่ผ่านไปของปีงบประมาณ — วาดเป็น SVG ให้สียังออกตอนพิมพ์
const BULLET_BANDS = [
  { to: 50, color: "#eef1f5" },
  { to: 80, color: "#e2e8f0" },
  { to: 100, color: "#cbd5e1" },
];

function BulletChart({ value, target }: { value: number; target: number | null }) {
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100);
  const v = clamp(value);
  return (
    <div>
      <svg
        width="100%"
        height="32"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        role="img"
        aria-label={`เบิกจ่ายแล้ว ${v.toFixed(1)}%${target !== null ? ` เป้าตามเวลา ${clamp(target).toFixed(1)}%` : ""}`}
      >
        {BULLET_BANDS.map((b, i) => {
          const from = i === 0 ? 0 : BULLET_BANDS[i - 1].to;
          return <rect key={b.to} x={from} y={0} width={b.to - from} height={32} fill={b.color} />;
        })}
        <rect x={0} y={10} width={v} height={12} fill={GOOD} />
        {target !== null && (
          <line
            x1={clamp(target)}
            x2={clamp(target)}
            y1={3}
            y2={29}
            stroke="#0c2447"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="relative mt-1 h-4 text-[11px] tabular-nums text-slate-400">
        {[0, 25, 50, 75, 100].map((t) => (
          <span
            key={t}
            className="absolute"
            style={{ left: `${t}%`, transform: t === 0 ? "none" : t === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            {t}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ปีงบประมาณ พ.ศ. Y เริ่ม 1 ต.ค. ของปี Y-1 ถึง 30 ก.ย. ของปี Y
function fiscalYearElapsedPct(yearBE: number, now: Date): number {
  const yearCE = yearBE - 543;
  const start = new Date(yearCE - 1, 9, 1).getTime();
  const end = new Date(yearCE, 9, 1).getTime();
  return Math.min(Math.max(((now.getTime() - start) / (end - start)) * 100, 0), 100);
}

// เกจครึ่งวงกลมซ้อนกันหลายชั้น — แต่ละชั้นเป็นวงอิสระของตัวเอง (ไม่แบ่งเส้นรอบวงเดียวกัน) ใช้กับ
// "งบประมาณแยกตามประเภทเงิน" แทนแถบเส้นตรงเดิม รัศมีของแต่ละชั้นลดหลั่นจากนอกเข้าใน (ชั้นแรก = วงนอกสุด)
// จำกัดรัศมีขั้นต่ำไว้กันชั้นทับกันเมื่อมีประเภทเงินจำนวนมาก
function ConcentricHalfGauges({ rings }: { rings: { percent: number; color: string }[] }) {
  const cx = 115;
  const cy = 115;
  const strokeWidth = 15;
  const outerR = 95;
  const step = 20;
  const minR = 20;

  const pointAt = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };

  return (
    <svg viewBox="0 0 230 135" width="230" height="135" role="img" aria-label="งบประมาณแยกตามประเภทเงิน">
      {rings.map((ring, i) => {
        const r = Math.max(outerR - i * step, minR);
        const clamped = Math.min(Math.max(ring.percent, 0), 100);
        const start = pointAt(180, r);
        const trackEnd = pointAt(0, r);
        const valueEnd = pointAt(180 - (clamped / 100) * 180, r);
        return (
          <g key={i}>
            <path
              d={`M${start.x},${start.y} A${r},${r} 0 0 1 ${trackEnd.x},${trackEnd.y}`}
              fill="none"
              stroke="#eef1f5"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            {clamped > 0 && (
              <path
                d={`M${start.x},${start.y} A${r},${r} 0 0 1 ${valueEnd.x},${valueEnd.y}`}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const { schoolName, logoUrl } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<{ id: string; year: number } | null>(null);
  const [fiscalElapsedPct, setFiscalElapsedPct] = useState<number | null>(null);
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
    setFiscalElapsedPct(year ? fiscalYearElapsedPct(year.year, new Date()) : null);
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

      <PendingActionsPanel />

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
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 print:h-3.5">
                <span style={{ width: `${pct(completed, projectCount)}%`, background: GOOD }} />
                <span style={{ width: `${pct(inProgress, projectCount)}%`, background: INPROGRESS }} />
                <span style={{ width: `${pct(notStarted, projectCount)}%`, background: NEUTRAL }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm print:mt-3 print:gap-x-4">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: GOOD }} />
                  <span className="text-slate-600">
                    เสร็จสิ้น <b className="font-semibold text-slate-900">{completed}</b> ({pct(completed, projectCount).toFixed(1)}%)
                  </span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: INPROGRESS }} />
                  <span className="text-slate-600">
                    กำลังดำเนินการ <b className="font-semibold text-slate-900">{inProgress}</b> ({pct(inProgress, projectCount).toFixed(1)}%)
                  </span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: NEUTRAL }} />
                  <span className="text-slate-600">
                    ยังไม่ดำเนินการ <b className="font-semibold text-slate-900">{notStarted}</b> ({pct(notStarted, projectCount).toFixed(1)}%)
                  </span>
                </span>
              </div>
            </div>

            <div className="card">
              <div className="card-title">การใช้งบประมาณโดยรวม</div>
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tabular-nums text-navy-900">
                  {pct(totalSpent, totalBudget).toFixed(1)}%
                </span>
                <span className="text-sm text-slate-500">เบิกจ่ายแล้วจากงบทั้งหมด</span>
              </div>
              <BulletChart value={pct(totalSpent, totalBudget)} target={fiscalElapsedPct} />
              <div className="mt-4 space-y-2 text-sm print:mt-2 print:space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: GOOD }} />
                  <span className="min-w-0 flex-1 truncate text-slate-600">เบิกจ่ายแล้ว</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatBaht(totalSpent)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300 bg-slate-100" />
                  <span className="min-w-0 flex-1 truncate text-slate-600">คงเหลือ</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatBaht(totalRemaining)}</span>
                </div>
                {fiscalElapsedPct !== null && (
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-0.5 shrink-0 bg-navy-900" />
                    <span className="min-w-0 flex-1 truncate text-slate-600">เป้าตามเวลาที่ผ่านไปของปีงบประมาณ</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fiscalElapsedPct.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 print:mt-3 print:grid-cols-2 print:gap-3">
            <div className="card">
              <div className="card-title">งบประมาณแยกตามประเภทเงิน</div>
              <div className="sm:flex sm:items-center sm:gap-6">
                <div className="shrink-0">
                  <ConcentricHalfGauges
                    rings={bySource.map((s, i) => ({
                      percent: pct(s.spent, s.budget),
                      color: SOURCE_RING_COLORS[i % SOURCE_RING_COLORS.length],
                    }))}
                  />
                </div>
                <div className="mt-2 min-w-0 flex-1 space-y-2.5 text-sm sm:mt-0 print:mt-1 print:space-y-2">
                  {bySource.map((s, i) => {
                    const spentPct = pct(s.spent, s.budget);
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: SOURCE_RING_COLORS[i % SOURCE_RING_COLORS.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate text-slate-600">{s.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-400">{formatBaht(s.budget)} บาท</span>
                        <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-slate-900">
                          {spentPct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                  {bySource.length === 0 && <p className="table-empty">ยังไม่มีแหล่งเงินงบประมาณ</p>}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">สรุปงบที่ใช้ (แยกตามประเภทรายจ่าย)</div>
              <p className="mb-4 text-xs text-slate-400">
                รวมจ่ายทั้งหมด <b className="font-semibold tabular-nums text-slate-700">{formatBaht(expenseTotal)}</b> บาท
              </p>
              <div className="sm:flex sm:items-center sm:gap-6">
                <div className="flex shrink-0 justify-center">
                  <PieChart values={expenseTotals} colors={CAT_COLORS} />
                </div>
                <div className="mt-3 min-w-0 flex-1 space-y-2.5 text-sm sm:mt-0 print:mt-1 print:space-y-2">
                  {SUMMARY_DISPLAY_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CAT_COLORS[i] }} />
                      <span className="min-w-0 flex-1 truncate text-slate-600">{label}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{formatBaht(expenseTotals[i])} บาท</span>
                      <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-slate-900">
                        {pct(expenseTotals[i], expenseTotal).toFixed(1)}%
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
                          <div style={{ width: `${100 - spentPct}%`, background: NEUTRAL }} />
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
                    <td className="px-4 py-3 font-bold text-slate-700">รวมทั้งสิ้น</td>
                    <td className="px-4 py-3"></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalBudget)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalSpent)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-navy-800">
                      {formatBaht(totalRemaining)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-navy-800">
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
