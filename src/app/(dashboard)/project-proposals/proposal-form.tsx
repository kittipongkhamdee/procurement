"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";
import { PlusIcon } from "@/components/icons";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;
type Strategy = Pick<Tables<"plan_strategies">, "id" | "name">;
type Standard = Pick<Tables<"plan_standards">, "id" | "name">;

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

function SectionHeading({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-sm font-bold text-navy-800">{children}</div>;
}

function numberedListToText(items: string[]) {
  const nonEmpty = items.map((i) => i.trim()).filter(Boolean);
  return nonEmpty.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function NumberedListField({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  function update(i: number, value: string) {
    onChange(items.map((item, idx) => (idx === i ? value : item)));
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-sm font-medium text-slate-500">{i + 1}.</span>
          <input value={item} onChange={(e) => update(i, e.target.value)} className="input flex-1" placeholder={placeholder} />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="btn-danger btn-sm shrink-0"
            >
              ลบ
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className="icon-btn-add self-start">
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ProposalForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
  teachers,
  strategies,
  standards,
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  strategies: Strategy[];
  standards: Standard[];
}) {
  const [responsible, setResponsible] = useState<string[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([emptyActivity()]);
  const [evaluationItems, setEvaluationItems] = useState<EvaluationRow[]>([emptyEvaluation("เชิงปริมาณ")]);
  const [objectives, setObjectives] = useState<string[]>([""]);
  const [targetQuantity, setTargetQuantity] = useState<string[]>([""]);
  const [targetQuality, setTargetQuality] = useState<string[]>([""]);

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
    formData.set("objectives", numberedListToText(objectives));
    formData.set("target_quantity", numberedListToText(targetQuantity));
    formData.set("target_quality", numberedListToText(targetQuality));
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
              <select name="strategy_alignment" defaultValue="" className="input">
                <option value="">ไม่ระบุ</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">สอดคล้องกับมาตรฐานการศึกษาของสถานศึกษา</label>
              <select name="standard" defaultValue="" className="input">
                <option value="">ไม่ระบุ</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
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
        <SectionHeading>1. หลักการและเหตุผล</SectionHeading>
        <textarea name="rationale" rows={4} className="input" />
      </div>

      <div>
        <SectionHeading>2. วัตถุประสงค์</SectionHeading>
        <NumberedListField items={objectives} onChange={setObjectives} placeholder="ระบุวัตถุประสงค์ข้อที่..." />
      </div>

      <div>
        <SectionHeading>3. เป้าหมาย</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <SectionHeading>3.1 เป้าหมายเชิงปริมาณ (ผลผลิต)</SectionHeading>
            <NumberedListField items={targetQuantity} onChange={setTargetQuantity} placeholder="ระบุเป้าหมายเชิงปริมาณ" />
          </div>
          <div>
            <SectionHeading>3.2 เป้าหมายเชิงคุณภาพ (ผลลัพธ์)</SectionHeading>
            <NumberedListField items={targetQuality} onChange={setTargetQuality} placeholder="ระบุเป้าหมายเชิงคุณภาพ" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <SectionHeading>4. ขั้นตอนการดำเนินงาน และงบประมาณ</SectionHeading>
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
                <div>
                  <label className="label sm:hidden">รายละเอียดการดำเนินงาน</label>
                  <input
                    value={row.name}
                    onChange={(e) => updateActivity(i, { name: e.target.value })}
                    className="input"
                    placeholder={`กิจกรรมที่ ${i + 1}`}
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ระยะเวลา</label>
                  <input
                    value={row.period}
                    onChange={(e) => updateActivity(i, { period: e.target.value })}
                    className="input"
                    placeholder="เช่น พ.ค. 2569"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ผู้รับผิดชอบ</label>
                  <TeacherMultiSelect
                    teachers={teachers}
                    value={row.responsible}
                    onChange={(next) => updateActivity(i, { responsible: next })}
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ค่าตอบแทน</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.compensation}
                    onChange={(e) => updateActivity(i, { compensation: e.target.value })}
                    className="input text-right"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ค่าใช้สอย</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.service}
                    onChange={(e) => updateActivity(i, { service: e.target.value })}
                    className="input text-right"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ค่าวัสดุ</label>
                  <input
                    type="number"
                    step="0.01"
                    value={row.material}
                    onChange={(e) => updateActivity(i, { material: e.target.value })}
                    className="input text-right"
                    placeholder="0.00"
                  />
                </div>
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
          <div className="w-full sm:ml-auto sm:w-56">
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
        <SectionHeading>7. การวิเคราะห์ความเสี่ยงของโครงการ — ปัจจัยความเสี่ยง</SectionHeading>
        <textarea name="risk_factors" rows={2} className="input" />
      </div>
      <div>
        <SectionHeading>แนวทางการบริหารความเสี่ยง</SectionHeading>
        <textarea name="risk_mitigation" rows={2} className="input" />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <SectionHeading>8. ตัวชี้วัดและเป้าหมายความสำเร็จ</SectionHeading>
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
                <div>
                  <label className="label sm:hidden">ประเภท</label>
                  <select
                    value={row.type}
                    onChange={(e) => updateEvaluation(i, { type: e.target.value as EvaluationRow["type"] })}
                    className="input"
                  >
                    <option value="เชิงปริมาณ">เชิงปริมาณ</option>
                    <option value="เชิงคุณภาพ">เชิงคุณภาพ</option>
                  </select>
                </div>
                <div>
                  <label className="label sm:hidden">ตัวชี้วัด</label>
                  <input
                    value={row.indicator}
                    onChange={(e) => updateEvaluation(i, { indicator: e.target.value })}
                    className="input"
                    placeholder="ตัวชี้วัด"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ค่าเป้าหมาย</label>
                  <input
                    value={row.target}
                    onChange={(e) => updateEvaluation(i, { target: e.target.value })}
                    className="input"
                    placeholder="เช่น ร้อยละ 80"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">วิธีวัดและประเมินผล</label>
                  <input
                    value={row.method}
                    onChange={(e) => updateEvaluation(i, { method: e.target.value })}
                    className="input"
                    placeholder="เช่น การเก็บรวบรวมผลการดำเนินงาน"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">เครื่องมือที่ใช้</label>
                  <input
                    value={row.tool}
                    onChange={(e) => updateEvaluation(i, { tool: e.target.value })}
                    className="input"
                    placeholder="เช่น แบบสำรวจ"
                  />
                </div>
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
        <SectionHeading>9. ผลที่คาดว่าจะได้รับ</SectionHeading>
        <textarea name="expected_results" rows={3} className="input" />
      </div>

      <button type="submit" className="btn-primary mt-2">
        ส่งข้อเสนอโครงการ
      </button>
    </form>
  );
}
