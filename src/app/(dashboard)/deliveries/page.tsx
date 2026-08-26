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
      <div className="page-header">
        <div>
          <h1 className="page-title">บันทึกการส่งมอบงาน</h1>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="card-title">บันทึกส่งมอบงานใหม่</h2>
        <DeliveryForm action={createDelivery} contracts={contracts ?? []} />
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>เลขที่สัญญา</th>
              <th>ผู้รับจ้าง</th>
              <th>วันที่ส่งมอบ</th>
              <th>ผู้ตรวจรับ</th>
              <th className="text-right">จำนวนเงิน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deliveries?.map((d) => {
              const contract = d.proc_contracts as unknown as { contract_no: string; vendor_name: string } | null;
              return (
                <tr key={d.id}>
                  <td className="font-medium text-slate-900">{contract?.contract_no ?? "-"}</td>
                  <td>{contract?.vendor_name ?? "-"}</td>
                  <td>
                    {d.delivery_date} {d.delivery_month ? `(${d.delivery_month})` : ""}
                  </td>
                  <td>{d.inspector_name ?? "-"}</td>
                  <td className="text-right font-semibold text-slate-900">
                    {formatBaht(Number(d.amount))}
                  </td>
                  <td className="text-right">
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
                <td colSpan={6} className="table-empty">
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
