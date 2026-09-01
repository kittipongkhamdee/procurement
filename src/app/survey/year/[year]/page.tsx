"use client";

// ลิงก์รวมแบบประเมินต่อปีงบประมาณ — 1 ลิงก์ถาวร ครอบคลุมทุกโครงการ (ทุกครู) ที่มีแบบประเมิน
// เปิดรับคำตอบอยู่ในปีงบประมาณนั้น ไม่ต้องล็อกอิน ใช้ "เลขปีงบประมาณ" (พ.ศ. เช่น 2569) ตรงๆ เป็น
// ส่วนหนึ่งของลิงก์แทน uuid เพื่อให้จำง่าย/สั้นลง (plan_budget_years.year มี unique constraint
// อยู่แล้ว จึงใช้แทน id ได้ปลอดภัย — ไม่ใช่ข้อมูลอ่อนไหว อ่านได้แบบ public อยู่แล้วผ่าน
// plan_budget_years_public_select) ถ้ามีแบบประเมินเปิดรับคำตอบอยู่แค่โครงการเดียว ข้ามหน้าเลือกไปเลย

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SurveyTaker } from "../../survey-taker";

type BudgetYear = { id: string; year: number; name: string };
type FormOption = { token: string; title: string; projectName: string };

export default function SurveyYearLandingPage() {
  const { year } = useParams<{ year: string }>();
  const [budgetYear, setBudgetYear] = useState<BudgetYear | null | undefined>(undefined);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: yearData } = await supabase
      .from("plan_budget_years")
      .select("id, year, name")
      .eq("year", Number(year))
      .maybeSingle();
    setBudgetYear(yearData ?? null);
    if (!yearData) return;

    const { data: formData } = await supabase
      .from("eval_forms")
      .select("token, title, plan_projects!inner(name, budget_year_id)")
      .eq("status", "published")
      .eq("plan_projects.budget_year_id", yearData.id);
    const options = (formData ?? []).map((f) => ({
      token: f.token,
      title: f.title,
      projectName: (f.plan_projects as unknown as { name: string }).name,
    }));
    setForms(options);
    // ถ้ามีแบบประเมินเปิดรับคำตอบอยู่โครงการเดียว ข้ามหน้าเลือกไปทำแบบประเมินได้เลย
    if (options.length === 1) setSelectedToken(options[0].token);
  }, [year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (budgetYear === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (budgetYear === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">ไม่พบลิงก์แบบประเมินนี้</p>
        </div>
      </div>
    );
  }

  if (selectedToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
        <SurveyTaker token={selectedToken} onBack={forms.length > 1 ? () => setSelectedToken(null) : undefined} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-lg font-bold text-navy-900">แบบประเมินความพึงพอใจ</h1>
        <p className="mt-1 text-sm text-slate-500">ปีงบประมาณ {budgetYear.year} — เลือกโครงการที่ต้องการประเมิน</p>

        {forms.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">ยังไม่มีแบบประเมินที่เปิดรับคำตอบสำหรับปีงบประมาณนี้</p>
        ) : (
          <div className="mt-6 space-y-2">
            {forms.map((f) => (
              <button
                key={f.token}
                type="button"
                onClick={() => setSelectedToken(f.token)}
                className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-navy-600 hover:bg-navy-50"
              >
                <span className="font-medium text-navy-900">{f.projectName}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{f.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
