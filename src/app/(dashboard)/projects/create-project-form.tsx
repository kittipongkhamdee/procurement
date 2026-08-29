"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;

type ActivityRow = { name: string; budget: string; responsible: string };

function emptyRow(): ActivityRow {
  return { name: "", budget: "", responsible: "" };
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function CreateProjectForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
}) {
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
        <div className="card-title">กิจกรรมย่อย (ไม่บังคับ)</div>
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[1fr_7rem_8rem_2.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>ชื่อกิจกรรม</div>
            <div className="text-right">งบประมาณ</div>
            <div>ผู้รับผิดชอบ</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_7rem_8rem_2.5rem] sm:items-center">
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
                <input
                  value={row.responsible}
                  onChange={(e) => updateRow(i, { responsible: e.target.value })}
                  className="input"
                  placeholder="ผู้รับผิดชอบ"
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label="ลบแถวนี้"
                    className="text-xs font-medium text-red-600 hover:underline sm:text-right"
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
      </div>

      <button type="submit" className="btn-primary mt-2">
        บันทึกโครงการ
      </button>
    </form>
  );
}
