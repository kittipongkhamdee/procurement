"use client";

import { useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setGeminiApiKey as setGeminiApiKeyAction, setGeminiModel as setGeminiModelAction } from "./actions";

export function GeminiKeyForm({
  currentKey,
  currentModel,
  setGeminiApiKey,
  setGeminiModel,
}: {
  currentKey: string | null;
  currentModel: string | null;
  setGeminiApiKey: typeof setGeminiApiKeyAction;
  setGeminiModel: typeof setGeminiModelAction;
}) {
  const [value, setValue] = useState(currentKey ?? "");
  const [visible, setVisible] = useState(false);
  const [model, setModel] = useState(currentModel ?? "gemini-2.5-flash");

  async function handleSubmitKey(formData: FormData) {
    try {
      await setGeminiApiKey(formData);
      await toastSuccess("บันทึก API Key เรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleSubmitModel(formData: FormData) {
    try {
      await setGeminiModel(formData);
      await toastSuccess("บันทึกโมเดลเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <form action={handleSubmitKey} className="flex flex-wrap gap-2">
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
      <form action={handleSubmitModel} className="flex flex-wrap items-center gap-2">
        <label className="label mb-0 shrink-0">โมเดล</label>
        <input
          name="gemini_model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="เช่น gemini-2.5-flash"
          className="input min-w-0 flex-1"
          autoComplete="off"
        />
        <button type="submit" className="btn-secondary shrink-0">
          บันทึกโมเดล
        </button>
      </form>
    </div>
  );
}
