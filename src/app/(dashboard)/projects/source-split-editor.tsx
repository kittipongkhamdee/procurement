"use client";

// ตัวแก้ "แบ่งหลายแหล่งเงิน" ของกิจกรรม/โครงการงบก้อนเดียว ในหน้าแก้ไขโครงการ — บันทึกแยกจากฟอร์มหลัก (ปุ่มบันทึกของตัวเอง)

import { useRef, useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { saveSourceSplit } from "./actions";

type Option = { id: string; name: string };
type Source = { sourceId: string; name: string; amount: number };
type Row = { key: number; sourceId: string; amount: string };

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SourceSplitEditor({
  projectId,
  activityId,
  sources,
  defaultSourceId,
  currentBudget,
  budgetSources,
  onChanged,
}: {
  projectId: string;
  activityId: string | null;
  sources: Source[];
  /** แหล่งงบของโครงการ — ใช้เป็นแหล่งแรกตอนเริ่มแบ่ง */
  defaultSourceId: string | null;
  currentBudget: number;
  budgetSources: Option[];
  onChanged?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const counter = useRef(0);
  const nextKey = () => ++counter.current;

  function start() {
    setRows(
      sources.length > 0
        ? sources.map((x) => ({ key: nextKey(), sourceId: x.sourceId, amount: String(x.amount) }))
        : [{ key: nextKey(), sourceId: defaultSourceId ?? "", amount: String(currentBudget) }],
    );
    setEditing(true);
  }

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  async function save(clear = false) {
    setSaving(true);
    try {
      const result = await saveSourceSplit(
        projectId,
        activityId,
        clear ? [] : rows.map((r) => ({ budget_source_id: r.sourceId, amount: Number(r.amount || 0) })),
      );
      if (result.error) {
        await toastError(result.error);
        return;
      }
      await toastSuccess(clear ? "ยกเลิกการแบ่งแหล่งเงินแล้ว" : "บันทึกแหล่งเงินเรียบร้อยแล้ว");
      setEditing(false);
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {sources.length > 0 ? (
          <span>แหล่งเงิน: {sources.map((x) => `${x.name} ${fmt(x.amount)}`).join(" · ")}</span>
        ) : (
          <span>แหล่งเงิน: ตามแหล่งงบของโครงการ</span>
        )}
        <button type="button" onClick={start} className="font-medium text-navy-800 hover:underline">
          {sources.length > 0 ? "แก้ไขแหล่งเงิน" : "แบ่งหลายแหล่งเงิน"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[1fr_7.5rem_auto] items-center gap-2">
          <select
            value={r.sourceId}
            disabled={saving}
            onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, sourceId: e.target.value } : x)))}
            className="input text-sm"
            aria-label="แหล่งเงินงบประมาณ"
          >
            <option value="">เลือกแหล่งเงิน…</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id !== r.sourceId && rows.some((x) => x.sourceId === s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            value={r.amount}
            disabled={saving}
            onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))}
            className="input text-right text-sm"
            aria-label="จำนวนเงินจากแหล่งนี้"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
            className="btn-secondary btn-sm"
          >
            เอาออก
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setRows([...rows, { key: nextKey(), sourceId: "", amount: "0" }])}
          className="text-xs font-medium text-navy-800 hover:underline"
        >
          + เพิ่มแหล่งเงิน
        </button>
        <span className="text-sm font-semibold tabular-nums text-slate-800">รวม {fmt(total)} บาท</span>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {sources.length > 0 && (
          <button type="button" disabled={saving} onClick={() => save(true)} className="btn-secondary btn-sm">
            ยกเลิกการแบ่ง
          </button>
        )}
        <button type="button" disabled={saving} onClick={() => setEditing(false)} className="btn-secondary btn-sm">
          ปิด
        </button>
        <button type="button" disabled={saving || rows.length === 0} onClick={() => save()} className="btn-primary btn-sm">
          {saving ? "กำลังบันทึก..." : "บันทึกแหล่งเงิน"}
        </button>
      </div>
      <p className="text-xs text-slate-500">บันทึกแล้วงบจะเท่ากับผลรวมด้านบน (ปุ่มนี้บันทึกเฉพาะแหล่งเงิน แยกจากปุ่มบันทึกการแก้ไขด้านล่าง)</p>
    </div>
  );
}
