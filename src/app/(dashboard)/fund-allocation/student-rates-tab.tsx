"use client";

// แท็บ "นักเรียนและรายหัว" — ข้อมูลตั้งต้นสำหรับคำนวณรายรับที่แท็บ "รายรับ":
// 1) จำนวนนักเรียน — กรอกแยกเป็นรายชั้น ม.1-ม.6 (ระบบรวม ม.1-3/ม.4-6 เป็นมัธยมต้น/ปลายให้อัตโนมัติ)
// 2) งบรายหัว — อัตราเงินอุดหนุนต่อคนต่อปีของแต่ละรายการ ปรับไม่บ่อย จึงมีปุ่มแก้ไข/บันทึกแยกจากการ
//    บันทึกอัตโนมัติแบบจำนวนนักเรียน
// 3) เงินรายได้สถานศึกษา — จำนวนเงินรายได้ของสถานศึกษาเอง (ไม่ได้มาจากเงินอุดหนุนรายหัว) กรอกเป็นยอดเดียว
//    ต่อปีงบประมาณ ปรับไม่บ่อยเช่นกัน จึงใช้ปุ่มแก้ไข/บันทึกแบบเดียวกับงบรายหัว

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { upsertRevenueRate, upsertSchoolIncome, upsertStudentCount } from "./actions";
import { GRADE_LABELS, ITEM_DEFS, TEXTBOOK_GRADES, gradeCount, rateKey, type GradeKey, type ItemKey } from "./revenue-calc";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function StudentRatesTab({ budgetYearId }: { budgetYearId: string }) {
  const [counts, setCounts] = useState<Partial<Record<GradeKey, number>>>({});
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({});
  const [countsEditing, setCountsEditing] = useState(false);
  const [savingCounts, setSavingCounts] = useState(false);

  const [rates, setRates] = useState<Record<string, number>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [ratesEditing, setRatesEditing] = useState(false);
  const [savingRates, setSavingRates] = useState(false);

  const [schoolIncome, setSchoolIncome] = useState(0);
  const [schoolIncomeDraft, setSchoolIncomeDraft] = useState<string | null>(null);
  const [schoolIncomeEditing, setSchoolIncomeEditing] = useState(false);
  const [savingSchoolIncome, setSavingSchoolIncome] = useState(false);

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

  function handleCancelCounts() {
    setCountDrafts({});
    setCountsEditing(false);
  }

  async function handleSaveCounts() {
    setSavingCounts(true);
    try {
      for (const [grade, raw] of Object.entries(countDrafts)) {
        if (raw.trim() === "") continue;
        const num = Number(raw);
        if (Number.isNaN(num) || num < 0) {
          await toastError("กรุณากรอกจำนวนนักเรียนให้ถูกต้องทุกช่อง");
          setSavingCounts(false);
          return;
        }
        if (num === (counts[grade as GradeKey] ?? 0)) continue;
        await upsertStudentCount(budgetYearId, grade, num);
        setCounts((prev) => ({ ...prev, [grade]: num }));
      }
      setCountDrafts({});
      setCountsEditing(false);
      await toastSuccess("บันทึกจำนวนนักเรียนเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingCounts(false);
    }
  }

  function handleCancelRates() {
    setRateDrafts({});
    setRatesEditing(false);
  }

  async function handleSaveRates() {
    setSavingRates(true);
    try {
      for (const [key, raw] of Object.entries(rateDrafts)) {
        if (raw.trim() === "") continue;
        const num = Number(raw);
        if (Number.isNaN(num) || num < 0) {
          await toastError("กรุณากรอกจำนวนเงินให้ถูกต้องทุกช่อง");
          setSavingRates(false);
          return;
        }
        if (num === (rates[key] ?? 0)) continue;
        const [itemKey, gradeKey] = key.split(":") as [ItemKey, GradeKey];
        await upsertRevenueRate(budgetYearId, itemKey, gradeKey, num);
        setRates((prev) => ({ ...prev, [key]: num }));
      }
      setRateDrafts({});
      setRatesEditing(false);
      await toastSuccess("บันทึกงบรายหัวเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingRates(false);
    }
  }

  function handleCancelSchoolIncome() {
    setSchoolIncomeDraft(null);
    setSchoolIncomeEditing(false);
  }

  async function handleSaveSchoolIncome() {
    const raw = schoolIncomeDraft;
    if (raw === null || raw.trim() === "" || Number(raw) === schoolIncome) {
      setSchoolIncomeDraft(null);
      setSchoolIncomeEditing(false);
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setSavingSchoolIncome(true);
    try {
      await upsertSchoolIncome(budgetYearId, num);
      setSchoolIncome(num);
      setSchoolIncomeDraft(null);
      setSchoolIncomeEditing(false);
      await toastSuccess("บันทึกเงินรายได้สถานศึกษาเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingSchoolIncome(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-slate-400">กำลังโหลด...</p>;

  const lowerTotal = gradeCount("lower_secondary", counts);
  const upperTotal = gradeCount("upper_secondary", counts);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title text-base font-bold text-navy-800">จำนวนนักเรียน</div>
          {!countsEditing ? (
            <button type="button" onClick={() => setCountsEditing(true)} className="btn-secondary btn-sm">
              แก้ไข
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelCounts}
                disabled={savingCounts}
                className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveCounts}
                disabled={savingCounts}
                className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingCounts ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          กรอกจำนวนนักเรียนแยกตามชั้น — ระบบจะรวมชั้น ม.1-3 เป็น &quot;มัธยมศึกษาตอนต้น&quot; และ ม.4-6 เป็น
          &quot;มัธยมศึกษาตอนปลาย&quot; ให้อัตโนมัติ นำไปใช้คำนวณต่อที่แท็บ &quot;รายรับ&quot; — ต้องกด
          &quot;แก้ไข&quot; ก่อนจึงจะเปลี่ยนค่าได้
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TEXTBOOK_GRADES.map((g) => (
            <div key={g}>
              <label className="label">{GRADE_LABELS[g]}</label>
              {countsEditing ? (
                <input
                  type="number"
                  value={countDrafts[g] ?? counts[g] ?? 0}
                  onChange={(e) => setCountDrafts((prev) => ({ ...prev, [g]: e.target.value }))}
                  className="input"
                />
              ) : (
                <div className="input bg-slate-100 text-slate-700">{counts[g] ?? 0}</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-500">
          <span>
            รวมมัธยมศึกษาตอนต้น (ม.1-3): <span className="font-semibold text-navy-800">{lowerTotal}</span> คน
          </span>
          <span>
            รวมมัธยมศึกษาตอนปลาย (ม.4-6): <span className="font-semibold text-navy-800">{upperTotal}</span> คน
          </span>
          <span>
            รวมนักเรียนทั้งหมด: <span className="font-semibold text-navy-800">{lowerTotal + upperTotal}</span> คน
          </span>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title text-base font-bold text-navy-800">งบรายหัว (บาท/คน/ปี)</div>
          {!ratesEditing ? (
            <button type="button" onClick={() => setRatesEditing(true)} className="btn-secondary btn-sm">
              แก้ไข
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelRates}
                disabled={savingRates}
                className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveRates}
                disabled={savingRates}
                className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingRates ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          อัตราเงินอุดหนุนรายหัวต่อคนต่อปี แยกตามรายการและระดับชั้น — เนื่องจากปรับไม่บ่อย ต้องกด
          &quot;แก้ไข&quot; ก่อนจึงจะเปลี่ยนค่าได้
        </p>
        <div className="table-shell">
          <table className="table-base">
            <thead>
              <tr>
                <th>รายการ</th>
                <th className="whitespace-nowrap">ระดับชั้น</th>
                <th className="whitespace-nowrap text-right">บาท/คน/ปี</th>
              </tr>
            </thead>
            <tbody>
              {ITEM_DEFS.map((item) => {
                const grades = item.grades === "all" ? (["all"] as const) : item.grades;
                return (
                  <Fragment key={item.key}>
                    {grades.map((g, i) => {
                      const isAll = g === "all";
                      const key = rateKey(item.key, g as GradeKey);
                      const rate = rates[key] ?? 0;
                      const draft = rateDrafts[key];
                      return (
                        <tr key={key}>
                          {i === 0 && (
                            <td rowSpan={grades.length} className="align-top font-medium text-slate-900">
                              {item.label}
                            </td>
                          )}
                          <td className="whitespace-nowrap">{isAll ? "นักเรียนทั้งหมด" : GRADE_LABELS[g as GradeKey]}</td>
                          <td className="whitespace-nowrap text-right">
                            {ratesEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={draft ?? rate}
                                onChange={(e) => setRateDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                className="input w-28 text-right"
                              />
                            ) : (
                              <span className="tabular-nums">{formatBaht(rate)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title text-base font-bold text-navy-800">เงินรายได้สถานศึกษา</div>
          {!schoolIncomeEditing ? (
            <button type="button" onClick={() => setSchoolIncomeEditing(true)} className="btn-secondary btn-sm">
              แก้ไข
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelSchoolIncome}
                disabled={savingSchoolIncome}
                className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveSchoolIncome}
                disabled={savingSchoolIncome}
                className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingSchoolIncome ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-slate-500">
          จำนวนเงินรายได้ของสถานศึกษาเอง (นอกเหนือจากเงินอุดหนุนรายหัว) — เนื่องจากปรับไม่บ่อย ต้องกด
          &quot;แก้ไข&quot; ก่อนจึงจะเปลี่ยนค่าได้
        </p>
        <div className="max-w-xs">
          <label className="label">จำนวนเงิน (บาท/ปี)</label>
          {schoolIncomeEditing ? (
            <input
              type="number"
              step="0.01"
              value={schoolIncomeDraft ?? schoolIncome}
              onChange={(e) => setSchoolIncomeDraft(e.target.value)}
              className="input"
            />
          ) : (
            <div className="input bg-slate-100 text-slate-700">{formatBaht(schoolIncome)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
