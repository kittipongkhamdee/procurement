import { createClient } from "@/lib/supabase/server";
import { createDelivery, deleteDelivery } from "./actions";
import { DeliveryForm } from "./delivery-form";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const [{ data: deliveries, error }, { data: contracts }] = await Promise.all([
    supabase
      .from("proc_deliveries")
      .select("id, delivery_date, delivery_month, amount, inspector_name, proc_contracts(contract_no, vendor_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("proc_contracts")
      .select("id, contract_no, vendor_name, amount, inspector_name")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">บันทึกการส่งมอบงาน</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">บันทึกส่งมอบงานใหม่</h2>
        <DeliveryForm action={createDelivery} contracts={contracts ?? []} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขที่สัญญา</th>
              <th className="px-4 py-3">ผู้รับจ้าง</th>
              <th className="px-4 py-3">วันที่ส่งมอบ</th>
              <th className="px-4 py-3">ผู้ตรวจรับ</th>
              <th className="px-4 py-3 text-right">จำนวนเงิน</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deliveries?.map((d) => {
              const contract = d.proc_contracts as unknown as { contract_no: string; vendor_name: string } | null;
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{contract?.contract_no ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{contract?.vendor_name ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.delivery_date} {d.delivery_month ? `(${d.delivery_month})` : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.inspector_name ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatBaht(Number(d.amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteDelivery.bind(null, d.id)}>
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        ลบ
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {deliveries?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
