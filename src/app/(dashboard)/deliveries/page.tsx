"use client";

// Client Component — ดึงรายการส่งมอบงานผ่าน browser Supabase client (ต่อจาก /contracts —
// ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { toastError, errorMessage } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { createDelivery, deleteDelivery } from "./actions";
import { DeliveryForm } from "./delivery-form";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Delivery = {
  id: string;
  delivery_date: string;
  delivery_month: string | null;
  amount: number;
  inspector_name: string | null;
  proc_contracts: { contract_no: string; vendor_name: string } | null;
};
type Contract = { id: string; contract_no: string; vendor_name: string; amount: number; inspector_name: string | null };

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: deliveriesData, error }, { data: contractsData }] = await Promise.all([
      supabase
        .from("proc_deliveries")
        .select("id, delivery_date, delivery_month, amount, inspector_name, proc_contracts(contract_no, vendor_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("proc_contracts")
        .select("id, contract_no, vendor_name, amount, inspector_name")
        .order("created_at", { ascending: false }),
    ]);
    if (error) setError(error.message);
    setDeliveries((deliveriesData as unknown as Delivery[]) ?? []);
    setContracts(contractsData ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleDelete(id: string) {
    try {
      await deleteDelivery(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">บันทึกการส่งมอบงาน</h1>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="card-title">บันทึกส่งมอบงานใหม่</h2>
        <DeliveryForm action={createDelivery} contracts={contracts} onSuccess={reload} />
      </div>

      {deliveries === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
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
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium text-slate-900">{d.proc_contracts?.contract_no ?? "-"}</td>
                  <td>{d.proc_contracts?.vendor_name ?? "-"}</td>
                  <td>
                    {formatThaiDate(d.delivery_date)} {d.delivery_month ? `(${d.delivery_month})` : ""}
                  </td>
                  <td>{d.inspector_name ?? "-"}</td>
                  <td className="text-right font-semibold text-slate-900">{formatBaht(Number(d.amount))}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
