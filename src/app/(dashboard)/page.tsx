"use client";

// Client Component — ดึงข้อมูลสรุปทั้งหมดผ่าน browser Supabase client แทนการรอ Server Component
// fetch ก่อนส่ง HTML กลับมา (หน้าถัดไปในเฟส 3 ต่อจาก /strategies, /standards, /vendors — ดู
// /root/.claude/plans) ตารางที่ใช้ทั้งหมดเป็น RLS roles: {authenticated} อยู่แล้ว อ่านผ่าน browser
// client ได้ปกติเพราะ session อยู่ใน cookie เดียวกับที่ server ใช้ (ยืนยันแล้วจากการแปลงหน้า vendors)
// ไม่มีการเขียนข้อมูลในหน้านี้เลย จึงไม่ต้องพึ่ง server action ใดๆ

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DashboardLoadingSkeleton } from "@/components/loading-skeleton";
import { ClipboardCheckIcon, FileTextIcon, FolderIcon, ShoppingCartIcon } from "@/components/icons";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type DashboardData = {
  purchaseCount: number;
  contractCount: number;
  deliveryCount: number;
  projectCount: number;
  approvalCount: number;
  currentYear: { id: string; year: number } | undefined;
  currentYearProjectCount: number;
  currentYearTotalBudget: number;
  currentYearTotalSpent: number;
  totalPurchaseAmount: number;
  totalAllowanceAmount: number;
  totalApprovalAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  pendingDisbursementCount: number;
  paidDisbursementCount: number;
  reportedProjectCount: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();

    const [
      { count: purchaseCount },
      { count: contractCount },
      { count: deliveryCount },
      projectsRes,
      { data: purchaseSumRows },
      { data: allowanceRows },
      { data: projectDisbursementRows },
      { count: approvalCount },
      { data: approvalSumRows },
      { data: budgetYears },
      { data: reportRows },
    ] = await Promise.all([
      supabase.from("proc_purchase_requests").select("*", { count: "exact", head: true }),
      supabase.from("proc_contracts").select("*", { count: "exact", head: true }),
      supabase.from("proc_deliveries").select("*", { count: "exact", head: true }),
      supabase.from("plan_projects").select("id"),
      supabase.from("proc_purchase_requests").select("amount"),
      supabase.from("proc_allowance_disbursements").select("amount"),
      supabase.from("proc_project_disbursements").select("project_id, amount, status"),
      supabase.from("proc_approvals").select("*", { count: "exact", head: true }),
      supabase.from("proc_approvals").select("requested_amount"),
      supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false }),
      supabase.from("proc_project_reports").select("project_id"),
    ]);

    const reportedProjectCount = new Set(
      (reportRows ?? []).map((r) => r.project_id).filter((id): id is string => !!id),
    ).size;

    const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];
    const { data: currentYearProjects } = currentYear
      ? await supabase
          .from("plan_projects")
          .select("id, budget, plan_activities(budget)")
          .eq("budget_year_id", currentYear.id)
      : { data: [] };

    const currentYearProjectIds = new Set((currentYearProjects ?? []).map((p) => p.id));
    const currentYearPaidDisbursements = (projectDisbursementRows ?? []).filter(
      (d) => d.status === "paid" && d.project_id && currentYearProjectIds.has(d.project_id),
    );

    const currentYearSpentByProject = new Map<string, number>();
    for (const d of currentYearPaidDisbursements) {
      if (!d.project_id) continue;
      currentYearSpentByProject.set(
        d.project_id,
        (currentYearSpentByProject.get(d.project_id) ?? 0) + Number(d.amount ?? 0),
      );
    }

    const currentYearTotalBudget = (currentYearProjects ?? []).reduce((sum, p) => {
      const activities = p.plan_activities as unknown as { budget: number }[];
      const budget =
        activities.length > 0
          ? activities.reduce((s, a) => s + Number(a.budget ?? 0), 0)
          : Number(p.budget ?? 0);
      return sum + budget;
    }, 0);
    const currentYearTotalSpent = (currentYearProjects ?? []).reduce(
      (sum, p) => sum + (currentYearSpentByProject.get(p.id) ?? 0),
      0,
    );

    const totalPurchaseAmount = purchaseSumRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;
    const totalAllowanceAmount = allowanceRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;
    const totalApprovalAmount =
      approvalSumRows?.reduce((sum, r) => sum + Number(r.requested_amount ?? 0), 0) ?? 0;

    const paidDisbursements = (projectDisbursementRows ?? []).filter((r) => r.status === "paid");
    const pendingDisbursements = (projectDisbursementRows ?? []).filter((r) => r.status !== "paid");
    const totalPaidAmount = paidDisbursements.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
    const totalPendingAmount = pendingDisbursements.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    setData({
      purchaseCount: purchaseCount ?? 0,
      contractCount: contractCount ?? 0,
      deliveryCount: deliveryCount ?? 0,
      projectCount: projectsRes.data?.length ?? 0,
      approvalCount: approvalCount ?? 0,
      currentYear,
      currentYearProjectCount: currentYearProjects?.length ?? 0,
      currentYearTotalBudget,
      currentYearTotalSpent,
      totalPurchaseAmount,
      totalAllowanceAmount,
      totalApprovalAmount,
      totalPaidAmount,
      totalPendingAmount,
      pendingDisbursementCount: pendingDisbursements.length,
      paidDisbursementCount: paidDisbursements.length,
      reportedProjectCount,
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (data === null) return <DashboardLoadingSkeleton />;

  const cards = [
    {
      label: "รายการขอซื้อ-ขอจ้าง",
      display: `${data.purchaseCount.toLocaleString("th-TH")} รายการ`,
      accent: "#a3791a",
      icon: ShoppingCartIcon,
    },
    {
      label: "รายงานโครงการ",
      display: `${data.reportedProjectCount.toLocaleString("th-TH")}/${data.projectCount.toLocaleString("th-TH")}`,
      accent: "#7C3AED",
      icon: FileTextIcon,
    },
  ];

  const secondaryCards = [
    {
      label: "บันทึกขออนุมัติ",
      value: data.approvalCount,
      suffix: "ฉบับ",
      accent: "#0EA5E9",
      icon: ClipboardCheckIcon,
    },
  ];

  const shortcuts = [
    { href: "/purchase-requests/new", label: "บันทึกขอซื้อ/ขอจ้าง" },
    { href: "/approvals/new", label: "สร้างบันทึกขออนุมัติ" },
    { href: "/contracts", label: "บันทึกสัญญาจ้าง" },
    { href: "/deliveries", label: "บันทึกส่งมอบงาน" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">แดชบอร์ด</h1>
          <p className="page-subtitle">ภาพรวมงานพัสดุและงบประมาณของโรงเรียน</p>
        </div>
      </div>

      <div className="card-title">
        โครงการ{data.currentYear ? ` ปีงบประมาณ ${data.currentYear.year}` : ""}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card" style={{ "--accent": "#1b4177" } as React.CSSProperties}>
          <div className="flex items-start gap-3">
            <span className="stat-icon" style={{ background: "#1b4177" }}>
              <FolderIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="stat-label">จำนวนโครงการ</div>
              <div className="stat-value">
                {data.currentYearProjectCount.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="stat-label">งบประมาณรวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(data.currentYearTotalBudget)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายแล้ว</div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600">
            {formatBaht(data.currentYearTotalSpent)} บาท
          </div>
        </div>
        <div className="card">
          <div className="stat-label">คงเหลือ</div>
          <div className="mt-1.5 text-xl font-bold text-amber-600">
            {formatBaht(data.currentYearTotalBudget - data.currentYearTotalSpent)} บาท
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="stat-card" style={{ "--accent": c.accent } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: c.accent }}>
                <c.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">{c.label}</div>
                <div className="stat-value">{c.display}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((c) => (
          <div key={c.label} className="card">
            <div className="flex items-start gap-3">
              <span className="stat-icon h-9 w-9" style={{ background: c.accent }}>
                <c.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">{c.label}</div>
                <div className="stat-value text-lg">
                  {c.value.toLocaleString("th-TH")} <span className="stat-suffix">{c.suffix}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="stat-label">ยอดขอซื้อ-ขอจ้างรวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(data.totalPurchaseAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">ยอดขออนุมัติรวม</div>
          <div className="mt-1.5 text-xl font-bold text-gold-600">{formatBaht(data.totalApprovalAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบี้ยเลี้ยง/สาธารณูปโภครวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-700">{formatBaht(data.totalAllowanceAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายโครงการ (จ่ายแล้ว / รอดำเนินการ)</div>
          <div className="mt-1.5 text-sm font-bold">
            <span className="text-emerald-600">{formatBaht(data.totalPaidAmount)}</span>
            <span className="mx-1 text-slate-400">/</span>
            <span className="text-amber-600">{formatBaht(data.totalPendingAmount)}</span>
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-title">ทางลัดระบบ</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-md border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:border-navy-700 hover:bg-navy-950/[0.03] hover:text-navy-800"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
