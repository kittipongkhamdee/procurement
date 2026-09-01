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
import { ChevronRightIcon, ClipboardCheckIcon, FolderIcon } from "@/components/icons";

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
      .select("token, title, opens_at, closes_at, plan_projects!inner(name, budget_year_id)")
      .eq("status", "published")
      .eq("plan_projects.budget_year_id", yearData.id);
    const now = new Date();
    // กรองแบบประเมินที่ยังไม่ถึงเวลาเปิด/หมดเวลารับคำตอบตามที่ตั้งไว้ออกจากรายการให้เลือก —
    // ไม่ต้องให้ผู้ตอบเลือกแล้วเจอข้อความ "ไม่พร้อมใช้งาน" ที่หน้าถัดไป
    const options = (formData ?? [])
      .filter((f) => !(f.opens_at && now < new Date(f.opens_at)) && !(f.closes_at && now > new Date(f.closes_at)))
      .map((f) => ({
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 text-sm text-navy-200">
        กำลังโหลด...
      </div>
    );
  }

  if (budgetYear === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <p className="text-sm text-slate-600">ไม่พบลิงก์แบบประเมินนี้</p>
        </div>
      </div>
    );
  }

  if (selectedToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 px-4 py-8">
        <SurveyTaker token={selectedToken} onBack={forms.length > 1 ? () => setSelectedToken(null) : undefined} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-6 py-8 text-center text-white sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold-400 bg-white/10 text-xl font-bold text-gold-400">
            ตว
          </div>
          <h1 className="mt-4 text-lg font-bold">แบบประเมินความพึงพอใจ</h1>
          <p className="mt-1 text-sm text-navy-200">โรงเรียนตาเบาวิทยา</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300">
            ปีงบประมาณ {budgetYear.year}
          </span>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {forms.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ClipboardCheckIcon className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">ยังไม่มีแบบประเมินที่เปิดรับคำตอบสำหรับปีงบประมาณนี้</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-500">เลือกโครงการที่ต้องการประเมินความพึงพอใจ</p>
              <div className="space-y-2.5">
                {forms.map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    onClick={() => setSelectedToken(f.token)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3.5 text-left transition hover:border-navy-600 hover:bg-navy-50 hover:shadow-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-800/10 text-navy-700 group-hover:bg-navy-800 group-hover:text-white">
                      <FolderIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900">{f.projectName}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{f.title}</span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-navy-700" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
