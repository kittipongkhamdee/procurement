"use client";

// รูปแบบเลขที่เอกสารงานพัสดุ (งานซื้อ/ว 804, งานจ้าง, ว 119, เบิกค่าใช้จ่ายโครงการ) — ระบบใช้เสนอเลขที่ถัดไปในฟอร์ม
import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { DOC_NUMBER_KINDS, docNumberExample, docNumberTemplate } from "@/lib/doc-numbers";
import type { setDocNumberFormats as setDocNumberFormatsAction } from "./actions";

export function DocNumberFormatForm({
  values,
  setDocNumberFormats,
  onChanged,
}: {
  values: Record<string, string>;
  setDocNumberFormats: typeof setDocNumberFormatsAction;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(DOC_NUMBER_KINDS.map((k) => [k.key, docNumberTemplate(k.kind, values)])),
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setDocNumberFormats(new FormData(e.currentTarget));
      if (result?.error) {
        await toastError(result.error);
        return;
      }
      await toastSuccess("บันทึกรูปแบบเลขที่แล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-slate-500">
        ตัวแปร: <code>{"{n}"}</code> ลำดับที่ (นับใหม่ทุกปีงบประมาณ) · <code>{"{yyyy}"}</code> ปีงบประมาณ พ.ศ. · <code>{"{yy}"}</code> 2 หลักท้ายของปีงบ —
        เว้นว่าง = ไม่เสนอเลขอัตโนมัติ (กรอกเองหรือเว้นว่างในเอกสาร) · งานซื้อและ ว 804 นับเลขชุดเดียวกัน
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DOC_NUMBER_KINDS.map((k) => (
          <div key={k.key}>
            <label className="label">{k.label}</label>
            <input
              name={k.key}
              value={draft[k.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [k.key]: e.target.value }))}
              placeholder="เว้นว่าง = ไม่เสนอเลขอัตโนมัติ"
              autoComplete="off"
              className="input w-full font-mono"
            />
            <p className="mt-1 text-xs text-slate-500">ตัวอย่าง: {docNumberExample(draft[k.key])}</p>
          </div>
        ))}
      </div>
      <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "บันทึกรูปแบบเลขที่"}
      </button>
    </form>
  );
}
