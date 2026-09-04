"use client";

// แท็บ "รายรับ" — ประมาณการรายรับงบอุดหนุนรายหัว = จำนวนนักเรียน × อัตราต่อคนต่อปี
// ช่องกรอกจำนวนนักเรียนมีแค่ 2 ช่องหลัก (ม.ต้น/ม.ปลาย) ใช้ร่วมกันในหลายรายการ (ตามไฟล์ต้นฉบับของ
// โรงเรียน) ส่วนค่าหนังสือเรียนแยกอิสระตามชั้นปี ม.1-ม.6 เพราะจำนวนไม่ตรงกับ ม.ต้น/ม.ปลาย

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError } from "@/lib/swal";
import { upsertRevenueRate, upsertStudentCount } from "./actions";

type GradeKey = "lower_secondary" | "upper_secondary" | "m1" | "m2" | "m3" | "m4" | "m5" | "m6";
type ItemKey = "teaching" | "student_activity" | "topup" | "equipment" | "uniform" | "textbook";

const GRADE_LABELS: Record<GradeKey, string> = {
  lower_secondary: "มัธยมศึกษาตอนต้น",
  upper_secondary: "มัธยมศึกษาตอนปลาย",
  m1: "มัธยมศึกษาปีที่ 1",
  m2: "มัธยมศึกษาปีที่ 2",
  m3: "มัธยมศึกษาปีที่ 3",
  m4: "มัธยมศึกษาปีที่ 4",
  m5: "มัธยมศึกษาปีที่ 5",
  m6: "มัธยมศึกษาปีที่ 6",
};

const MAIN_GRADES: GradeKey[] = ["lower_secondary", "upper_secondary"];
const TEXTBOOK_GRADES: GradeKey[] = ["m1", "m2", "m3", "m4", "m5", "m6"];

const ITEM_DEFS: { key: ItemKey; label: string; grades: GradeKey[] | "all" }[] = [
  { key: "teaching", label: "ค่าจัดการเรียนการสอน", grades: MAIN_GRADES },
  { key: "student_activity", label: "ค่ากิจกรรมพัฒนาผู้เรียน", grades: MAIN_GRADES },
  { key: "topup", label: "Topup นร.น้อยกว่า 300 คน", grades: "all" },
  { key: "equipment", label: "ค่าอุปกรณ์การเรียน", grades: MAIN_GRADES },
  { key: "uniform", label: "ค่าเครื่องแบบนักเรียน", grades: MAIN_GRADES },
  { key: "textbook", label: "ค่าหนังสือเรียน", grades: TEXTBOOK_GRADES },
];

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function rateKey(item: ItemKey, grade: GradeKey) {
  return `${item}:${grade}`;
}

export function RevenueTab({ budgetYearId }: { budgetYearId: string }) {
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: countsData }, { data: ratesData }] = await Promise.all([
      supabase.from("plan_student_counts").select("grade_key, student_count").eq("budget_year_id", budgetYearId),
      supabase
        .from("plan_revenue_rates")
        .select("item_key, grade_key, rate_per_student")
        .eq("budget_year_id", budgetYearId),
    ]);
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

  function getCount(grade: GradeKey) {
    return counts[grade] ?? 0;
  }

  async function handleCountChange(grade: GradeKey, value: string) {
    const num = Number(value);
    if (value === "" || Number.isNaN(num) || num < 0) return;
    setCounts((prev) => ({ ...prev, [grade]: num }));
    const key = `count:${grade}`;
    setSavingKey(key);
    try {
      await upsertStudentCount(budgetYearId, grade, num);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleRateChange(item: ItemKey, grade: GradeKey, value: string) {
    const num = Number(value);
    if (value === "" || Number.isNaN(num) || num < 0) return;
    const key = rateKey(item, grade);
    setRates((prev) => ({ ...prev, [key]: num }));
    setSavingKey(key);
    try {
      await upsertRevenueRate(budgetYearId, item, grade, num);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p className="p-4 text-sm text-slate-400">กำลังโหลด...</p>;

  const grandTotal = ITEM_DEFS.reduce((sum, item) => {
    const grades = item.grades === "all" ? (["all"] as const) : item.grades;
    return (
      sum +
      grades.reduce((s, g) => {
        const count = g === "all" ? getCount("lower_secondary") + getCount("upper_secondary") : getCount(g);
        const rate = rates[rateKey(item.key, g as GradeKey)] ?? 0;
        return s + count * rate;
      }, 0)
    );
  }, 0);

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <label className="label">จำนวนนักเรียน มัธยมศึกษาตอนต้น</label>
          <input
            type="number"
            value={getCount("lower_secondary")}
            onChange={(e) => handleCountChange("lower_secondary", e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">จำนวนนักเรียน มัธยมศึกษาตอนปลาย</label>
          <input
            type="number"
            value={getCount("upper_secondary")}
            onChange={(e) => handleCountChange("upper_secondary", e.target.value)}
            className="input"
          />
        </div>
        <p className="col-span-full text-xs text-slate-500">
          กรอกจำนวนนักเรียน 2 ช่องนี้ที่เดียว — รายการ ค่าจัดการเรียนการสอน/ค่ากิจกรรมพัฒนาผู้เรียน/
          ค่าอุปกรณ์การเรียน/ค่าเครื่องแบบนักเรียน/Topup จะอัปเดตจำนวนตามอัตโนมัติ
        </p>
      </div>

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
              const itemTotal = grades.reduce((s, g) => {
                const count = g === "all" ? getCount("lower_secondary") + getCount("upper_secondary") : getCount(g);
                const rate = rates[rateKey(item.key, g as GradeKey)] ?? 0;
                return s + count * rate;
              }, 0);
              return (
                <Fragment key={item.key}>
                  {grades.map((g, i) => {
                    const isAll = g === "all";
                    const count = isAll ? getCount("lower_secondary") + getCount("upper_secondary") : getCount(g);
                    const rate = rates[rateKey(item.key, g as GradeKey)] ?? 0;
                    return (
                      <tr key={`${item.key}-${g}`}>
                        {i === 0 && (
                          <td rowSpan={grades.length} className="align-top font-medium text-slate-900">
                            {item.label}
                          </td>
                        )}
                        <td className="whitespace-nowrap">{isAll ? "นักเรียนทั้งหมด" : GRADE_LABELS[g as GradeKey]}</td>
                        <td className="whitespace-nowrap text-right tabular-nums text-slate-500">
                          {isAll ? count : (
                            <input
                              type="number"
                              value={count}
                              onChange={(e) => handleCountChange(g as GradeKey, e.target.value)}
                              disabled={item.key !== "textbook" || savingKey === `count:${g}`}
                              className="input w-24 text-right disabled:bg-slate-100"
                            />
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={rate}
                            onChange={(e) => handleRateChange(item.key, g as GradeKey, e.target.value)}
                            disabled={savingKey === rateKey(item.key, g as GradeKey)}
                            className="input w-28 text-right disabled:bg-slate-100"
                          />
                        </td>
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
