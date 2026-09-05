"use client";

// แท็บ "รายรับ" — ประมาณการรายรับงบอุดหนุนรายหัว = จำนวนนักเรียน × อัตราต่อคนต่อปี (แสดงผลอย่างเดียว)
// จำนวนนักเรียนและอัตราแก้ไขได้ที่แท็บ "นักเรียนและรายหัว" เท่านั้น

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeItemTotal, GRADE_LABELS, ITEM_DEFS, itemGradeCount, rateKey, type GradeKey, type ItemKey } from "./revenue-calc";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function RevenueTab({ budgetYearId }: { budgetYearId: string }) {
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [schoolIncome, setSchoolIncome] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: countsData }, { data: ratesData }, { data: incomeData }] = await Promise.all([
      supabase.from("plan_student_counts").select("grade_key, student_count").eq("budget_year_id", budgetYearId),
      supabase
        .from("plan_revenue_rates")
        .select("item_key, grade_key, rate_per_student")
        .eq("budget_year_id", budgetYearId),
      supabase.from("plan_school_income").select("amount").eq("budget_year_id", budgetYearId).maybeSingle(),
    ]);
    const nextCounts: Partial<Record<GradeKey, number>> = {};
    for (const row of countsData ?? []) nextCounts[row.grade_key as GradeKey] = Number(row.student_count);
    setCounts(nextCounts);

    const nextRates: Record<string, number> = {};
    for (const row of ratesData ?? [])
      nextRates[rateKey(row.item_key as ItemKey, row.grade_key as GradeKey)] = Number(row.rate_per_student);
    setRates(nextRates);

    setSchoolIncome(Number(incomeData?.amount ?? 0));
    setLoading(false);
  }, [budgetYearId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (loading) return <p className="p-4 text-sm text-slate-400">กำลังโหลด...</p>;

  const grandTotal =
    ITEM_DEFS.reduce((sum, item) => sum + computeItemTotal(item.grades, item.key, counts, rates), 0) + schoolIncome;

  return (
    <div>
      <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        จำนวนนักเรียนและอัตราเงินอุดหนุนรายหัวแก้ไขได้ที่แท็บ &quot;นักเรียนและรายหัว&quot; — หน้านี้แสดงผลการ
        คำนวณประมาณการรายรับเท่านั้น (ค่าหนังสือเรียนคำนวณแบบเลื่อนชั้น เช่น ม.2 ใช้จำนวนนักเรียน ม.1
        ปัจจุบัน เพราะเป็นกลุ่มที่จะเลื่อนขึ้นมาเรียน ม.2 ปีถัดไป — จำนวนที่แสดงในตารางจึงไม่ใช่จำนวน
        นักเรียนจริงของชั้นนั้นในปีนี้)
      </p>

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr>
              <th>ประเภทรายรับ</th>
              <th className="whitespace-nowrap">ระดับชั้น</th>
              <th className="whitespace-nowrap text-right">นักเรียน(คน)</th>
              <th className="whitespace-nowrap text-right">บาท/คน/ปี</th>
              <th className="whitespace-nowrap text-right">รวม(บาท)</th>
            </tr>
          </thead>
          <tbody>
            {ITEM_DEFS.map((item) => {
              const grades = item.grades === "all" ? (["all"] as const) : item.grades;
              const itemTotal = computeItemTotal(item.grades, item.key, counts, rates);
              return (
                <Fragment key={item.key}>
                  {grades.map((g, i) => {
                    const isAll = g === "all";
                    const count = itemGradeCount(item.key, g, counts);
                    const rate = rates[rateKey(item.key, g as GradeKey)] ?? 0;
                    return (
                      <tr key={`${item.key}-${g}`}>
                        {i === 0 && (
                          <td rowSpan={grades.length} className="align-top font-medium text-slate-900">
                            {item.label}
                          </td>
                        )}
                        <td className="whitespace-nowrap">{isAll ? "นักเรียนทั้งหมด" : GRADE_LABELS[g as GradeKey]}</td>
                        <td className="whitespace-nowrap text-right tabular-nums text-slate-500">{count}</td>
                        <td className="whitespace-nowrap text-right tabular-nums text-slate-500">{formatBaht(rate)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(count * rate)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={4} className="text-right text-slate-600">
                      รวม {item.label}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-navy-800">
                      {formatBaht(itemTotal)}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            <tr>
              <td className="font-medium text-slate-900">เงินรายได้สถานศึกษา</td>
              <td className="whitespace-nowrap">-</td>
              <td className="whitespace-nowrap text-right tabular-nums text-slate-500">-</td>
              <td className="whitespace-nowrap text-right tabular-nums text-slate-500">-</td>
              <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(schoolIncome)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="text-right font-bold text-slate-700">
                รวมประมาณการรายรับทั้งสิ้น
              </td>
              <td className="whitespace-nowrap text-right text-base font-bold text-navy-800 tabular-nums">
                {formatBaht(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
