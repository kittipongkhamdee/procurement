"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";

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

function emptyActivity(): ActivityRow {
  return { name: "", period: "", responsible: [], compensation: "", service: "", material: "" };
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

  function updateActivity(index: number, patch: Partial<ActivityRow>) {
    setActivities((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">วันที่เริ่มต้น</label>
              <input type="date" name="start_date" className="input" />
            </div>
            <div>
              <label className="label">วันที่สิ้นสุด</label>
              <input type="date" name="end_date" className="input" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">ขั้นตอนการดำเนินงาน</div>
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
        </div>
        <button type="button" onClick={() => setActivities((prev) => [...prev, emptyActivity()])} className="btn-secondary btn-sm">
          + เพิ่มกิจกรรม
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">งบประมาณในการดำเนินงาน</div>
        <div className="overflow-hidden rounded-xl border border-slate-200/80">
          <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-semibold text-slate-600">รวมงบประมาณทั้งสิ้น</span>
            <span className="font-bold text-navy-800">{formatBaht(totalBudget)} บาท</span>
          </div>
        </div>
        <div className="mt-3 w-full sm:w-56">
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

      <button type="submit" className="btn-primary mt-2">
        ส่งข้อเสนอโครงการ
      </button>
    </form>
  );
}
