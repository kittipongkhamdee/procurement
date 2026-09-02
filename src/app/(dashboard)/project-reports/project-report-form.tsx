"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import {
  ProjectReportPhotoUpload,
  type ProjectReportPhotoUploadHandle,
  type ExistingPhoto,
} from "@/components/project-report-photo-upload";

type IndicatorTarget = { indicator: string; target: string };
type IndicatorResult = { indicator: string; target: string; actual: string };

export type Project = {
  id: string;
  name: string;
  budget: number | null;
  strategyAlignment: string | null;
  standard: string | null;
  responsible: string[];
  objectives: string[];
  indicatorsQuantity: IndicatorTarget[];
  indicatorsQuality: IndicatorTarget[];
  proposalPdfPath: string | null;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function emptyIndicatorResult(): IndicatorResult {
  return { indicator: "", target: "", actual: "" };
}

export type ProjectReportInitial = {
  projectId: string;
  notImplemented: boolean;
  notImplementedReason: string;
  responsibleName: string;
  periodStart: string | null;
  periodEnd: string | null;
  location: string | null;
  background: string;
  objectives: string[];
  activitiesDone: string[];
  indicatorResultsQuantity: IndicatorResult[];
  indicatorResultsQuality: IndicatorResult[];
  satisfactionPercent: number | null;
  budgetApproved: number | null;
  budgetUsed: number | null;
  highlights: string[];
  problems: string[];
  recommendations: string[];
  photos: ExistingPhoto[];
};

function IndicatorResultList({
  label,
  rows,
  onChange,
  addLabel,
}: {
  label: string;
  rows: IndicatorResult[];
  onChange: (next: IndicatorResult[]) => void;
  addLabel: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="overflow-hidden rounded-xl border border-slate-200/80">
        <div className="hidden grid-cols-[1fr_8rem_8rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <div>ตัวชี้วัด</div>
          <div>ค่าเป้าหมาย</div>
          <div>ผลการดำเนินงาน</div>
          <div></div>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1fr_8rem_8rem_3.5rem] sm:items-center"
            >
              <input
                value={row.indicator}
                onChange={(e) =>
                  onChange(
                    rows.map((r, idx) =>
                      idx === i ? { ...r, indicator: e.target.value } : r,
                    ),
                  )
                }
                className="input"
                placeholder="ตัวชี้วัด"
              />
              <input
                value={row.target}
                onChange={(e) =>
                  onChange(
                    rows.map((r, idx) =>
                      idx === i ? { ...r, target: e.target.value } : r,
                    ),
                  )
                }
                className="input"
                placeholder="ค่าเป้าหมาย"
              />
              <input
                value={row.actual}
                onChange={(e) =>
                  onChange(
                    rows.map((r, idx) =>
                      idx === i ? { ...r, actual: e.target.value } : r,
                    ),
                  )
                }
                className="input"
                placeholder="ผลการดำเนินงาน"
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
          {rows.length === 0 && (
            <p className="p-3 text-xs text-slate-400">
              ยังไม่ได้กำหนดตัวชี้วัดไว้ในข้อเสนอโครงการ
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, emptyIndicatorResult()])}
        className="btn-secondary btn-sm mt-2"
      >
        {addLabel}
      </button>
    </div>
  );
}

function ListField({
  label,
  placeholder,
  values,
  onChange,
  addLabel,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              onChange={(e) =>
                onChange(
                  values.map((row, idx) => (idx === i ? e.target.value : row)),
                )
              }
              className="input"
              placeholder={placeholder}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="btn-danger btn-sm shrink-0"
              >
                ลบ
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        className="btn-secondary btn-sm mt-2"
      >
        {addLabel}
      </button>
    </div>
  );
}

export function ProjectReportForm({
  projects,
  action,
  aiExtractionEnabled,
  extractBackgroundFromProposalFile,
  onSuccess,
  initial,
  submitLabel,
}: {
  projects: Project[];
  action: (formData: FormData) => void | Promise<void>;
  aiExtractionEnabled?: boolean;
  extractBackgroundFromProposalFile?: (filePath: string) => Promise<string>;
  /** เรียกหลังบันทึกสำเร็จเท่านั้น (เช่น สั่งปิด popup) — ไม่เรียกถ้าบันทึกไม่สำเร็จ ผู้ใช้จะได้เห็น toast แจ้ง error และแก้ไขฟอร์มต่อได้ */
  onSuccess?: () => void;
  /** ข้อมูลรายงานเดิม — ใส่มาเมื่อเป็นการแก้ไขรายงานที่มีอยู่แล้ว */
  initial?: ProjectReportInitial;
  submitLabel?: string;
}) {
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notImplemented, setNotImplemented] = useState(
    initial?.notImplemented ?? false,
  );
  const [notImplementedReason, setNotImplementedReason] = useState(
    initial?.notImplementedReason ?? "",
  );
  const [background, setBackground] = useState(initial?.background ?? "");
  const [aiLoading, setAiLoading] = useState(false);
  const [objectives, setObjectives] = useState<string[]>(
    initial && initial.objectives.length > 0 ? initial.objectives : [""],
  );
  const [activitiesDone, setActivitiesDone] = useState<string[]>(
    initial && initial.activitiesDone.length > 0
      ? initial.activitiesDone
      : [""],
  );
  const [highlights, setHighlights] = useState<string[]>(
    initial && initial.highlights.length > 0 ? initial.highlights : [""],
  );
  const [problems, setProblems] = useState<string[]>(
    initial && initial.problems.length > 0 ? initial.problems : [""],
  );
  const [recommendations, setRecommendations] = useState<string[]>(
    initial && initial.recommendations.length > 0
      ? initial.recommendations
      : [""],
  );
  const [budgetApproved, setBudgetApproved] = useState(
    initial?.budgetApproved != null ? String(initial.budgetApproved) : "",
  );
  const [budgetUsed, setBudgetUsed] = useState(
    initial?.budgetUsed != null ? String(initial.budgetUsed) : "",
  );
  const [responsibleName, setResponsibleName] = useState(
    initial?.responsibleName ?? "",
  );
  const [indicatorResultsQuantity, setIndicatorResultsQuantity] = useState<
    IndicatorResult[]
  >(initial?.indicatorResultsQuantity ?? []);
  const [indicatorResultsQuality, setIndicatorResultsQuality] = useState<
    IndicatorResult[]
  >(initial?.indicatorResultsQuality ?? []);
  const [satisfactionPercent, setSatisfactionPercent] = useState(
    initial?.satisfactionPercent != null ? String(initial.satisfactionPercent) : "",
  );
  const [pullingSatisfaction, setPullingSatisfaction] = useState(false);
  const photoUploadRef = useRef<ProjectReportPhotoUploadHandle>(null);
  const backgroundRef = useRef<HTMLTextAreaElement>(null);

  // ขยายกล่อง "ความเป็นมา" ตามความยาวเนื้อหาอัตโนมัติ เพราะข้อความที่ AI สรุปมาให้มักยาวเกินกรอบเดิม
  useEffect(() => {
    const el = backgroundRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [background]);

  const budgetRemaining = useMemo(() => {
    const approved = parseFloat(budgetApproved);
    const used = parseFloat(budgetUsed);
    if (Number.isNaN(approved) || Number.isNaN(used)) return null;
    return approved - used;
  }, [budgetApproved, budgetUsed]);

  const selectedProject = projects.find((p) => p.id === projectId);

  function handleProjectChange(id: string) {
    setProjectId(id);
    const project = projects.find((p) => p.id === id);
    if (project?.budget != null) setBudgetApproved(String(project.budget));
    if (project?.responsible && project.responsible.length > 0)
      setResponsibleName(project.responsible.join(", "));
    setObjectives(
      project && project.objectives.length > 0 ? project.objectives : [""],
    );
    setIndicatorResultsQuantity(
      project && project.indicatorsQuantity.length > 0
        ? project.indicatorsQuantity.map((t) => ({ ...t, actual: "" }))
        : [],
    );
    setIndicatorResultsQuality(
      project && project.indicatorsQuality.length > 0
        ? project.indicatorsQuality.map((t) => ({ ...t, actual: "" }))
        : [],
    );
  }

  async function handleExtractBackground() {
    if (!selectedProject?.proposalPdfPath || !extractBackgroundFromProposalFile)
      return;
    setAiLoading(true);
    try {
      const result = await extractBackgroundFromProposalFile(
        selectedProject.proposalPdfPath,
      );
      if (result) setBackground(result);
      else await toastError("AI ไม่พบหัวข้อหลักการและเหตุผลในไฟล์นี้");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setAiLoading(false);
    }
  }

  async function handlePullSatisfaction() {
    if (!selectedProject) return;
    setPullingSatisfaction(true);
    try {
      const supabase = createClient();
      const { data: forms } = await supabase
        .from("eval_forms")
        .select("id")
        .eq("project_id", selectedProject.id)
        .eq("is_template", false);
      const formIds = (forms ?? []).map((f) => f.id);
      if (formIds.length === 0) {
        await toastError("ไม่พบแบบประเมินออนไลน์ของโครงการนี้");
        return;
      }

      const { data: questions } = await supabase
        .from("eval_questions")
        .select("id")
        .in("form_id", formIds)
        .eq("question_type", "likert");
      const questionIds = (questions ?? []).map((q) => q.id);
      if (questionIds.length === 0) {
        await toastError("แบบประเมินของโครงการนี้ไม่มีคำถามแบบ Likert (1-5) ให้สรุปผล");
        return;
      }

      const { data: answers } = await supabase
        .from("eval_answers")
        .select("answer_value")
        .in("question_id", questionIds);
      const values = (answers ?? [])
        .map((a) => Number(a.answer_value))
        .filter((n) => !Number.isNaN(n));
      if (values.length === 0) {
        await toastError("ยังไม่มีคำตอบในแบบประเมินของโครงการนี้");
        return;
      }

      const avg = values.reduce((sum, n) => sum + n, 0) / values.length;
      const percent = (avg / 5) * 100;
      setSatisfactionPercent(percent.toFixed(2));
      await toastSuccess(`ดึงผลจากแบบประเมินออนไลน์แล้ว (เฉลี่ย ${avg.toFixed(2)}/5 จาก ${values.length} คำตอบ)`);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setPullingSatisfaction(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    // flushSync บังคับให้ปุ่มเปลี่ยนเป็น "กำลังบันทึก..." ทันทีก่อนเริ่มงานหนัก (บีบอัด/อัปโหลดรูป)
    // ไม่งั้น React อาจรวม state นี้ไว้กับงานอื่นแล้วหน่วงการวาดหน้าจอ ทำให้ดูเหมือนกดแล้วไม่มีอะไรเกิดขึ้น
    flushSync(() => setIsSubmitting(true));
    try {
      const photoRefs = await photoUploadRef.current?.uploadAll();
      formData.set("objectives_json", JSON.stringify(objectives));
      formData.set("activities_done_json", JSON.stringify(activitiesDone));
      formData.set("highlights_json", JSON.stringify(highlights));
      formData.set("problems_json", JSON.stringify(problems));
      formData.set("recommendations_json", JSON.stringify(recommendations));
      formData.set("photo_refs_json", JSON.stringify(photoRefs ?? []));
      formData.set(
        "indicator_results_quantity_json",
        JSON.stringify(
          indicatorResultsQuantity.filter((r) => r.indicator.trim() !== ""),
        ),
      );
      formData.set(
        "indicator_results_quality_json",
        JSON.stringify(
          indicatorResultsQuality.filter((r) => r.indicator.trim() !== ""),
        ),
      );
      await action(formData);
      await toastSuccess(
        initial
          ? "บันทึกการแก้ไขรายงานโครงการเรียบร้อยแล้ว"
          : "บันทึกรายงานโครงการเรียบร้อยแล้ว",
      );
      if (!initial) {
        // โหมดเสนอรายงานใหม่ — เคลียร์ฟอร์มให้กรอกรายการถัดไปได้ทันที (โหมดแก้ไขไม่ต้องเคลียร์เพราะ popup จะปิดไปเลย)
        setProjectId("");
        setNotImplemented(false);
        setNotImplementedReason("");
        setBackground("");
        setObjectives([""]);
        setActivitiesDone([""]);
        setHighlights([""]);
        setProblems([""]);
        setRecommendations([""]);
        setBudgetApproved("");
        setBudgetUsed("");
        setSatisfactionPercent("");
        setResponsibleName("");
        setIndicatorResultsQuantity([]);
        setIndicatorResultsQuality([]);
      }
      onSuccess?.();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4">
      <div>
        <div className="card-title">1. ส่วนหัวรายงาน</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">ชื่อโครงการ</label>
            <select
              name="project_id"
              required
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="input"
            >
              <option value="" disabled>
                เลือกโครงการ..
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {selectedProject &&
            (selectedProject.strategyAlignment || selectedProject.standard) && (
              <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                {selectedProject.strategyAlignment && (
                  <div>
                    <span className="font-medium text-slate-700">
                      สนองกลยุทธ์โรงเรียน:
                    </span>{" "}
                    {selectedProject.strategyAlignment}
                  </div>
                )}
                {selectedProject.standard && (
                  <div>
                    <span className="font-medium text-slate-700">
                      สอดคล้องมาตรฐานการศึกษา:
                    </span>{" "}
                    {selectedProject.standard}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  ดึงจากข้อเสนอโครงการเดิม จะแสดงในรายงาน PDF ให้อัตโนมัติ
                </p>
              </div>
            )}
          <div>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <input
              name="responsible_name"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              className="input"
              placeholder="ชื่อ-นามสกุล และตำแหน่ง/กลุ่มสาระฯ"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เริ่มดำเนินงาน</label>
              <input
                type="date"
                name="period_start"
                defaultValue={initial?.periodStart ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">สิ้นสุดดำเนินงาน</label>
              <input
                type="date"
                name="period_end"
                defaultValue={initial?.periodEnd ?? ""}
                className="input"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">สถานที่ดำเนินการ</label>
            <input
              name="location"
              className="input"
              defaultValue={
                initial?.location ??
                "โรงเรียนตาเบาวิทยา อำเภอปราสาท จังหวัดสุรินทร์"
              }
            />
          </div>
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                name="not_implemented"
                checked={notImplemented}
                onChange={(e) => setNotImplemented(e.target.checked)}
                className="h-4 w-4"
              />
              ไม่ได้ดำเนินการโครงการนี้
            </label>
            {notImplemented && (
              <div className="mt-2">
                <label className="label">เหตุผลที่ไม่ได้ดำเนินการ</label>
                <textarea
                  name="not_implemented_reason"
                  required
                  rows={2}
                  value={notImplementedReason}
                  onChange={(e) => setNotImplementedReason(e.target.value)}
                  className="input"
                  placeholder="เช่น งบประมาณไม่เพียงพอ, ปรับเปลี่ยนแผนงาน..."
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {!notImplemented && (
        <>
          <div className="border-t border-slate-100 pt-4">
            <div className="card-title">2. หลักการและวัตถุประสงค์</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label className="label">
                    ความเป็นมา (สรุปเหตุผลที่จัดโครงการนี้)
                  </label>
                  {aiExtractionEnabled &&
                    extractBackgroundFromProposalFile &&
                    selectedProject?.proposalPdfPath && (
                      <button
                        type="button"
                        onClick={handleExtractBackground}
                        disabled={aiLoading}
                        className="btn-secondary btn-sm shrink-0 disabled:cursor-wait"
                      >
                        {aiLoading
                          ? "กำลังอ่านไฟล์..."
                          : "✨ ให้ AI อ่านจากไฟล์ข้อเสนอโครงการ"}
                      </button>
                    )}
                </div>
                <textarea
                  ref={backgroundRef}
                  name="background"
                  rows={3}
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  className="input min-h-24 resize-none overflow-hidden"
                />
              </div>
              <div>
                <ListField
                  label="วัตถุประสงค์"
                  placeholder="เพื่อ..."
                  values={objectives}
                  onChange={setObjectives}
                  addLabel="+ เพิ่มวัตถุประสงค์"
                />
                {selectedProject && selectedProject.objectives.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    ดึงจากข้อเสนอโครงการเดิม แก้ไขได้ตามจริง
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="card-title">3. ผลการดำเนินงานโครงการ</div>
            <div className="grid grid-cols-1 gap-3">
              <ListField
                label="สรุปการดำเนินงาน/กิจกรรมที่ทำจริง"
                placeholder="เช่น จัดกิจกรรมพัฒนาทักษะอาชีพ..."
                values={activitiesDone}
                onChange={setActivitiesDone}
                addLabel="+ เพิ่มรายการ"
              />
              <IndicatorResultList
                label="ตัวชี้วัดเชิงปริมาณ"
                rows={indicatorResultsQuantity}
                onChange={setIndicatorResultsQuantity}
                addLabel="+ เพิ่มตัวชี้วัดเชิงปริมาณ"
              />
              <IndicatorResultList
                label="ตัวชี้วัดเชิงคุณภาพ"
                rows={indicatorResultsQuality}
                onChange={setIndicatorResultsQuality}
                addLabel="+ เพิ่มตัวชี้วัดเชิงคุณภาพ"
              />
              <div className="sm:w-56">
                <div className="flex items-center justify-between gap-2">
                  <label className="label">
                    ผลการประเมินความพึงพอใจ (ร้อยละ)
                  </label>
                  {selectedProject && (
                    <button
                      type="button"
                      onClick={handlePullSatisfaction}
                      disabled={pullingSatisfaction}
                      className="btn-secondary btn-sm shrink-0 whitespace-nowrap disabled:cursor-wait"
                    >
                      {pullingSatisfaction ? "กำลังดึง..." : "ดึงจากแบบประเมินออนไลน์"}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  name="satisfaction_percent"
                  value={satisfactionPercent}
                  onChange={(e) => setSatisfactionPercent(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">งบประมาณที่ได้รับอนุมัติ</label>
                  <input
                    type="number"
                    step="0.01"
                    name="budget_approved"
                    value={budgetApproved}
                    onChange={(e) => setBudgetApproved(e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">งบประมาณที่ใช้ไปจริง</label>
                  <input
                    type="number"
                    step="0.01"
                    name="budget_used"
                    value={budgetUsed}
                    onChange={(e) => setBudgetUsed(e.target.value)}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">คงเหลือ</label>
                  <div className="input flex items-center bg-slate-50 font-medium text-slate-600">
                    {budgetRemaining != null
                      ? `${formatBaht(budgetRemaining)} บาท`
                      : "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="card-title">4. สรุปภาพรวมและข้อเสนอแนะ</div>
            <div className="grid grid-cols-1 gap-4">
              <ListField
                label="จุดเด่น / ประสบความสำเร็จ"
                placeholder="สิ่งที่ทำได้ดีในโครงการนี้..."
                values={highlights}
                onChange={setHighlights}
                addLabel="+ เพิ่มจุดเด่น"
              />
              <ListField
                label="ปัญหาและอุปสรรค"
                placeholder="ปัญหาที่เจอระหว่างดำเนินงาน..."
                values={problems}
                onChange={setProblems}
                addLabel="+ เพิ่มปัญหา"
              />
              <ListField
                label="ข้อเสนอแนะในการปรับปรุงครั้งต่อไป"
                placeholder="แนวทางแก้ไขสำหรับปีหน้า..."
                values={recommendations}
                onChange={setRecommendations}
                addLabel="+ เพิ่มข้อเสนอแนะ"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="card-title">5. ภาพถ่ายกิจกรรม</div>
            <ProjectReportPhotoUpload
              ref={photoUploadRef}
              initialPhotos={initial?.photos}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary mt-2 disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting
          ? "กำลังบันทึก..."
          : (submitLabel ?? "บันทึกรายงานโครงการ")}
      </button>
    </form>
  );
}
