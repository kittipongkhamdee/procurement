"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;

type ActivityRow = {
  name: string;
  period: string;
  responsible: string[];
  compensation: string;
  service: string;
  material: string;
};
type EvaluationRow = { type: "เชิงปริมาณ" | "เชิงคุณภาพ"; indicator: string; target: string; method: string; tool: string };

function emptyActivity(): ActivityRow {
  return { name: "", period: "", responsible: [], compensation: "", service: "", material: "" };
}

function emptyEvaluation(type: EvaluationRow["type"]): EvaluationRow {
  return { type, indicator: "", target: "", method: "", tool: "" };
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
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
  const [evaluationItems, setEvaluationItems] = useState<EvaluationRow[]>([emptyEvaluation("เชิงปริมาณ")]);

  function updateActivity(index: number, patch: Partial<ActivityRow>) {
    setActivities((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function updateEvaluation(index: number, patch: Partial<EvaluationRow>) {
    setEvaluationItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  const totalBudget = useMemo(
    () =>
      activities.reduce(
        (sum, a) => sum + (parseFloat(a.compensation) || 0) + (parseFloat(a.service) || 0) + (parseFloat(a.material) || 0),
        0,
      ),
    [activities],
  );

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
              <label className="label">สนองกลยุทธ์โรงเรียน</label>
              <input name="strategy_alignment" className="input" placeholder="เช่น กลยุทธ์ที่ 1 พัฒนาคุณภาพผู้เรียน" />
            </div>
            <div>
              <label className="label">สอดคล้องกับมาตรฐานการศึกษาของสถานศึกษา</label>
              <input name="standard" className="input" placeholder="เช่น มาตรฐานที่ 1 คุณภาพของผู้เรียน" />
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
              <label className="label">กลุ่มงานที่รับผิดชอบ</label>
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
              <label className="label">สถานที่ดำเนินการ</label>
              <input name="location" className="input" placeholder="เช่น โรงเรียนตาเบาวิทยา" />
            </div>
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
          <label className="label">๓. เป้าหมาย — ผลผลิต/ด้านปริมาณ</label>
          <textarea name="target_quantity" rows={3} className="input" />
        </div>
        <div>
          <label className="label">เป้าหมาย — ผลลัพธ์/ด้านคุณภาพ</label>
          <textarea name="target_quality" rows={3} className="input" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">๔. ขั้นตอนการดำเนินงาน และงบประมาณ</div>
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[1fr_6rem_8rem_5rem_5rem_5rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>รายละเอียดการดำเนินงาน</div>
            <div>ระยะเวลา</div>
            <div>ผู้รับผิดชอบ</div>
            <div>ค่าตอบแทน</div>
            <div>ค่าใช้สอย</div>
            <div>ค่าวัสดุ</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {activities.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_6rem_8rem_5rem_5rem_5rem_3.5rem] sm:items-center"
              >
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
                <input
                  type="number"
                  step="0.01"
                  value={row.compensation}
                  onChange={(e) => updateActivity(i, { compensation: e.target.value })}
                  className="input text-right"
                  placeholder="0.00"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.service}
                  onChange={(e) => updateActivity(i, { service: e.target.value })}
                  className="input text-right"
                  placeholder="0.00"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.material}
                  onChange={(e) => updateActivity(i, { material: e.target.value })}
                  className="input text-right"
                  placeholder="0.00"
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
          <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-600">รวมงบประมาณทั้งสิ้น</span>
            <span className="font-bold text-navy-800">{formatBaht(totalBudget)} บาท</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setActivities((prev) => [...prev, emptyActivity()])} className="btn-secondary btn-sm">
            + เพิ่มกิจกรรม
          </button>
          <div className="ml-auto w-56">
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
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="label">๗. การวิเคราะห์ความเสี่ยงของโครงการ — ปัจจัยความเสี่ยง</label>
        <textarea name="risk_factors" rows={2} className="input" />
      </div>
      <div>
        <label className="label">แนวทางการบริหารความเสี่ยง</label>
        <textarea name="risk_mitigation" rows={2} className="input" />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">๘. ตัวชี้วัดและเป้าหมายความสำเร็จ</div>
        <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[6rem_1fr_6rem_1fr_1fr_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>ประเภท</div>
            <div>ตัวชี้วัด</div>
            <div>ค่าเป้าหมาย</div>
            <div>วิธีวัดและประเมินผล</div>
            <div>เครื่องมือที่ใช้</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {evaluationItems.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[6rem_1fr_6rem_1fr_1fr_3.5rem] sm:items-center"
              >
                <select
                  value={row.type}
                  onChange={(e) => updateEvaluation(i, { type: e.target.value as EvaluationRow["type"] })}
                  className="input"
                >
                  <option value="เชิงปริมาณ">เชิงปริมาณ</option>
                  <option value="เชิงคุณภาพ">เชิงคุณภาพ</option>
                </select>
                <input
                  value={row.indicator}
                  onChange={(e) => updateEvaluation(i, { indicator: e.target.value })}
                  className="input"
                  placeholder="ตัวชี้วัด"
                />
                <input
                  value={row.target}
                  onChange={(e) => updateEvaluation(i, { target: e.target.value })}
                  className="input"
                  placeholder="เช่น ร้อยละ 80"
                />
                <input
                  value={row.method}
                  onChange={(e) => updateEvaluation(i, { method: e.target.value })}
                  className="input"
                  placeholder="เช่น การเก็บรวบรวมผลการดำเนินงาน"
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
          onClick={() => setEvaluationItems((prev) => [...prev, emptyEvaluation("เชิงปริมาณ")])}
          className="btn-secondary btn-sm"
        >
          + เพิ่มตัวชี้วัด
        </button>
      </div>

      <div>
        <label className="label">๙. ผลที่คาดว่าจะได้รับ</label>
        <textarea name="expected_results" rows={3} className="input" />
      </div>

      <button type="submit" className="btn-primary mt-2">
        ส่งข้อเสนอโครงการ
      </button>
    </form>
  );
}
