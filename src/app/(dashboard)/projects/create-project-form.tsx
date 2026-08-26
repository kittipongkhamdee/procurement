"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";

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

  function handleSubmit(formData: FormData) {
    formData.set("activities_json", JSON.stringify(rows));
    return action(formData);
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
        <div className="table-shell mb-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>ชื่อกิจกรรม</th>
                <th className="text-right">งบประมาณ</th>
                <th>ผู้รับผิดชอบ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="p-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      className="input"
                      placeholder={`กิจกรรมที่ ${i + 1}`}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.budget}
                      onChange={(e) => updateRow(i, { budget: e.target.value })}
                      className="input text-right"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={row.responsible}
                      onChange={(e) => updateRow(i, { responsible: e.target.value })}
                      className="input"
                    />
                  </td>
                  <td className="p-2 text-right">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label="ลบแถวนี้"
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-2 text-right text-sm font-semibold text-slate-600">รวมงบประมาณ</td>
                <td className="px-2 py-2 text-right text-sm font-bold text-navy-800">{formatBaht(totalBudget)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
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
