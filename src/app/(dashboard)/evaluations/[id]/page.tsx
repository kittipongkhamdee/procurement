"use client";

// สรุปผลแบบประเมิน — Likert แสดงค่าเฉลี่ย+แท่งกระจายคะแนน 1-5, choice แสดงจำนวน/สัดส่วนต่อตัวเลือก,
// text แสดงเป็นรายการคำตอบทั้งหมด ใช้ CSS width% ธรรมดาแทนการเพิ่ม chart library ใหม่ให้เข้ากับ
// สไตล์เรียบง่ายเดิมของระบบ (ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { closeForm, deleteForm, publishForm } from "../actions";
import { ChevronLeftIcon } from "@/components/icons";
import { QuestionSummary } from "./question-summary";

type Question = {
  id: string;
  sort_order: number;
  question_type: "likert" | "choice" | "text";
  question_text: string;
  options: string[] | null;
};
type Form = {
  id: string;
  title: string;
  status: string;
  token: string;
  is_template: boolean;
  project_name: string | null;
};
type Answer = { question_id: string; answer_value: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "ฉบับร่าง",
  published: "กำลังเปิดรับคำตอบ",
  closed: "ปิดรับคำตอบแล้ว",
};

export default function EvaluationResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Form | null | undefined>(undefined);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [responseCount, setResponseCount] = useState(0);

  const reload = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("eval_forms")
      .select("id, title, status, token, is_template, plan_projects(name)")
      .eq("id", id)
      .maybeSingle();

    if (!data) {
      setForm(null);
      return;
    }
    setForm({
      id: data.id,
      title: data.title,
      status: data.status,
      token: data.token,
      is_template: data.is_template,
      project_name: (data.plan_projects as unknown as { name: string } | null)?.name ?? null,
    });

    const { data: qData } = await supabase
      .from("eval_questions")
      .select("id, sort_order, question_type, question_text, options")
      .eq("form_id", id)
      .order("sort_order");
    setQuestions((qData ?? []) as Question[]);

    const { data: responses } = await supabase.from("eval_responses").select("id").eq("form_id", id);
    setResponseCount(responses?.length ?? 0);
    const responseIds = (responses ?? []).map((r) => r.id);

    if (responseIds.length > 0) {
      const { data: answerData } = await supabase
        .from("eval_answers")
        .select("question_id, answer_value")
        .in("response_id", responseIds);
      setAnswers(answerData ?? []);
    } else {
      setAnswers([]);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleDelete() {
    if (!form) return;
    const ok = await confirmDelete({
      title: `ลบแบบประเมิน "${form.title}"?`,
      text: "คำตอบทั้งหมดจะถูกลบไปด้วยและไม่สามารถกู้คืนได้",
    });
    if (!ok) return;
    try {
      await deleteForm(form.id);
      await toastSuccess("ลบแบบประเมินเรียบร้อยแล้ว");
      router.push("/evaluations");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleToggleStatus() {
    if (!form) return;
    try {
      if (form.status === "published") await closeForm(form.id);
      else await publishForm(form.id);
      await toastSuccess(form.status === "published" ? "ปิดรับคำตอบแล้ว" : "เปิดรับคำตอบแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  if (form === undefined) return <PageLoadingSkeleton />;
  if (form === null) return <p className="p-4 text-sm text-red-600">ไม่พบแบบประเมินนี้</p>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/survey/${form.token}` : "";

  return (
    <div>
      <Link href="/evaluations" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปรายการแบบประเมิน
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">{form.title}</h1>
          <p className="page-subtitle">
            {form.project_name && `โครงการ: ${form.project_name} · `}
            ผู้ตอบแบบประเมิน {responseCount} คน
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/evaluations/${form.id}/edit`} className="btn-secondary">
            แก้ไข
          </Link>
          <button type="button" onClick={handleDelete} className="btn-danger">
            ลบ
          </button>
        </div>
      </div>

      {!form.is_template && (
        <div className="card mb-6">
          <div className="card-title">ลิงก์แบบประเมิน</div>
          {form.status === "draft" ? (
            <p className="text-sm text-slate-500">ยังไม่เผยแพร่ — ไปที่หน้าแก้ไขเพื่อเผยแพร่แบบประเมิน</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{link}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toastSuccess("คัดลอกลิงก์แล้ว");
                }}
                className="btn-secondary btn-sm"
              >
                คัดลอกลิงก์
              </button>
              <button type="button" onClick={handleToggleStatus} className="btn-secondary btn-sm">
                {form.status === "published" ? "ปิดรับคำตอบ" : "เปิดรับคำตอบอีกครั้ง"}
              </button>
              <span className={form.status === "published" ? "badge-emerald" : "badge-navy"}>
                {STATUS_LABELS[form.status] ?? form.status}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {questions.map((q, i) => {
          const qAnswers = answers.filter((a) => a.question_id === q.id);
          return (
            <div key={q.id} className="card">
              <div className="card-title">
                {i + 1}. {q.question_text}
              </div>

              {q.question_type === "likert" &&
                (() => {
                  const total = qAnswers.length;
                  const avg = total > 0 ? qAnswers.reduce((s, a) => s + Number(a.answer_value), 0) / total : 0;
                  const rows = [1, 2, 3, 4, 5].map((n) => ({
                    label: String(n),
                    count: qAnswers.filter((a) => a.answer_value === String(n)).length,
                  }));
                  return (
                    <div>
                      <p className="mb-3 text-sm text-slate-600">
                        คะแนนเฉลี่ย {avg.toFixed(2)} / 5 ({total} คำตอบ)
                      </p>
                      <QuestionSummary rows={rows} total={total} />
                    </div>
                  );
                })()}

              {q.question_type === "choice" &&
                (() => {
                  const total = qAnswers.length;
                  const rows = (q.options ?? []).map((opt) => ({
                    label: opt,
                    count: qAnswers.filter((a) => a.answer_value === opt).length,
                  }));
                  return total === 0 ? (
                    <p className="text-xs text-slate-400">ยังไม่มีคำตอบ</p>
                  ) : (
                    <QuestionSummary rows={rows} total={total} />
                  );
                })()}

              {q.question_type === "text" && (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {qAnswers.length === 0 && <p className="text-xs text-slate-400">ยังไม่มีคำตอบ</p>}
                  {qAnswers.map((a, idx) => (
                    <p key={idx} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {a.answer_value}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
