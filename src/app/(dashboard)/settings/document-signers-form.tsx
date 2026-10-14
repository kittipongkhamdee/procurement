"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { DOCUMENT_SIGNERS } from "@/lib/document-signers";
import type { setDocumentSigners as setDocumentSignersAction } from "./actions";

export function DocumentSignersForm({
  values,
  teacherNames,
  setDocumentSigners,
  onChanged,
}: {
  values: Record<string, string>;
  teacherNames: string[];
  setDocumentSigners: typeof setDocumentSignersAction;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setDocumentSigners(new FormData(e.currentTarget));
      if (result?.error) {
        await toastError(result.error);
        return;
      }
      await toastSuccess("บันทึกผู้ลงนามแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <datalist id="document-signer-names">
        {teacherNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DOCUMENT_SIGNERS.map((s) => (
          <div key={s.key}>
            <label className="label">{s.label}</label>
            <input
              name={s.key}
              defaultValue={values[s.key] ?? s.fallback}
              list="document-signer-names"
              autoComplete="off"
              className="input w-full"
            />
          </div>
        ))}
      </div>
      <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "บันทึกผู้ลงนาม"}
      </button>
    </form>
  );
}
