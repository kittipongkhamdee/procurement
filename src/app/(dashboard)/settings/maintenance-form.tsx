"use client";

import { useState } from "react";
import { confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/components/maintenance-page";
import type { setMaintenanceMode as setMaintenanceModeAction } from "./actions";

export function MaintenanceForm({
  enabled,
  message,
  setMaintenanceMode,
}: {
  enabled: boolean;
  message: string | null;
  setMaintenanceMode: typeof setMaintenanceModeAction;
}) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(message ?? "");
  const [saving, setSaving] = useState(false);

  async function save(nextOn: boolean, successText: string) {
    setSaving(true);
    try {
      const result = await setMaintenanceMode(nextOn, text);
      if (result.error) {
        await toastError(result.error);
        return;
      }
      setOn(nextOn);
      await toastSuccess(successText);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!on) {
      const ok = await confirmWarning({
        title: "เปิดโหมดปิดปรับปรุงระบบ?",
        text: "ผู้ใช้ทุกคนที่ไม่ใช่ผู้ดูแลระบบจะใช้งานระบบไม่ได้จนกว่าคุณจะปิดโหมดนี้ (ผู้ดูแลระบบยังใช้งานได้ตามปกติ)",
        confirmButtonText: "เปิดโหมดปิดปรับปรุง",
      });
      if (!ok) return;
      await save(true, "เปิดโหมดปิดปรับปรุงแล้ว");
    } else {
      await save(false, "เปิดระบบให้ใช้งานตามปกติแล้ว");
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3 ${
          on ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="text-sm">
          <span className={`font-bold ${on ? "text-amber-800" : "text-emerald-700"}`}>
            {on ? "ขณะนี้ระบบปิดปรับปรุงอยู่" : "ขณะนี้ระบบเปิดใช้งานตามปกติ"}
          </span>
          <p className="text-xs text-slate-500">
            {on ? "ผู้ใช้ที่ไม่ใช่ผู้ดูแลระบบเห็นหน้าปิดปรับปรุง" : "ทุกคนใช้งานระบบได้"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          className={on ? "btn-primary btn-sm" : "btn-danger btn-sm"}
        >
          {saving ? "กำลังบันทึก..." : on ? "เปิดระบบให้ใช้งานตามปกติ" : "เปิดโหมดปิดปรับปรุง"}
        </button>
      </div>

      <div>
        <label className="label">ข้อความที่แสดงในหน้าปิดปรับปรุง (ไม่บังคับ)</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={DEFAULT_MAINTENANCE_MESSAGE}
          className="input"
        />
        <p className="mt-1 text-xs text-slate-500">
          เว้นว่างไว้จะใช้ข้อความเริ่มต้น เช่น ระบุเวลาที่คาดว่าจะเปิดใช้งานอีกครั้งได้
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <a href="/?maintenance_preview=1" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            ดูตัวอย่างหน้าปิดปรับปรุง
          </a>
          <button
            type="button"
            onClick={() => save(on, "บันทึกข้อความแล้ว")}
            disabled={saving}
            className="btn-secondary btn-sm"
          >
            บันทึกข้อความ
          </button>
        </div>
      </div>
    </div>
  );
}
