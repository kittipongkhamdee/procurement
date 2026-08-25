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
    { label: "ผู้ขาย/ผู้รับจ้าง", value: vendorCount ?? 0, suffix: "ราย" },
    { label: "รายการขอซื้อ-ขอจ้าง", value: purchaseCount ?? 0, suffix: "รายการ" },
    { label: "สัญญาจ้าง", value: contractCount ?? 0, suffix: "สัญญา" },
    { label: "โครงการทั้งหมด", value: projectsRes.data?.length ?? 0, suffix: "โครงการ" },
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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">แดชบอร์ด</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {c.value.toLocaleString("th-TH")}{" "}
              <span className="text-sm font-normal text-slate-500">{c.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {c.value.toLocaleString("th-TH")}{" "}
              <span className="text-sm font-normal text-slate-500">{c.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">ยอดขอซื้อ-ขอจ้างรวม</div>
          <div className="mt-1 text-xl font-bold text-emerald-600">{formatBaht(totalPurchaseAmount)} บาท</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">ยอดขออนุมัติรวม</div>
          <div className="mt-1 text-xl font-bold text-red-600">{formatBaht(totalApprovalAmount)} บาท</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">เบี้ยเลี้ยง/สาธารณูปโภครวม</div>
          <div className="mt-1 text-xl font-bold text-blue-600">{formatBaht(totalAllowanceAmount)} บาท</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase text-slate-500">
            เบิกจ่ายโครงการ (จ่ายแล้ว / รอดำเนินการ)
          </div>
          <div className="mt-1 text-sm font-bold">
            <span className="text-emerald-600">{formatBaht(totalPaidAmount)}</span>
            <span className="mx-1 text-slate-400">/</span>
            <span className="text-amber-600">{formatBaht(totalPendingAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">ทางลัดระบบ</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-md border border-slate-200 px-3 py-2 text-center text-sm text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
