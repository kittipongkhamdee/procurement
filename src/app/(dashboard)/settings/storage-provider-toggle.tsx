"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/swal";
import type { setStorageProvider as setStorageProviderAction } from "./actions";

export function StorageProviderToggle({
  currentProvider,
  setStorageProvider,
}: {
  currentProvider: "supabase" | "google_drive";
  setStorageProvider: typeof setStorageProviderAction;
}) {
  const [provider, setProvider] = useState(currentProvider);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleToggle() {
    const next = provider === "google_drive" ? "supabase" : "google_drive";
    setChecking(true);
    setStatus(null);
    try {
      await setStorageProvider(next);
      setProvider(next);
      setStatus({
        ok: true,
        message: `เชื่อมต่อสำเร็จ อัปโหลดไฟล์ใหม่จะไปที่ ${next === "google_drive" ? "Google Drive" : "Supabase"} แล้ว`,
      });
    } catch (err) {
      setStatus({ ok: false, message: errorMessage(err) });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${provider === "supabase" ? "text-navy-800" : "text-slate-400"}`}>
          Supabase
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={provider === "google_drive"}
          disabled={checking}
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
      {checking && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
          กำลังตรวจสอบการเชื่อมต่อ...
        </p>
      )}
      {!checking && status && (
        <p className={`mt-2 text-xs font-medium ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
          {status.ok ? "✓ " : "✕ ไม่สามารถสลับปลายทางได้ — "}
          {status.message}
        </p>
      )}
    </div>
  );
}
