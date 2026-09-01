"use client";

// ส่วนทำแบบประเมินจริง (ดึงคำถาม+ส่งคำตอบตาม token) — แยกออกมาจาก /survey/[token] เดิม เพื่อใช้ซ้ำ
// กับหน้าลิงก์รวมต่อปีงบประมาณ (/survey/year/[id]) ที่ผู้ตอบเลือกโครงการเองก่อนแล้วค่อยโหลดคำถาม
// ของฟอร์มนั้นด้วย component นี้ — พฤติกรรม/ความปลอดภัย RLS เหมือนเดิมทุกประการ (ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  sort_order: number;
  question_type: "likert" | "choice" | "text";
  question_text: string;
  options: string[] | null;
  required: boolean;
};
type Form = { id: string; title: string; description: string | null };

export function SurveyTaker({ token, onBack }: { token: string; onBack?: () => void }) {
  const [form, setForm] = useState<Form | null | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: formData } = await supabase
      .from("eval_forms")
      .select("id, title, description")
      .eq("token", token)
      .eq("status", "published")
      .maybeSingle();
    setForm(formData ?? null);

    if (formData) {
      const { data: qData } = await supabase
        .from("eval_questions")
        .select("id, sort_order, question_type, question_text, options, required")
        .eq("form_id", formData.id)
        .order("sort_order");
      setQuestions((qData ?? []) as Question[]);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;

    for (const q of questions) {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        setError("กรุณาตอบคำถามที่มีเครื่องหมาย * ให้ครบทุกข้อ");
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      // สร้าง id เองฝั่ง client แทนการอ่านค่ากลับจาก .select() หลัง insert — เพราะ anon ไม่มีสิทธิ์
      // SELECT ตาราง eval_responses เลย (ป้องกันไม่ให้อ่านคำตอบดิบของคนอื่นได้) การขอ RETURNING
      // กลับมาจึงติด RLS เสมอแม้ insert จะผ่านเงื่อนไข WITH CHECK แล้วก็ตาม
      const responseId = crypto.randomUUID();
      const { error: respError } = await supabase
        .from("eval_responses")
        .insert({ id: responseId, form_id: form.id });
      if (respError) throw new Error(respError.message);

      const rows = questions
        .filter((q) => (answers[q.id] ?? "").trim() !== "")
        .map((q) => ({ response_id: responseId, question_id: q.id, answer_value: answers[q.id].trim() }));
      if (rows.length > 0) {
        const { error: ansError } = await supabase.from("eval_answers").insert(rows);
        if (ansError) throw new Error(ansError.message);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งแบบประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  if (form === undefined) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (form === null) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">แบบประเมินนี้ไม่พร้อมใช้งาน หรือปิดรับคำตอบแล้ว</p>
        {onBack && (
          <button type="button" onClick={onBack} className="mt-4 text-sm text-navy-800 hover:underline">
            ← เลือกโครงการอื่น
          </button>
        )}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-bold text-navy-900">ขอบคุณที่ให้ข้อมูล</p>
        <p className="mt-2 text-sm text-slate-500">คำตอบของท่านถูกบันทึกเรียบร้อยแล้ว</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-3 text-sm text-slate-500 hover:text-navy-800">
          ← เลือกโครงการอื่น
        </button>
      )}
      <h1 className="text-lg font-bold text-navy-900">{form.title}</h1>
      {form.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {questions.map((q, i) => (
          <div key={q.id}>
            <label className="label">
              {i + 1}. {q.question_text} {q.required && <span className="text-red-500">*</span>}
            </label>

            {q.question_type === "likert" && (
              <div>
                <p className="mb-1 text-xs text-slate-400">1 = น้อยที่สุด, 5 = มากที่สุด</p>
                <div className="flex items-center justify-between gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="flex flex-col items-center gap-1 text-xs text-slate-500">
                      <input
                        type="radio"
                        name={q.id}
                        value={n}
                        checked={answers[q.id] === String(n)}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(n) }))}
                        className="h-4 w-4"
                      />
                      {n}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {q.question_type === "choice" && (
              <div className="space-y-1.5 pt-1">
                {(q.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className="h-4 w-4"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === "text" && (
              <textarea
                rows={3}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="input"
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "กำลังส่ง..." : "ส่งแบบประเมิน"}
        </button>
      </form>
    </div>
  );
}
