"use client";

// แท็บ "จัดสรรเงิน" — กรอกจำนวนเงินที่จัดสรรให้แต่ละกลุ่มบริหารงานเอง (ไม่คำนวณ pool อัตโนมัติ)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError } from "@/lib/swal";
import { upsertGroupAllocation } from "./actions";

type Group = { id: string; name: string };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function GroupAllocationTab({ budgetYearId, adminGroups }: { budgetYearId: string; adminGroups: Group[] }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("plan_group_allocations")
      .select("admin_group_id, allocated_amount")
      .eq("budget_year_id", budgetYearId);
    const next: Record<string, number> = {};
    for (const row of data ?? []) next[row.admin_group_id] = Number(row.allocated_amount);
    setAmounts(next);
    setLoading(false);
  }, [budgetYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleChange(groupId: string, value: string) {
    const num = Number(value);
    if (value === "" || Number.isNaN(num) || num < 0) return;
    setAmounts((prev) => ({ ...prev, [groupId]: num }));
    setSavingId(groupId);
    try {
      await upsertGroupAllocation(budgetYearId, groupId, num);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="p-4 text-sm text-slate-400">กำลังโหลด...</p>;

  const total = adminGroups.reduce((sum, g) => sum + (amounts[g.id] ?? 0), 0);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">
        กรอกจำนวนเงินงบประมาณที่จัดสรรให้แต่ละกลุ่มบริหารงานสำหรับปีงบประมาณนี้ — เทียบได้กับยอดรวมจากแท็บ
        &quot;รายรับ&quot;
      </p>
      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr>
              <th>กลุ่มบริหารงาน</th>
              <th className="whitespace-nowrap text-right">งบประมาณที่จัดสรร (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {adminGroups.map((g) => (
              <tr key={g.id}>
                <td className="font-medium text-slate-900">{g.name}</td>
                <td className="whitespace-nowrap text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={amounts[g.id] ?? 0}
                    onChange={(e) => handleChange(g.id, e.target.value)}
                    disabled={savingId === g.id}
                    className="input w-40 text-right disabled:bg-slate-100"
                  />
                </td>
              </tr>
            ))}
            {adminGroups.length === 0 && (
              <tr>
                <td colSpan={2} className="table-empty">
                  ยังไม่มีกลุ่มบริหารงาน
                </td>
              </tr>
            )}
          </tbody>
          {adminGroups.length > 0 && (
            <tfoot>
              <tr>
                <td className="text-right font-bold text-slate-700">รวมทั้งสิ้น</td>
                <td className="whitespace-nowrap text-right text-base font-bold text-navy-800 tabular-nums">
                  {formatBaht(total)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
