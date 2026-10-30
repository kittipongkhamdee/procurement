"use client";

// ส่วน "แอดมินดำเนินการแทน (ข้ามขั้นตอน)" ที่ใช้ร่วมกันทุกหน้าที่มีขั้นตอนเห็นชอบ/อนุมัติ — แอดมินบันทึกผลแทนรองผู้อำนวยการ/ผู้อำนวยการ
// เมื่อท่านไม่สะดวกกดในระบบ โดยระบบบันทึกว่าแอดมินเป็นผู้บันทึกแทน (ดู lib/approval-proxy.ts) ผู้เรียกต้องส่ง steps ที่ทำได้ ณ สถานะปัจจุบัน
// และ onSubmit ที่ยืนยัน/เรียก server action/แจ้งผลเอง (โยน error เมื่อยกเลิกหรือบันทึกไม่สำเร็จ เพื่อให้ฟอร์มคงค่าไว้)

import { useState } from "react";

export type ProxyOption = { value: string; label: string; /** ผลที่ต้องกรอกความคิดเห็น เช่น ไม่เห็นชอบ/ไม่อนุมัติ */ needsNote?: boolean };
export type ProxyStep = { key: string; label: string; options: ProxyOption[] };

export function AdminProxyPanel({
  steps,
  onSubmit,
  hint,
}: {
  steps: ProxyStep[];
  onSubmit: (stepKey: string, value: string, note: string | undefined, reason: string | undefined) => Promise<void>;
  hint?: string;
}) {
  const [stepKey, setStepKey] = useState<string>(steps[steps.length - 1]?.key ?? "");
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (steps.length === 0) return null;
  const step = steps.find((s) => s.key === stepKey) ?? steps[steps.length - 1];
  const option = step.options.find((o) => o.value === choice) ?? null;
  const needsNote = !!option?.needsNote;

  async function save() {
    if (!option || (needsNote && !note.trim())) return;
    setSubmitting(true);
    try {
      await onSubmit(step.key, option.value, needsNote ? note.trim() : undefined, reason.trim() || undefined);
      setChoice(null);
      setNote("");
      setReason("");
    } catch {
      // แจ้งผู้ใช้แล้วจากฝั่งเรียก — คงค่าที่กรอกไว้ให้ลองใหม่ได้
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-amber-900">แอดมินดำเนินการแทน (ข้ามขั้นตอน)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-600">
          ใช้เมื่อรองผู้อำนวยการหรือผู้อำนวยการไม่สะดวกกดในระบบ — ระบบจะบันทึกว่าแอดมินเป็นผู้บันทึกแทน (พร้อมเหตุผลที่กรอก) ไม่ได้บันทึกเป็นการกดของท่านเอง
          และข้ามขั้นตอนก่อนหน้าที่ยังไม่ทำได้{hint ? ` · ${hint}` : ""}
        </p>
        {steps.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  setStepKey(s.key);
                  setChoice(null);
                }}
                className={s.key === step.key ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {steps.length === 1 && <p className="text-sm font-medium text-slate-700">{step.label}</p>}
        <div className="flex flex-wrap gap-2">
          {step.options.map((o) => (
            <button key={o.value} type="button" onClick={() => setChoice(o.value)} className={choice === o.value ? "btn-primary" : "btn-secondary"}>
              {o.label}
            </button>
          ))}
        </div>
        {needsNote && (
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="กรอกความคิดเห็นของท่าน (บังคับ)" rows={2} className="input w-full" />
        )}
        {option && (
          <>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              placeholder="เหตุผล/ช่องทางที่ได้รับความเห็น เช่น แจ้งทางไลน์ / สั่งด้วยวาจา (ไม่บังคับ แนะนำให้กรอก)"
              className="input w-full"
            />
            <button type="button" onClick={save} disabled={submitting || (needsNote && !note.trim())} className="btn-primary w-full">
              {submitting ? "กำลังบันทึก..." : "บันทึกแทน"}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
