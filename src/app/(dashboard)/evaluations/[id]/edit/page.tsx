"use client";

// แก้ไขข้อมูลแบบประเมิน + รายการคำถาม แล้วเผยแพร่เพื่อรับลิงก์สาธารณะ — หน้านี้ใช้กับทั้งฟอร์มจริง
// (ผูกกับโครงการ) และ template คำถามมาตรฐาน (ของแอดมิน) เพราะโครงสร้างข้อมูลเหมือนกันทุกประการ
// ต่างกันแค่ template ไม่มีปุ่มเผยแพร่/ลิงก์สาธารณะ

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { toastSuccess, toastError, errorMessage } from "@/lib/swal";
import { ChevronLeftIcon } from "@/components/icons";
import { updateFormMeta, replaceQuestions, replaceCriteria, publishForm } from "../../actions";
import { QuestionListEditor, type QuestionRow } from "../../question-list-editor";
import { CriteriaEditor, type CriterionRow } from "../../criteria-editor";

type FormMeta = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  token: string;
  is_template: boolean;
  project_name: string | null;
};

export default function EvaluationEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormMeta | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [criteria, setCriteria] = useState<CriterionRow[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("eval_forms")
      .select("id, title, description, status, token, is_template, plan_projects(name)")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      const meta: FormMeta = {
        id: data.id,
        title: data.title,
        description: data.description,
        status: data.status,
        token: data.token,
        is_template: data.is_template,
        project_name: (data.plan_projects as unknown as { name: string } | null)?.name ?? null,
      };
      setForm(meta);
      setTitle(meta.title);
      setDescription(meta.description ?? "");
    } else {
      setForm(null);
    }

    const { data: qData } = await supabase
      .from("eval_questions")
      .select("question_type, question_text, options, required, category")
      .eq("form_id", id)
      .order("sort_order");
    setQuestions(
      (qData ?? []).map((q) => ({
        question_type: q.question_type as QuestionRow["question_type"],
        question_text: q.question_text,
        options: (q.options as string[] | null) ?? [],
        required: q.required,
        category: q.category,
      })),
    );

    const { data: cData } = await supabase
      .from("eval_criteria")
      .select("min_score, max_score, label")
      .eq("form_id", id)
      .order("sort_order");
    setCriteria((cData ?? []).map((c) => ({ min_score: Number(c.min_score), max_score: Number(c.max_score), label: c.label })));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleSaveMeta(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingMeta(true);
    try {
      const fd = new FormData();
      fd.set("title", title);
      fd.set("description", description);
      await updateFormMeta(id, fd);
      await toastSuccess("บันทึกข้อมูลแบบประเมินแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleSaveQuestions() {
    setSavingQuestions(true);
    try {
      const fd = new FormData();
      fd.set("questions_json", JSON.stringify(questions));
      await replaceQuestions(id, fd);
      await toastSuccess("บันทึกคำถามแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingQuestions(false);
    }
  }

  async function handleSaveCriteria() {
    setSavingCriteria(true);
    try {
      const fd = new FormData();
      fd.set("criteria_json", JSON.stringify(criteria));
      await replaceCriteria(id, fd);
      await toastSuccess("บันทึกเกณฑ์แปลผลแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingCriteria(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await publishForm(id);
      await toastSuccess("เผยแพร่แบบประเมินแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setPublishing(false);
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
          <h1 className="page-title">{form.is_template ? "แก้ไข Template" : "แก้ไขแบบประเมิน"}</h1>
          {form.project_name && <p className="page-subtitle">โครงการ: {form.project_name}</p>}
        </div>
        <button type="button" onClick={() => router.push(`/evaluations/${id}`)} className="btn-secondary">
          ดูผลสรุป
        </button>
      </div>

      <form onSubmit={handleSaveMeta} className="card mb-6">
        <div className="card-title">ข้อมูลแบบประเมิน</div>
        <div className="space-y-3">
          <div>
            <label className="label">ชื่อแบบประเมิน</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="input" />
          </div>
          <div>
            <label className="label">คำอธิบาย (แสดงให้ผู้ตอบเห็น)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" />
          </div>
        </div>
        <button type="submit" disabled={savingMeta} className="btn-primary mt-3">
          {savingMeta ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </form>

      <div className="card mb-6">
        <div className="card-title">คำถาม</div>
        <QuestionListEditor rows={questions} onChange={setQuestions} />
        <button type="button" onClick={handleSaveQuestions} disabled={savingQuestions} className="btn-primary mt-4">
          {savingQuestions ? "กำลังบันทึก..." : "บันทึกคำถาม"}
        </button>
      </div>

      <div className="card mb-6">
        <div className="card-title">เกณฑ์แปลผล</div>
        <CriteriaEditor rows={criteria} onChange={setCriteria} />
        <button type="button" onClick={handleSaveCriteria} disabled={savingCriteria} className="btn-primary mt-4">
          {savingCriteria ? "กำลังบันทึก..." : "บันทึกเกณฑ์"}
        </button>
      </div>

      {!form.is_template && (
        <div className="card">
          <div className="card-title">เผยแพร่</div>
          {form.status === "draft" ? (
            <button type="button" onClick={handlePublish} disabled={publishing} className="btn-primary">
              {publishing ? "กำลังเผยแพร่..." : "เผยแพร่แบบประเมิน"}
            </button>
          ) : (
            <div>
              <p className="mb-2 text-sm text-slate-600">ลิงก์แบบประเมิน (แจกให้นักเรียน/ผู้เกี่ยวข้อง ไม่ต้องล็อกอิน):</p>
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
