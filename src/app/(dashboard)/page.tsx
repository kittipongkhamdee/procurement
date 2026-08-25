import { createClient } from "@/lib/supabase/server";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: vendorCount }, { count: purchaseCount }, { count: contractCount }, projectsRes] =
    await Promise.all([
      supabase.from("proc_vendors").select("*", { count: "exact", head: true }),
      supabase.from("proc_purchase_requests").select("*", { count: "exact", head: true }),
      supabase.from("proc_contracts").select("*", { count: "exact", head: true }),
      supabase.from("plan_projects").select("id"),
    ]);

  const { data: purchaseSumRows } = await supabase
    .from("proc_purchase_requests")
    .select("amount");
  const totalPurchaseAmount =
    purchaseSumRows?.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) ?? 0;

  const cards = [
    { label: "ผู้ขาย/ผู้รับจ้าง", value: vendorCount ?? 0, suffix: "ราย" },
    { label: "รายการขอซื้อ-ขอจ้าง", value: purchaseCount ?? 0, suffix: "รายการ" },
    { label: "สัญญาจ้าง", value: contractCount ?? 0, suffix: "สัญญา" },
    { label: "โครงการทั้งหมด", value: projectsRes.data?.length ?? 0, suffix: "โครงการ" },
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

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-medium uppercase text-slate-500">
          ยอดขอซื้อ-ขอจ้างรวมทั้งหมด
        </div>
        <div className="mt-1 text-2xl font-bold text-emerald-600">
          {formatBaht(totalPurchaseAmount)} บาท
        </div>
      </div>
    </div>
  );
}
