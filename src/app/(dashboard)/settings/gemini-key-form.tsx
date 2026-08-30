"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setGeminiApiKey as setGeminiApiKeyAction } from "./actions";

export function GeminiKeyForm({
  currentKey,
  setGeminiApiKey,
}: {
  currentKey: string | null;
  setGeminiApiKey: typeof setGeminiApiKeyAction;
}) {
  const [value, setValue] = useState(currentKey ?? "");
  const [visible, setVisible] = useState(false);

  async function handleSubmit(formData: FormData) {
    try {
      await setGeminiApiKey(formData);
      await toastSuccess("บันทึก API Key เรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap gap-2">
      <input
        type={visible ? "text" : "password"}
        name="gemini_api_key"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="วาง Gemini API Key ที่นี่"
        className="input min-w-0 flex-1"
        autoComplete="off"
      />
      <button type="button" onClick={() => setVisible((v) => !v)} className="btn-secondary shrink-0">
        {visible ? "ซ่อน" : "แสดง"}
      </button>
      <button type="submit" className="btn-primary shrink-0">
        บันทึก
      </button>
    </form>
  );
}
