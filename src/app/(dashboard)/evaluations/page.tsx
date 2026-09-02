"use client";

// Client Component ตามแพทเทิร์นเดียวกับ /projects — ดึงรายการแบบประเมิน + template ผ่าน browser
// Supabase client, ครูเห็นเฉพาะแบบประเมินของตัวเอง (created_by = ตัวเอง) ส่วนแอดมินเห็นของทุกคน
// และจัดการ template คำถามมาตรฐานได้เพิ่ม (ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { toastSuccess, toastError, errorMessage } from "@/lib/swal";
import { CreateFormModal } from "./create-form-modal";
import { CreateTemplateModal } from "./create-template-modal";
import { QrCodeButton } from "./qr-code-button";
import { createForm, createTemplate, publishForm, closeForm } from "./actions";

type Project = { id: string; name: string };
type Template = { id: string; title: string; description: string | null };
type FormRow = { id: string; title: string; status: string; project_name: string | null };
type BudgetYear = { id: string; year: number };

const STATUS_LABELS: Record<string, string> = {
  draft: "ฉบับร่าง",
  published: "กำลังเปิดรับคำตอบ",
  closed: "ปิดรับคำตอบแล้ว",
};

export default function EvaluationsPage() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const [forms, setForms] = useState<FormRow[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentYear, setCurrentYear] = useState<BudgetYear | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [existingProjectIds, setExistingProjectIds] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const supabase = createClient();

    const { data: budgetYears } = await supabase
      .from("plan_budget_years")
      .select("id, year, is_open")
      .order("year", { ascending: false });
    setCurrentYear(budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null);

    const { data: templateData } = await supabase
      .from("eval_forms")
      .select("id, title, description")
      .eq("is_template", true)
      .order("created_at");
    setTemplates(templateData ?? []);

    const { data: projectData } = await supabase.from("plan_projects").select("id, name").order("sort_order");
    setProjects(projectData ?? []);

    let query = supabase
      .from("eval_forms")
      .select("id, title, status, project_id, plan_projects(name)")
      .eq("is_template", false)
      .order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("created_by", user?.userId ?? "");
    const { data: formData } = await query;
    setForms(
      (formData ?? []).map((f) => ({
        id: f.id,
        title: f.title,
        status: f.status,
        project_name: (f.plan_projects as unknown as { name: string } | null)?.name ?? null,
      })),
    );
    setExistingProjectIds((formData ?? []).map((f) => f.project_id).filter((id): id is string => !!id));
  }, [isAdmin, user?.userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!authLoading) reload();
  }, [authLoading, reload]);

  async function handleToggleStatus(form: FormRow) {
    setTogglingId(form.id);
    try {
      if (form.status === "published") await closeForm(form.id);
      else await publishForm(form.id);
      await toastSuccess(form.status === "published" ? "ปิดรับคำตอบแล้ว" : "เปิดรับคำตอบแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  if (forms === null) return <PageLoadingSkeleton />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ประเมินความพึงพอใจ</h1>
          <p className="page-subtitle">สร้างแบบประเมินความพึงพอใจโครงการ แจกลิงก์ให้ผู้ตอบโดยไม่ต้องล็อกอิน</p>
        </div>
        <CreateFormModal
          projects={projects}
          templates={templates}
          existingProjectIds={existingProjectIds}
          createForm={createForm}
        />
      </div>

      {currentYear && (
        <div className="card mb-6">
          <div className="card-title">ลิงก์รวมแบบประเมิน ปีงบประมาณ {currentYear.year}</div>
          <p className="mb-2 text-sm text-slate-500">
            ลิงก์เดียวใช้ได้ตลอดปีงบประมาณ ผู้ตอบเลือกโครงการเองจากรายการแบบประเมินที่กำลังเปิดรับคำตอบ
            (ข้ามขั้นตอนเลือกให้อัตโนมัติถ้ามีแบบประเมินเปิดอยู่แค่โครงการเดียว)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {typeof window !== "undefined" ? `${window.location.origin}/survey/year/${currentYear.year}` : ""}
            </code>
            <button
              type="button"
              onClick={() => {
                const link = `${window.location.origin}/survey/year/${currentYear.year}`;
                navigator.clipboard.writeText(link);
                toastSuccess("คัดลอกลิงก์แล้ว");
              }}
              className="btn-secondary btn-sm"
            >
              คัดลอกลิงก์
            </button>
            {typeof window !== "undefined" && (
              <QrCodeButton
                value={`${window.location.origin}/survey/year/${currentYear.year}`}
                filename={`qr-แบบประเมิน-ปีงบ${currentYear.year}.png`}
              />
            )}
          </div>
        </div>
      )}

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr>
              <th className="w-12 text-right">ลำดับที่</th>
              <th>ชื่อแบบประเมิน</th>
              <th>โครงการ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f, i) => (
              <tr key={f.id}>
                <td className="text-right text-slate-500">{i + 1}</td>
                <td>
                  <Link href={`/evaluations/${f.id}`} className="block max-w-xs whitespace-normal break-words font-medium text-navy-800 hover:underline">
                    {f.title}
                  </Link>
                </td>
                <td className="max-w-[10rem] whitespace-normal break-words">{f.project_name ?? "-"}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(f)}
                    disabled={togglingId === f.id}
                    className={`${f.status === "published" ? "badge-emerald" : "badge-navy"} disabled:cursor-not-allowed disabled:opacity-50`}
                    title={
                      f.status === "published"
                        ? "คลิกเพื่อปิดรับคำตอบ"
                        : f.status === "draft"
                          ? "คลิกเพื่อเผยแพร่และเปิดรับคำตอบ"
                          : "คลิกเพื่อเปิดรับคำตอบอีกครั้ง"
                    }
                  >
                    {STATUS_LABELS[f.status] ?? f.status}
                  </button>
                </td>
                <td className="text-right">
                  <Link href={`/evaluations/${f.id}`} className="text-xs font-medium text-navy-800 hover:underline">
                    ดูผลสรุป
                  </Link>
                </td>
              </tr>
            ))}
            {forms.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  ยังไม่มีแบบประเมิน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="mt-8">
          <div className="page-header">
            <div>
              <h2 className="text-base font-bold text-slate-900">Template คำถามมาตรฐาน</h2>
              <p className="page-subtitle">ให้ครูเลือกใช้เป็นจุดเริ่มต้นตอนสร้างแบบประเมิน</p>
            </div>
            <CreateTemplateModal createTemplate={createTemplate} />
          </div>
          <div className="table-shell">
            <table className="table-base">
              <thead>
                <tr>
                  <th>ชื่อ Template</th>
                  <th>คำอธิบาย</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td className="max-w-xs whitespace-normal break-words">{t.title}</td>
                    <td className="max-w-md whitespace-normal break-words text-slate-500">{t.description ?? "-"}</td>
                    <td className="text-right">
                      <Link href={`/evaluations/${t.id}/edit`} className="text-xs font-medium text-navy-800 hover:underline">
                        แก้ไข
                      </Link>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      ยังไม่มี template
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
