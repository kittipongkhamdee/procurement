"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setApprovalDocNumberFormat as setApprovalDocNumberFormatAction } from "./actions";

export function ApprovalDocNumberForm({
  prefix,
  separator,
  setApprovalDocNumberFormat,
  onChanged,
}: {
  prefix: string;
  separator: string;
  setApprovalDocNumberFormat: typeof setApprovalDocNumberFormatAction;
  onChanged: () => void;
}) {
  const [prefixValue, setPrefixValue] = useState(prefix);
  const [separatorValue, setSeparatorValue] = useState(separator);
  const [saving, setSaving] = useState(false);

  const preview = `${prefixValue}1${separatorValue || "/"}2569`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("approval_doc_number_prefix", prefixValue);
      fd.set("approval_doc_number_separator", separatorValue);
      const result = await setApprovalDocNumberFormat(fd);
      if (result?.error) {
        await toastError(result.error);
        return;
      }
      await toastSuccess("บันทึกรูปแบบเลขที่หนังสือแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">คำนำหน้า (ไม่บังคับ)</label>
          <input value={prefixValue} onChange={(e) => setPrefixValue(e.target.value)} placeholder="เช่น ที่ " className="input w-full" />
        </div>
        <div>
          <label className="label">ตัวคั่นระหว่างลำดับกับปีงบประมาณ</label>
          <input value={separatorValue} onChange={(e) => setSeparatorValue(e.target.value)} placeholder="/" className="input w-full" />
        </div>
      </div>
      <p className="text-sm text-slate-500">
        ตัวอย่าง: <span className="font-medium text-navy-800">{preview}</span>
      </p>
      <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "บันทึกรูปแบบ"}
      </button>
    </form>
  );
}
