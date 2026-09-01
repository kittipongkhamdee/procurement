"use client";

import { PlusIcon, TrashIcon } from "@/components/icons";
import type { QuestionInput } from "./actions";

export type QuestionRow = QuestionInput;

export function emptyQuestion(): QuestionRow {
  return { question_type: "likert", question_text: "", options: [], required: true, category: null };
}

const TYPE_LABELS: Record<QuestionRow["question_type"], string> = {
  likert: "คะแนนความพึงพอใจ (1-5)",
  choice: "ตัวเลือก",
  text: "คำถามปลายเปิด",
};

export function QuestionListEditor({
  rows,
  onChange,
}: {
  rows: QuestionRow[];
  onChange: (next: QuestionRow[]) => void;
}) {
  function updateRow(i: number, patch: Partial<QuestionRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  const existingCategories = Array.from(new Set(rows.map((r) => r.category).filter((c): c is string => !!c)));

  return (
    <div className="space-y-3">
      <datalist id="eval-category-suggestions">
        {existingCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200/80 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">ข้อ {i + 1}</span>
            <select
              value={row.question_type}
              onChange={(e) => updateRow(i, { question_type: e.target.value as QuestionRow["question_type"] })}
              className="input w-auto text-xs"
            >
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={row.required}
                onChange={(e) => updateRow(i, { required: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              บังคับตอบ
            </label>
          </div>

          <input
            value={row.question_text}
            onChange={(e) => updateRow(i, { question_text: e.target.value })}
            placeholder="ข้อความคำถาม"
            className="input mb-2"
          />

          {row.question_type === "likert" && (
            <input
              value={row.category ?? ""}
              onChange={(e) => updateRow(i, { category: e.target.value || null })}
              placeholder="หมวดหมู่ (ไม่บังคับ) เช่น ด้านการบริการ, ด้านกิจกรรม — ใช้จัดกลุ่มคำถามในหน้าทำแบบประเมิน/สรุปผล"
              list="eval-category-suggestions"
              className="input"
            />
          )}

          {row.question_type === "choice" && (
            <textarea
              value={row.options.join("\n")}
              onChange={(e) => updateRow(i, { options: e.target.value.split("\n") })}
              placeholder={"พิมพ์ตัวเลือกบรรทัดละ 1 ข้อ เช่น\nดีมาก\nดี\nพอใช้\nควรปรับปรุง"}
              rows={3}
              className="input"
            />
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => moveRow(i, -1)}
              disabled={i === 0}
              className="btn-secondary btn-sm disabled:opacity-30"
            >
              ขึ้น
            </button>
            <button
              type="button"
              onClick={() => moveRow(i, 1)}
              disabled={i === rows.length - 1}
              className="btn-secondary btn-sm disabled:opacity-30"
            >
              ลง
            </button>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              className="icon-btn-danger"
              aria-label="ลบคำถาม"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {rows.length === 0 && <p className="p-3 text-xs text-slate-400">ยังไม่มีคำถาม</p>}

      <button type="button" onClick={() => onChange([...rows, emptyQuestion()])} className="btn-secondary btn-sm">
        <PlusIcon className="h-4 w-4" />
        เพิ่มคำถาม
      </button>
    </div>
  );
}
