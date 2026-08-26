import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: vendorCount },
    { count: purchaseCount },
    { count: contractCount },
    { count: deliveryCount },
    projectsRes,
    { data: purchaseSumRows },
    { data: allowanceRows },
    { data: projectDisbursementRows },
    { count: approvalCount },
    { data: approvalSumRows },
  ] = await Promise.all([
    supabase.from("proc_vendors").select("*", { count: "exact", head: true }),
    supabase.from("proc_purchase_requests").select("*", { count: "exact", head: true }),
    supabase.from("proc_contracts").select("*", { count: "exact", head: true }),
    supabase.from("proc_deliveries").select("*", { count: "exact", head: true }),
    supabase.from("plan_projects").select("id"),
    supabase.from("proc_purchase_requests").select("amount"),
    supabase.from("proc_allowance_disbursements").select("amount"),
    supabase.from("proc_project_disbursements").select("amount, status"),
    supabase.from("proc_approvals").select("*", { count: "exact", head: true }),
    supabase.from("proc_approvals").select("requested_amount"),
  ]);

  const totalPurchaseAmount = purchaseSumRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;
  const totalAllowanceAmount = allowanceRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;
  const totalApprovalAmount = approvalSumRows?.reduce((sum, r) => sum + Number(r.requested_amount ?? 0), 0) ?? 0;

  const paidDisbursements = (projectDisbursementRows ?? []).filter((r) => r.status === "paid");
  const pendingDisbursements = (projectDisbursementRows ?? []).filter((r) => r.status !== "paid");
  const totalPaidAmount = paidDisbursements.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const totalPendingAmount = pendingDisbursements.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  const cards = [
    { label: "ผู้ขาย/ผู้รับจ้าง", value: vendorCount ?? 0, suffix: "ราย", accent: "#1b4177" },
    { label: "รายการขอซื้อ-ขอจ้าง", value: purchaseCount ?? 0, suffix: "รายการ", accent: "#a3791a" },
    { label: "สัญญาจ้าง", value: contractCount ?? 0, suffix: "สัญญา", accent: "#1b4177" },
    { label: "โครงการทั้งหมด", value: projectsRes.data?.length ?? 0, suffix: "โครงการ", accent: "#a3791a" },
  ];

  const secondaryCards = [
    { label: "บันทึกส่งมอบงาน", value: deliveryCount ?? 0, suffix: "รายการ" },
    { label: "บันทึกขออนุมัติ", value: approvalCount ?? 0, suffix: "ฉบับ" },
    { label: "เบิกจ่ายรอดำเนินการ", value: pendingDisbursements.length, suffix: "รายการ" },
    { label: "เบิกจ่ายแล้ว", value: paidDisbursements.length, suffix: "รายการ" },
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="stat-card" style={{ "--accent": c.accent } as React.CSSProperties}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">
              {c.value.toLocaleString("th-TH")} <span className="stat-suffix">{c.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((c) => (
          <div key={c.label} className="card">
            <div className="stat-label">{c.label}</div>
            <div className="stat-value text-lg">
              {c.value.toLocaleString("th-TH")} <span className="stat-suffix">{c.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="stat-label">ยอดขอซื้อ-ขอจ้างรวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(totalPurchaseAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">ยอดขออนุมัติรวม</div>
          <div className="mt-1.5 text-xl font-bold text-gold-600">{formatBaht(totalApprovalAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบี้ยเลี้ยง/สาธารณูปโภครวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-700">{formatBaht(totalAllowanceAmount)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายโครงการ (จ่ายแล้ว / รอดำเนินการ)</div>
          <div className="mt-1.5 text-sm font-bold">
            <span className="text-emerald-600">{formatBaht(totalPaidAmount)}</span>
            <span className="mx-1 text-slate-400">/</span>
            <span className="text-amber-600">{formatBaht(totalPendingAmount)}</span>
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
