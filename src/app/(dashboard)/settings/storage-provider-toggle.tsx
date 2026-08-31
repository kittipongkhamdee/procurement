"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setStorageProvider as setStorageProviderAction } from "./actions";

export function StorageProviderToggle({
  currentProvider,
  driveConfigured,
  setStorageProvider,
}: {
  currentProvider: "supabase" | "google_drive";
  driveConfigured: boolean;
  setStorageProvider: typeof setStorageProviderAction;
}) {
  const [provider, setProvider] = useState(currentProvider);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const next = provider === "google_drive" ? "supabase" : "google_drive";
    if (next === "google_drive" && !driveConfigured) {
      await toastError('ยังไม่ได้ตั้งค่า Google Drive (Service Account / Folder ID) กรุณาตั้งค่าก่อนเปลี่ยนมาใช้งาน');
      return;
    }
    setSaving(true);
    try {
      await setStorageProvider(next);
      setProvider(next);
      await toastSuccess(next === "google_drive" ? "เปลี่ยนไปใช้ Google Drive แล้ว" : "เปลี่ยนไปใช้ Supabase แล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium ${provider === "supabase" ? "text-navy-800" : "text-slate-400"}`}>
        Supabase
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={provider === "google_drive"}
        disabled={saving}
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          provider === "google_drive" ? "bg-navy-800" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            provider === "google_drive" ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${provider === "google_drive" ? "text-navy-800" : "text-slate-400"}`}>
        Google Drive
      </span>
    </div>
  );
}
