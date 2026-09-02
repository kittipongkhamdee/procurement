"use client";

// ส่วนทำแบบประเมินจริง (ดึงคำถาม+ส่งคำตอบตาม token) — แยกออกมาจาก /survey/[token] เดิม เพื่อใช้ซ้ำ
// กับหน้าลิงก์รวมต่อปีงบประมาณ (/survey/year/[year]) ที่ผู้ตอบเลือกโครงการเองก่อนแล้วค่อยโหลดคำถาม
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
  category: string | null;
};
type Form = { id: string; title: string; description: string | null };
type Availability = "loading" | "not_found" | "not_yet" | "ended" | "ok";

const NO_CATEGORY = "ความพึงพอใจ";

/** จัดคำถามเป็น 3 หมวดตามชนิดคำถามเสมอ (ตัวเลือก = ข้อมูลส่วนตัว, Likert = ความพึงพอใจ
 * แบ่งย่อยตาม category, ปลายเปิด = ข้อเสนอแนะ) — ให้ตรงกับดีไซน์อ้างอิงที่ผู้ใช้ส่งมา */
function groupQuestions(questions: Question[]) {
  const personal = questions.filter((q) => q.question_type === "choice");
  const satisfaction = questions.filter((q) => q.question_type === "likert");
  const suggestions = questions.filter((q) => q.question_type === "text");

  const categories = new Map<string, Question[]>();
  for (const q of satisfaction) {
    const key = q.category || NO_CATEGORY;
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key)!.push(q);
  }

  return { personal, satisfactionByCategory: Array.from(categories.entries()), suggestions };
}

export function SurveyTaker({ token, onBack }: { token: string; onBack?: () => void }) {
  const [availability, setAvailability] = useState<Availability>("loading");
  const [form, setForm] = useState<Form | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: formData } = await supabase
      .from("eval_forms")
      .select("id, title, description, opens_at, closes_at")
      .eq("token", token)
      .eq("status", "published")
      .maybeSingle();

    if (!formData) {
      setAvailability("not_found");
      return;
    }
    const now = new Date();
    if (formData.opens_at && now < new Date(formData.opens_at)) {
      setAvailability("not_yet");
      return;
    }
    if (formData.closes_at && now > new Date(formData.closes_at)) {
      setAvailability("ended");
      return;
    }
    setForm(formData);
    setAvailability("ok");

    const { data: qData } = await supabase
      .from("eval_questions")
      .select("id, sort_order, question_type, question_text, options, required, category")
      .eq("form_id", formData.id)
      .order("sort_order");
    setQuestions((qData ?? []) as Question[]);
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

  if (availability === "loading") {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (availability !== "ok" || !form) {
    const message =
      availability === "not_yet"
        ? "แบบประเมินนี้ยังไม่ถึงเวลาเปิดรับคำตอบ กรุณากลับมาใหม่ในภายหลัง"
        : availability === "ended"
          ? "หมดเวลารับคำตอบของแบบประเมินนี้แล้ว"
          : "แบบประเมินนี้ไม่พร้อมใช้งาน หรือปิดรับคำตอบแล้ว";
    return (
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">{message}</p>
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

  const { personal, satisfactionByCategory, suggestions } = groupQuestions(questions);
  const sectionFlags = [personal.length > 0, satisfactionByCategory.length > 0, suggestions.length > 0];
  const [personalIndex, satisfactionIndex, suggestionsIndex] = sectionFlags.reduce<number[]>((acc, show) => {
    const prev = acc.at(-1) ?? 0;
    acc.push(show ? prev + 1 : prev);
    return acc;
  }, []);

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
        {personal.length > 0 && (
          <SurveySection index={personalIndex} title="ข้อมูลส่วนตัว">
            {personal.map((q) => (
              <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            ))}
          </SurveySection>
        )}

        {satisfactionByCategory.length > 0 && (
          <SurveySection index={satisfactionIndex} title="ความพึงพอใจ">
            <div className="space-y-5">
              {satisfactionByCategory.map(([category, qs]) => (
                <div key={category}>
                  {satisfactionByCategory.length > 1 && (
                    <p className="mb-2 text-sm font-semibold text-navy-800">{category}</p>
                  )}
                  <div className="space-y-4">
                    {qs.map((q) => (
                      <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SurveySection>
        )}

        {suggestions.length > 0 && (
          <SurveySection index={suggestionsIndex} title="ข้อเสนอแนะ">
            {suggestions.map((q) => (
              <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            ))}
          </SurveySection>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "กำลังส่ง..." : "ส่งแบบประเมิน"}
        </button>
      </form>
    </div>
  );
}

function SurveySection({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
          {index}
        </span>
        <h2 className="text-sm font-bold text-navy-900">{title}</h2>
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">{children}</div>
    </div>
  );
}

function QuestionField({ q, value, onChange }: { q: Question; value: string | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">
        {q.question_text} {q.required && <span className="text-red-500">*</span>}
      </label>

      {q.question_type === "likert" && (
        <div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(String(n))}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition ${
                  value === String(n)
                    ? "border-navy-700 bg-navy-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-navy-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>น้อยที่สุด</span>
            <span>มากที่สุด</span>
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
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.question_type === "text" && (
        <textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input" />
      )}
    </div>
  );
}
