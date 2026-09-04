"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;

type ActivityRow = { name: string; budget: string; responsible: string[] };

function emptyRow(): ActivityRow {
  return { name: "", budget: "", responsible: [] };
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function CreateProjectForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
  teachers,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  onSuccess?: () => void;
}) {
  const [hasActivities, setHasActivities] = useState(true);
  const [rows, setRows] = useState<ActivityRow[]>([emptyRow()]);

  function updateRow(index: number, patch: Partial<ActivityRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const totalBudget = rows.reduce((sum, r) => sum + (parseFloat(r.budget) || 0), 0);

  async function handleSubmit(formData: FormData) {
    formData.set("activities_json", JSON.stringify(rows));
    try {
      await action(formData);
      await toastSuccess("เพิ่มโครงการเรียบร้อยแล้ว");
      onSuccess?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="budget_year_id" value={budgetYearId} />
      <div>
        <label className="label">ชื่อโครงการ</label>
        <input name="name" required className="input" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">กลุ่มบริหาร</label>
          <select name="admin_group_id" required defaultValue="" className="input">
            <option value="" disabled>
              เลือกกลุ่มบริหาร..
            </option>
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">แหล่งเงินงบประมาณ</label>
          <select name="budget_source_id" defaultValue="" className="input">
            <option value="">ไม่ระบุ</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 border-t border-slate-100 pt-4">
        <div className="card-title text-base font-bold text-navy-800">กิจกรรมย่อย</div>
        <input type="hidden" name="has_activities" value={hasActivities ? "yes" : "no"} />
        <div className="mb-3 flex items-center gap-3 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={hasActivities}
            onClick={() => setHasActivities((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              hasActivities ? "bg-navy-800" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                hasActivities ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="font-medium text-slate-700">
            {hasActivities ? "มีกิจกรรมย่อย" : "ไม่มีกิจกรรมย่อย"}
          </span>
        </div>

        {hasActivities ? (
          <>
            <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
              <div className="hidden grid-cols-[1fr_7rem_8rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                <div>ชื่อกิจกรรม</div>
                <div>งบประมาณ</div>
                <div>ผู้รับผิดชอบ</div>
                <div></div>
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_7rem_8rem_3.5rem] sm:items-center"
                  >
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      className="input"
                      placeholder={`กิจกรรมที่ ${i + 1}`}
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={row.budget}
                      onChange={(e) => updateRow(i, { budget: e.target.value })}
                      className="input text-right"
                      placeholder="งบประมาณ"
                    />
                    <TeacherMultiSelect
                      teachers={teachers}
                      value={row.responsible}
                      onChange={(next) => updateRow(i, { responsible: next })}
                    />
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="btn-danger btn-sm sm:justify-self-end"
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-600">รวมงบประมาณ</span>
                <span className="font-bold text-navy-800">{formatBaht(totalBudget)}</span>
              </div>
            </div>
            <button type="button" onClick={addRow} className="btn-secondary btn-sm">
              + เพิ่มกิจกรรม
            </button>
          </>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            กำหนดงบประมาณโครงการได้ที่เมนู &quot;การจัดสรรเงิน&quot; หลังบันทึกโครงการนี้แล้ว
          </p>
        )}
      </div>

      <button type="submit" className="btn-primary mt-2">
        บันทึกโครงการ
      </button>
    </form>
  );
}
