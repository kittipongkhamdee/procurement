"use client";

// แท็บ "จัดสรรเงิน" — สรุปยอดรวมแต่ละรายการจากแท็บ "รายรับ" + งบประมาณจัดทำโครงการ (ก่อนเข้าสู่
// ส่วนกรอกจำนวนเงินให้แต่ละกลุ่มบริหารงานเอง)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError } from "@/lib/swal";
import { upsertGroupAllocation } from "./actions";
import { computeItemTotal, ITEM_DEFS, rateKey, type GradeKey, type ItemKey } from "./revenue-calc";

type Group = { id: string; name: string };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function GroupAllocationTab({ budgetYearId, adminGroups }: { budgetYearId: string; adminGroups: Group[] }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: allocData }, { data: countsData }, { data: ratesData }] = await Promise.all([
      supabase.from("plan_group_allocations").select("admin_group_id, allocated_amount").eq("budget_year_id", budgetYearId),
      supabase.from("plan_student_counts").select("grade_key, student_count").eq("budget_year_id", budgetYearId),
      supabase
        .from("plan_revenue_rates")
        .select("item_key, grade_key, rate_per_student")
        .eq("budget_year_id", budgetYearId),
    ]);

    const nextAmounts: Record<string, number> = {};
    for (const row of allocData ?? []) nextAmounts[row.admin_group_id] = Number(row.allocated_amount);
    setAmounts(nextAmounts);

    const nextCounts: Partial<Record<GradeKey, number>> = {};
    for (const row of countsData ?? []) nextCounts[row.grade_key as GradeKey] = Number(row.student_count);
    setCounts(nextCounts);

    const nextRates: Record<string, number> = {};
    for (const row of ratesData ?? [])
      nextRates[rateKey(row.item_key as ItemKey, row.grade_key as GradeKey)] = Number(row.rate_per_student);
    setRates(nextRates);

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

  const itemTotals = ITEM_DEFS.map((item) => ({
    key: item.key,
    label: item.label,
    total: computeItemTotal(item.grades, item.key, counts, rates),
  }));
  const itemTotalByKey = Object.fromEntries(itemTotals.map((i) => [i.key, i.total])) as Record<ItemKey, number>;
  const revenueGrandTotal = itemTotals.reduce((sum, item) => sum + item.total, 0);

  const projectRows = [
    {
      label: "ค่าจัดการเรียนการสอน + Topup นร.น้อยกว่า 300 คน",
      amount: itemTotalByKey.teaching + itemTotalByKey.topup,
    },
    { label: "ค่ากิจกรรมพัฒนาผู้เรียน", amount: itemTotalByKey.student_activity },
  ];
  const projectTotal = projectRows.reduce((sum, r) => sum + r.amount, 0);

  const groupTotal = adminGroups.reduce((sum, g) => sum + (amounts[g.id] ?? 0), 0);

  return (
    <div>
      <div className="card-title mb-2 text-base font-bold text-navy-800">สรุปรวมรายรับแต่ละรายการ</div>
      <div className="table-shell mb-6">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-14 text-center">ลำดับ</th>
              <th>รายการ</th>
              <th className="whitespace-nowrap text-right">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {itemTotals.map((item, i) => (
              <tr key={item.key}>
                <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                <td className="font-medium text-slate-900">{item.label}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="text-right font-bold text-slate-700">
                รวมประมาณการรายรับทั้งสิ้น
              </td>
              <td className="whitespace-nowrap text-right text-base font-bold text-navy-800 tabular-nums">
                {formatBaht(revenueGrandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card-title mb-2 text-base font-bold text-navy-800">งบประมาณจัดทำโครงการ</div>
      <div className="table-shell mb-6">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-14 text-center">ลำดับ</th>
              <th>รายการ</th>
              <th className="whitespace-nowrap text-right">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.map((r, i) => (
              <tr key={r.label}>
                <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                <td className="font-medium text-slate-900">{r.label}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="text-right font-bold text-slate-700">
                รวม
              </td>
              <td className="whitespace-nowrap text-right text-base font-bold text-navy-800 tabular-nums">
                {formatBaht(projectTotal)} บาท
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card-title mb-2 text-base font-bold text-navy-800">จัดสรรงบประมาณตามกลุ่มบริหารงาน</div>
      <p className="mb-4 text-sm text-slate-500">
        กรอกจำนวนเงินงบประมาณที่จัดสรรให้แต่ละกลุ่มบริหารงานสำหรับปีงบประมาณนี้ — เทียบได้กับยอดรวม
        &quot;งบประมาณจัดทำโครงการ&quot; ด้านบน
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
                  {formatBaht(groupTotal)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {(() => {
        const diff = groupTotal - projectTotal;
        const isMatch = Math.abs(diff) < 0.005;
        return (
          <div
            className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border px-4 py-3 text-sm ${
              isMatch ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
          >
            <span className="text-slate-600">
              รวมจัดสรรงบประมาณตามกลุ่มบริหารงาน:{" "}
              <span className="font-semibold text-navy-800">{formatBaht(groupTotal)}</span>
            </span>
            <span className="text-slate-600">
              รวมงบประมาณจัดทำโครงการ: <span className="font-semibold text-navy-800">{formatBaht(projectTotal)}</span>
            </span>
            <span className={`font-semibold ${isMatch ? "text-emerald-700" : "text-red-700"}`}>
              {isMatch
                ? "ยอดเงินเท่ากัน — ถูกต้อง"
                : `ยอดเงินไม่เท่ากัน — ต่างกัน ${formatBaht(Math.abs(diff))} บาท (${diff > 0 ? "จัดสรรเกินงบประมาณ" : "จัดสรรไม่ครบ"})`}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
