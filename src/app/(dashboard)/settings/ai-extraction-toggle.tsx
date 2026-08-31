"use client";

import { useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setAiExtractionEnabled as setAiExtractionEnabledAction } from "./actions";

export function AiExtractionToggle({
  enabled,
  setAiExtractionEnabled,
}: {
  enabled: boolean;
  setAiExtractionEnabled: typeof setAiExtractionEnabledAction;
}) {
  const [checked, setChecked] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next = !checked;
    setSaving(true);
    try {
      await setAiExtractionEnabled(next);
      setChecked(next);
    } catch (err) {
      await toastError(errorMessage(err));
      return;
    } finally {
      setSaving(false);
    }
    await toastSuccess(next ? "เปิดใช้งานปุ่ม AI อ่านไฟล์แล้ว" : "ปิดใช้งานปุ่ม AI อ่านไฟล์แล้ว");
  }

  return (
    <div className={saving ? "pointer-events-none opacity-60" : ""}>
      <ToggleSwitch
        checked={checked}
        onChange={handleToggle}
        labelOn="เปิดใช้งาน"
        labelOff="ปิดใช้งาน"
      />
    </div>
  );
}
