"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setApprovalSigner as setApprovalSignerAction } from "./actions";

const ROWS: { key: "approval_signer_planning" | "approval_signer_finance" | "approval_signer_deputy" | "approval_signer_director"; label: string }[] = [
  { key: "approval_signer_planning", label: "งานแผนงาน" },
  { key: "approval_signer_finance", label: "เจ้าหน้าที่การเงิน" },
  { key: "approval_signer_deputy", label: "รองผู้อำนวยการ" },
  { key: "approval_signer_director", label: "ผู้อำนวยการ" },
];

export function ApprovalSignersForm({
  signers,
  setApprovalSigner,
}: {
  signers: Record<string, string | null>;
  setApprovalSigner: typeof setApprovalSignerAction;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(ROWS.map((r) => [r.key, signers[r.key] ?? ""])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function handleSave(key: (typeof ROWS)[number]["key"]) {
    setSaving(key);
    try {
      const fd = new FormData();
      fd.set(key, values[key]);
      await setApprovalSigner(key, fd);
      await toastSuccess("บันทึกชื่อผู้ลงนามแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ROWS.map((row) => (
        <div key={row.key} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">{row.label}</label>
            <input
              value={values[row.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [row.key]: e.target.value }))}
              className="input"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSave(row.key)}
            disabled={saving === row.key}
            className="btn-secondary btn-sm shrink-0 disabled:opacity-50"
          >
            {saving === row.key ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      ))}
    </div>
  );
}
