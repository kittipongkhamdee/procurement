"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";
import { ProposalFileUpload } from "@/components/proposal-file-upload";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;
type Strategy = Pick<Tables<"plan_strategies">, "id" | "name">;
type Standard = Pick<Tables<"plan_standards">, "id" | "name">;

type ActivityRow = {
  name: string;
  responsible: string[];
  budget: string;
};

type IndicatorRow = {
  indicator: string;
  target: string;
};

function emptyActivity(): ActivityRow {
  return { name: "", responsible: [], budget: "" };
}

function emptyIndicator(): IndicatorRow {
  return { indicator: "", target: "" };
}

function IndicatorList({
  label,
  rows,
  onChange,
  addLabel,
}: {
  label: string;
  rows: IndicatorRow[];
  onChange: (next: IndicatorRow[]) => void;
  addLabel: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="overflow-hidden rounded-xl border border-slate-200/80">
        <div className="hidden grid-cols-[1fr_10rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <div>ตัวชี้วัด</div>
          <div>ค่าเป้าหมาย</div>
          <div></div>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_10rem_3.5rem] sm:items-center">
              <input
                value={row.indicator}
                onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, indicator: e.target.value } : r)))}
                className="input"
                placeholder="เช่น นักเรียนมีผลสัมฤทธิ์ทางการเรียนระดับดีขึ้นไป"
              />
              <input
                value={row.target}
                onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, target: e.target.value } : r)))}
                className="input"
                placeholder="เช่น ร้อยละ 65"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  className="btn-danger btn-sm sm:justify-self-end"
                >
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => onChange([...rows, emptyIndicator()])} className="btn-secondary btn-sm mt-2">
        {addLabel}
      </button>
    </div>
  );
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export type ProposalFormInitial = {
  name: string;
  standard: string | null;
  strategyAlignment: string | null;
  adminGroupId: string | null;
  responsible: string[];
  activities: ActivityRow[];
  budgetAmount: number;
  budgetSourceId: string | null;
  fileUrlWordPath: string | null;
  fileUrlPdfPath: string | null;
  indicatorsQuantity: IndicatorRow[];
  indicatorsQuality: IndicatorRow[];
};

export function ProposalForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
  teachers,
  strategies,
  standards,
  initial,
  submitLabel = "ส่งข้อเสนอโครงการ",
  successMessage = "ส่งข้อเสนอโครงการเรียบร้อยแล้ว",
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  strategies: Strategy[];
  standards: Standard[];
  initial?: ProposalFormInitial;
  submitLabel?: string;
  successMessage?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [strategyAlignment, setStrategyAlignment] = useState(initial?.strategyAlignment ?? "");
  const [standard, setStandard] = useState(initial?.standard ?? "");
  const [responsible, setResponsible] = useState<string[]>(initial?.responsible ?? []);
  const [hasActivities, setHasActivities] = useState((initial?.activities.length ?? 1) > 0);
  const [activities, setActivities] = useState<ActivityRow[]>(initial?.activities ?? [emptyActivity()]);
  const [projectBudget, setProjectBudget] = useState(
    initial && !hasActivities ? String(initial.budgetAmount) : "",
  );
  const [indicatorsQuantity, setIndicatorsQuantity] = useState<IndicatorRow[]>(
    initial?.indicatorsQuantity ?? [emptyIndicator()],
  );
  const [indicatorsQuality, setIndicatorsQuality] = useState<IndicatorRow[]>(
    initial?.indicatorsQuality ?? [emptyIndicator()],
  );

  function updateActivity(index: number, patch: Partial<ActivityRow>) {
    setActivities((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function toggleHasActivities() {
    setHasActivities((v) => {
      const next = !v;
      if (next && activities.length === 0) setActivities([emptyActivity()]);
      return next;
    });
  }

  const totalBudget = useMemo(
    () => activities.reduce((sum, a) => sum + (parseFloat(a.budget) || 0), 0),
    [activities],
  );

  async function handleSubmit(formData: FormData) {
    formData.set("has_activities", hasActivities ? "yes" : "no");
    formData.set("activities_json", JSON.stringify(hasActivities ? activities : []));
    formData.set("indicators_quantity_json", JSON.stringify(indicatorsQuantity.filter((r) => r.indicator.trim() !== "")));
    formData.set("indicators_quality_json", JSON.stringify(indicatorsQuality.filter((r) => r.indicator.trim() !== "")));
    try {
      await action(formData);
      await toastSuccess(successMessage);
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4 text-left">
      <input type="hidden" name="budget_year_id" value={budgetYearId} />

      <div>
        <div className="card-title">ข้อมูลทั่วไป</div>
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ProposalFileUpload
                name="file_url_word"
                label="ไฟล์โครงการ Word (.doc, .docx)"
                accept=".doc,.docx"
                initialPath={initial?.fileUrlWordPath}
              />
              <ProposalFileUpload
                name="file_url_pdf"
                label="ไฟล์โครงการ PDF (.pdf)"
                accept=".pdf"
                initialPath={initial?.fileUrlPdfPath}
              />
            </div>
          </div>
          <div>
            <label className="label">ชื่อโครงการ</label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">สนองกลยุทธ์โรงเรียน</label>
              <select
                name="strategy_alignment"
                value={strategyAlignment}
                onChange={(e) => setStrategyAlignment(e.target.value)}
                className="input"
              >
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
              <select
                name="standard"
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
                className="input"
              >
                <option value="">ไม่ระบุ</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">กลุ่มงานที่รับผิดชอบ</label>
            <select name="admin_group_id" required defaultValue={initial?.adminGroupId ?? ""} className="input">
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
          <div>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <TeacherMultiSelect teachers={teachers} value={responsible} onChange={setResponsible} />
            {responsible.map((n) => (
              <input key={n} type="hidden" name="responsible" value={n} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">ขั้นตอนการดำเนินงาน และงบประมาณ</div>
        <div className="mb-3 w-full sm:w-56">
          <label className="label">แหล่งเงินงบประมาณ</label>
          <select name="budget_source_id" defaultValue={initial?.budgetSourceId ?? ""} className="input">
            <option value="">ไม่ระบุ</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3 flex items-center gap-3 text-sm">
          <button
            type="button"
            role="switch"
            aria-checked={hasActivities}
            onClick={toggleHasActivities}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              hasActivities ? "bg-navy-800" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
                hasActivities ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="font-medium text-slate-700">
            {hasActivities ? "มีกิจกรรมย่อย" : "ไม่มีกิจกรรมย่อย"}
          </span>
        </div>

        {hasActivities ? (
          <>
            <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
              <div className="hidden grid-cols-[1fr_8rem_6rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                <div>รายละเอียดการดำเนินงาน</div>
                <div>ผู้รับผิดชอบ</div>
                <div>งบประมาณ</div>
                <div></div>
              </div>
              <div className="divide-y divide-slate-100">
                {activities.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_8rem_6rem_3.5rem] sm:items-center"
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
                      <label className="label sm:hidden">ผู้รับผิดชอบ</label>
                      <TeacherMultiSelect
                        teachers={teachers}
                        value={row.responsible}
                        onChange={(next) => updateActivity(i, { responsible: next })}
                      />
                    </div>
                    <div>
                      <label className="label sm:hidden">งบประมาณ</label>
                      <input
                        type="number"
                        step="0.01"
                        value={row.budget}
                        onChange={(e) => updateActivity(i, { budget: e.target.value })}
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
            <button type="button" onClick={() => setActivities((prev) => [...prev, emptyActivity()])} className="btn-secondary btn-sm">
              + เพิ่มกิจกรรม
            </button>
          </>
        ) : (
          <div>
            <label className="label">งบประมาณโครงการ</label>
            <input
              type="number"
              step="0.01"
              name="project_budget"
              value={projectBudget}
              onChange={(e) => setProjectBudget(e.target.value)}
              className="input"
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">ตัวชี้วัดและเป้าหมายความสำเร็จ</div>
        <div className="grid grid-cols-1 gap-4">
          <IndicatorList
            label="เชิงปริมาณ"
            rows={indicatorsQuantity}
            onChange={setIndicatorsQuantity}
            addLabel="+ เพิ่มตัวชี้วัดเชิงปริมาณ"
          />
          <IndicatorList
            label="เชิงคุณภาพ"
            rows={indicatorsQuality}
            onChange={setIndicatorsQuality}
            addLabel="+ เพิ่มตัวชี้วัดเชิงคุณภาพ"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-2">
        {submitLabel}
      </button>
    </form>
  );
}
