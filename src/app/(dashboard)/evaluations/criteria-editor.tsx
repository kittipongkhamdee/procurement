"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import type { CriterionInput } from "./actions";

export type CriterionRow = CriterionInput;

export function emptyCriterion(): CriterionRow {
  return { min_score: 1, max_score: 5, label: "" };
}

export function CriteriaEditor({ rows, onChange }: { rows: CriterionRow[]; onChange: (next: CriterionRow[]) => void }) {
  function updateRow(i: number, patch: Partial<CriterionRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">กำหนดช่วงค่าเฉลี่ยและความหมาย (เรียงจากน้อยไปมาก) — ใช้แสดงระดับผลในหน้าสรุปผล</p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={row.min_score}
            onChange={(e) => updateRow(i, { min_score: Number(e.target.value) })}
            className="input w-20"
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            step="0.01"
            value={row.max_score}
            onChange={(e) => updateRow(i, { max_score: Number(e.target.value) })}
            className="input w-20"
          />
          <input
            value={row.label}
            onChange={(e) => updateRow(i, { label: e.target.value })}
            placeholder="ความหมาย เช่น ดีมาก"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            className="icon-btn-danger shrink-0"
            aria-label="ลบเกณฑ์"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      {rows.length === 0 && <p className="p-3 text-xs text-slate-400">ยังไม่มีเกณฑ์แปลผล</p>}

      <button type="button" onClick={() => onChange([...rows, emptyCriterion()])} className="btn-secondary btn-sm">
        <PlusIcon className="h-4 w-4" />
        เพิ่มช่วง
      </button>
    </div>
  );
}
