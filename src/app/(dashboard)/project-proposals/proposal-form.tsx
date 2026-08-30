"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;

type ActivityRow = { name: string; period: string; responsible: string[] };
type EvaluationRow = { indicator: string; method: string; tool: string };

function emptyActivity(): ActivityRow {
  return { name: "", period: "", responsible: [] };
}

function emptyEvaluation(): EvaluationRow {
  return { indicator: "", method: "", tool: "" };
}

export function ProposalForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
  teachers,
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
}) {
  const [responsible, setResponsible] = useState<string[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([emptyActivity()]);
  const [evaluationItems, setEvaluationItems] = useState<EvaluationRow[]>([emptyEvaluation()]);

  function updateActivity(index: number, patch: Partial<ActivityRow>) {
    setActivities((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function updateEvaluation(index: number, patch: Partial<EvaluationRow>) {
    setEvaluationItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(formData: FormData) {
    formData.set("activities_json", JSON.stringify(activities));
    formData.set("evaluation_items_json", JSON.stringify(evaluationItems));
    try {
      await action(formData);
      await toastSuccess("ส่งข้อเสนอโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="budget_year_id" value={budgetYearId} />

      <div>
        <div className="card-title">ข้อมูลทั่วไป</div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">ชื่อโครงการ</label>
            <input name="name" required className="input" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">แผนงาน</label>
              <input name="plan_name" className="input" placeholder="เช่น แผนงานวิชาการ" />
            </div>
            <div>
              <label className="label">สนองมาตรฐาน</label>
              <input name="standard" className="input" placeholder="เช่น มาตรฐานที่ ๑" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">ลักษณะโครงการ</label>
              <select name="project_type" defaultValue="ใหม่" className="input">
                <option value="ใหม่">โครงการใหม่</option>
                <option value="ต่อเนื่อง">โครงการต่อเนื่อง</option>
              </select>
            </div>
            <div>
              <label className="label">หน่วยงานที่รับผิดชอบ</label>
              <select name="admin_group_id" required defaultValue="" className="input">
                <option value="" disabled>
                  เลือกกลุ่มบริหาร..
                </option>
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <TeacherMultiSelect teachers={teachers} value={responsible} onChange={setResponsible} />
            {responsible.map((n) => (
              <input key={n} type="hidden" name="responsible" value={n} />
            ))}
          </div>
          <div>
            <label className="label">สนองกลยุทธ์ / ประเด็นกลยุทธ์ที่</label>
            <input name="strategy_alignment" className="input" placeholder="เช่น กลยุทธ์ที่ ๒" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">วันที่เริ่มต้น</label>
              <input type="date" name="start_date" className="input" />
            </div>
            <div>
              <label className="label">วันที่สิ้นสุด</label>
              <input type="date" name="end_date" className="input" />
            </div>
            <div>
              <label className="label">แหล่งเงินงบประมาณ</label>
              <select name="budget_source_id" defaultValue="" className="input">
                <option value="">ไม่ระบุ</option>
                {budgetSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">งบประมาณที่ใช้ (บาท)</label>
            <input type="number" step="0.01" name="budget_amount" className="input" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="label">๑. หลักการและเหตุผล</label>
        <textarea name="rationale" rows={4} className="input" />
      </div>

      <div>
        <label className="label">๒. วัตถุประสงค์</label>
        <textarea name="objectives" rows={3} className="input" placeholder="ระบุเป็นข้อ ๆ" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">๓. เป้าหมายเชิงปริมาณ</label>
          <textarea name="target_quantity" rows={3} className="input" />
        </div>
        <div>
          <label className="label">เป้าหมายเชิงคุณภาพ</label>
          <textarea name="target_quality" rows={3} className="input" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">๔. กิจกรรม / ขั้นตอนการดำเนินงาน</div>
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[1fr_8rem_10rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>กิจกรรม/ขั้นตอน</div>
            <div>ระยะเวลา</div>
            <div>ผู้รับผิดชอบ</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {activities.map((row, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_8rem_10rem_3.5rem] sm:items-center">
                <input
                  value={row.name}
                  onChange={(e) => updateActivity(i, { name: e.target.value })}
                  className="input"
                  placeholder={`กิจกรรมที่ ${i + 1}`}
                />
                <input
                  value={row.period}
                  onChange={(e) => updateActivity(i, { period: e.target.value })}
                  className="input"
                  placeholder="เช่น พ.ค. 2569"
                />
                <TeacherMultiSelect
                  teachers={teachers}
                  value={row.responsible}
                  onChange={(next) => updateActivity(i, { responsible: next })}
                />
                {activities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setActivities((prev) => prev.filter((_, idx) => idx !== i))}
                    className="btn-danger btn-sm sm:justify-self-end"
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setActivities((prev) => [...prev, emptyActivity()])}
          className="btn-secondary btn-sm"
        >
          + เพิ่มกิจกรรม
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">๖. การประเมินผล</div>
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[1fr_1fr_1fr_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>ตัวชี้วัดความสำเร็จ</div>
            <div>วิธีการประเมิน</div>
            <div>เครื่องมือที่ใช้</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {evaluationItems.map((row, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_1fr_1fr_3.5rem] sm:items-center">
                <input
                  value={row.indicator}
                  onChange={(e) => updateEvaluation(i, { indicator: e.target.value })}
                  className="input"
                  placeholder="ตัวชี้วัด"
                />
                <input
                  value={row.method}
                  onChange={(e) => updateEvaluation(i, { method: e.target.value })}
                  className="input"
                  placeholder="เช่น สำรวจ"
                />
                <input
                  value={row.tool}
                  onChange={(e) => updateEvaluation(i, { tool: e.target.value })}
                  className="input"
                  placeholder="เช่น แบบสำรวจ"
                />
                {evaluationItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEvaluationItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="btn-danger btn-sm sm:justify-self-end"
                  >
                    ลบ
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEvaluationItems((prev) => [...prev, emptyEvaluation()])}
          className="btn-secondary btn-sm"
        >
          + เพิ่มตัวชี้วัด
        </button>
      </div>

      <div>
        <label className="label">๗. ผลที่คาดว่าจะได้รับ</label>
        <textarea name="expected_results" rows={3} className="input" />
      </div>

      <button type="submit" className="btn-primary mt-2">
        ส่งข้อเสนอโครงการ
      </button>
    </form>
  );
}
