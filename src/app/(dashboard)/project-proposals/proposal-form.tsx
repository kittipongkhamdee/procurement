"use client";

import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";
import { ProposalFileUpload } from "@/components/proposal-file-upload";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;
type Strategy = Pick<Tables<"plan_strategies">, "id" | "name">;
type Standard = Pick<Tables<"plan_standards">, "id" | "name">;
type DraftProject = {
  id: string;
  name: string;
  adminGroupId: string | null;
  budgetSourceId: string | null;
  budget: number;
  /** กิจกรรมย่อยที่กำหนดไว้ในร่างโครงการ (ถ้ามี) */
  activities?: { name: string; budget: number }[];
};

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
  indicatorPlaceholder,
  targetPlaceholder,
}: {
  label: string;
  rows: IndicatorRow[];
  onChange: (next: IndicatorRow[]) => void;
  addLabel: string;
  indicatorPlaceholder: string;
  targetPlaceholder: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="overflow-hidden rounded-xl border border-slate-200/80">
        <div className="hidden grid-cols-[1.75rem_1fr_10rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <div className="text-right">ที่</div>
          <div>ตัวชี้วัด</div>
          <div>ค่าเป้าหมาย</div>
          <div></div>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[1.75rem_1fr_10rem_3.5rem] sm:items-center">
              {/* เลขลำดับอัตโนมัติ (แสดงอย่างเดียว ไม่บันทึกลงข้อมูล) */}
              <span className="text-xs font-semibold text-slate-500 sm:text-right sm:text-sm sm:font-medium">{i + 1}.</span>
              <input
                value={row.indicator}
                onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, indicator: e.target.value } : r)))}
                className="input"
                placeholder={indicatorPlaceholder}
              />
              <input
                value={row.target}
                onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? { ...r, target: e.target.value } : r)))}
                className="input"
                placeholder={targetPlaceholder}
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
          <div key={i} className="flex items-center gap-2">
            {/* เลขลำดับอัตโนมัติ (แสดงอย่างเดียว ไม่บันทึกลงข้อมูล) */}
            <span className="w-6 shrink-0 text-right text-sm font-medium text-slate-500">{i + 1}.</span>
            <input
              value={v}
              onChange={(e) => onChange(values.map((row, idx) => (idx === i ? e.target.value : row)))}
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
      <button type="button" onClick={() => onChange([...values, ""])} className="btn-secondary btn-sm mt-2">
        {addLabel}
      </button>
    </div>
  );
}

/** ปุ่มส่งฟอร์ม — ใช้ useFormStatus เพื่อให้สถานะ "กำลังส่ง…" ขึ้นทันทีที่กดปุ่ม (state ธรรมดาใน form action ถูกหน่วงไว้
 * จนกว่า action จะเสร็จ ผู้ใช้เลยเห็นปุ่มนิ่งเงียบระหว่างอัปโหลด/บันทึก) */
function SubmitButton({
  label,
  pendingLabel,
  disabled,
}: {
  label: string;
  pendingLabel: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="btn-primary mt-2 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

function normalizeProposalName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function DuplicateWarning() {
  return (
    <p role="alert" className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
      โครงการนี้ได้ส่งข้อเสนอโครงการไปแล้ว — 1 โครงการส่งได้ 1 รายการ ไม่สามารถส่งซ้ำได้
      (หากต้องการแก้ไข ให้ไปแก้ที่รายการเดิมในหน้ารายการเสนอโครงการ)
    </p>
  );
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function FieldError({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

// เฉพาะฟิลด์ที่เบราว์เซอร์ไม่รองรับ required แบบ native (ไฟล์แนบ, รายชื่อผู้รับผิดชอบ,
// ตัวชี้วัด — เป็น hidden input หรือรายการหลายแถวที่ native required ใช้ไม่ได้ตรงๆ)
// ส่วนช่องอื่น (select/text/number) ใช้ required native ของเบราว์เซอร์ ซึ่งเบราว์เซอร์เลื่อน
// และแสดง tooltip ชี้ตำแหน่งให้เองอยู่แล้ว
type FieldKey =
  | "file_url_word"
  | "file_url_pdf"
  | "responsible"
  | "objectives"
  | "indicators_quantity"
  | "indicators_quality";

const FIELD_ORDER: FieldKey[] = [
  "file_url_word",
  "file_url_pdf",
  "responsible",
  "objectives",
  "indicators_quantity",
  "indicators_quality",
];

export type ProposalFormInitial = {
  name: string;
  standard: string | null;
  strategyAlignment: string | null;
  adminGroupId: string | null;
  responsible: string[];
  objectives: string[];
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
  draftProjects = [],
  lockBudget = false,
  lockedDraftActivities,
  existingProposalNames = [],
  proposedDraftIds = [],
  initial,
  submitLabel = "ส่งข้อเสนอโครงการ",
  successMessage = "ส่งข้อเสนอโครงการเรียบร้อยแล้ว",
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void | { error?: string }>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
  strategies: Strategy[];
  standards: Standard[];
  draftProjects?: DraftProject[];
  /** ล็อกกลุ่มงานที่รับผิดชอบ แหล่งเงินงบประมาณ วิธีกรอกงบ และงบรวมก้อนเดียว (ใช้ตอนครูแก้ไขข้อเสนอของตัวเอง — เฉพาะผู้ดูแลระบบแก้ได้) */
  lockBudget?: boolean;
  /** ตอนครูแก้ไขข้อเสนอเดิม: กิจกรรม+งบที่กำหนดครบแล้วในร่างโครงการที่ผูกอยู่ — ถ้ามี ชื่อ/งบกิจกรรมแก้ไม่ได้ (ใช้ตามร่าง) */
  lockedDraftActivities?: { name: string; budget: number }[];
  /** ชื่อข้อเสนอโครงการที่มีอยู่แล้วในปีงบประมาณเดียวกัน (ไม่รวมรายการที่กำลังแก้ไข) — 1 โครงการส่งได้ 1 รายการ */
  existingProposalNames?: string[];
  /** id ร่างโครงการที่มีข้อเสนอผูกอยู่แล้ว */
  proposedDraftIds?: string[];
  initial?: ProposalFormInitial;
  submitLabel?: string;
  successMessage?: string;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [adminGroupId, setAdminGroupId] = useState(initial?.adminGroupId ?? "");
  const [budgetSourceId, setBudgetSourceId] = useState(initial?.budgetSourceId ?? "");
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [strategyAlignment, setStrategyAlignment] = useState(initial?.strategyAlignment ?? "");
  const [standard, setStandard] = useState(initial?.standard ?? "");
  const [responsible, setResponsible] = useState<string[]>(initial?.responsible ?? []);
  const [objectives, setObjectives] = useState<string[]>(initial?.objectives ?? [""]);
  const [hasActivities, setHasActivities] = useState(
    (initial?.activities.length ?? 1) > 0 || (!!lockBudget && (lockedDraftActivities?.length ?? 0) > 0),
  );
  const [activities, setActivities] = useState<ActivityRow[]>(() => {
    if (initial && lockBudget && lockedDraftActivities && lockedDraftActivities.length > 0) {
      return lockedDraftActivities.map((d, i) => {
        const match =
          initial.activities.find((a) => a.name.trim() === d.name.trim()) ??
          (initial.activities.length === lockedDraftActivities.length ? initial.activities[i] : undefined);
        return { name: d.name, responsible: match?.responsible ?? [], budget: String(d.budget) };
      });
    }
    return initial?.activities ?? [emptyActivity()];
  });
  const [budgetConfirmed, setBudgetConfirmed] = useState(false);
  const [projectBudget, setProjectBudget] = useState(
    initial && !hasActivities ? String(initial.budgetAmount) : "",
  );
  const [indicatorsQuantity, setIndicatorsQuantity] = useState<IndicatorRow[]>(
    initial?.indicatorsQuantity ?? [emptyIndicator()],
  );
  const [indicatorsQuality, setIndicatorsQuality] = useState<IndicatorRow[]>(
    initial?.indicatorsQuality ?? [emptyIndicator()],
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, boolean>>>({});

  const fileWordRef = useRef<HTMLDivElement>(null);
  const filePdfRef = useRef<HTMLDivElement>(null);
  const responsibleRef = useRef<HTMLDivElement>(null);
  const objectivesRef = useRef<HTMLDivElement>(null);
  const indicatorsQuantityRef = useRef<HTMLDivElement>(null);
  const indicatorsQualityRef = useRef<HTMLDivElement>(null);

  function refFor(key: FieldKey) {
    switch (key) {
      case "file_url_word":
        return fileWordRef;
      case "file_url_pdf":
        return filePdfRef;
      case "responsible":
        return responsibleRef;
      case "objectives":
        return objectivesRef;
      case "indicators_quantity":
        return indicatorsQuantityRef;
      case "indicators_quality":
        return indicatorsQualityRef;
    }
  }

  const lockedDraft = draftProjects.find((d) => d.id === selectedDraftId) ?? null;
  // สร้างใหม่: ชื่อมาจากร่างโครงการที่เลือกเท่านั้น / แก้ไข: เฉพาะผู้ดูแลระบบ (lockBudget=false) แก้ชื่อได้
  const nameReadOnly = initial ? lockBudget : true;
  // ร่างที่เลือกมีกิจกรรมและงบรวมกิจกรรมเท่างบร่างแล้ว (กำหนดครบ) — ชื่อ/งบกิจกรรมใช้ตามร่าง ครูแก้ไม่ได้
  const draftActivitiesFinal = (d: DraftProject | null) => {
    if (!d || !d.activities || d.activities.length === 0) return false;
    return Math.abs(d.activities.reduce((sum, a) => sum + a.budget, 0) - d.budget) < 0.01;
  };
  const activitiesLocked = initial
    ? lockBudget && (lockedDraftActivities?.length ?? 0) > 0
    : draftActivitiesFinal(lockedDraft);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const existingNameKeys = useMemo(
    () => new Set(existingProposalNames.map(normalizeProposalName)),
    [existingProposalNames],
  );
  const proposedDraftIdSet = useMemo(() => new Set(proposedDraftIds), [proposedDraftIds]);
  // ร่างโครงการนี้ส่งข้อเสนอไปแล้วหรือยัง: ผูกด้วย id (เลือกจากช่องร่างโครงการ) หรือชื่อตรงกับข้อเสนอที่มีอยู่
  const isDraftProposed = (d: DraftProject) =>
    proposedDraftIdSet.has(d.id) || existingNameKeys.has(normalizeProposalName(d.name));
  // ช่องเลือกร่างโครงการแสดงเฉพาะร่างที่ยังไม่ได้เสนอ (ถ้าเลือกค้างไว้อยู่ ยังคงแสดงรายการนั้นเพื่อไม่ให้ช่องว่างกะทันหัน)
  const availableDrafts = draftProjects.filter((d) => !isDraftProposed(d) || d.id === selectedDraftId);
  const isDuplicateName =
    (name.trim() !== "" && existingNameKeys.has(normalizeProposalName(name))) ||
    (!!lockedDraft && proposedDraftIdSet.has(lockedDraft.id));

  function handleDraftSelect(draftId: string) {
    setSelectedDraftId(draftId);
    if (!draftId) {
      setName("");
      setBudgetConfirmed(false);
      return;
    }
    const draft = draftProjects.find((d) => d.id === draftId);
    if (!draft) return;
    setName(draft.name);
    if (isDraftProposed(draft)) {
      void toastError(`โครงการ "${draft.name}" ได้ส่งข้อเสนอโครงการไปแล้ว ไม่สามารถส่งซ้ำได้`);
    }
    setAdminGroupId(draft.adminGroupId ?? "");
    setBudgetSourceId(draft.budgetSourceId ?? "");
    setProjectBudget(String(draft.budget));
    setBudgetConfirmed(false);
    if (draftActivitiesFinal(draft)) {
      // ดึงกิจกรรม + งบจากร่างมาให้ (ครูกรอกได้เฉพาะผู้รับผิดชอบ)
      setHasActivities(true);
      setActivities((draft.activities ?? []).map((a) => ({ name: a.name, responsible: [], budget: String(a.budget) })));
    } else {
      setHasActivities(false);
      if (draft.activities && draft.activities.length > 0) {
        void toastError(
          `ร่างโครงการ "${draft.name}" ยังกำหนดงบรายกิจกรรมไม่ครบ กรุณาแจ้งผู้ดูแลระบบให้ตรวจสอบก่อนส่งข้อเสนอ`,
        );
      }
    }
  }

  function updateActivity(index: number, patch: Partial<ActivityRow>) {
    setActivities((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function chooseHasActivities(next: boolean) {
    setHasActivities(next);
    if (next && activities.length === 0) setActivities([emptyActivity()]);
  }

  const totalBudget = useMemo(
    () => activities.reduce((sum, a) => sum + (parseFloat(a.budget) || 0), 0),
    [activities],
  );

  // งบที่กำหนดไว้ที่ยอดรวมกิจกรรมย่อยต้องเท่ากับ: งบของร่างโครงการที่เลือก หรือ (ครูแก้ไขข้อเสนอเดิม) งบเดิมของข้อเสนอ
  // (กิจกรรมล็อกตามร่าง: ยอดรวมตรงกับร่างอยู่แล้ว ไม่ต้องตรวจเทียบซ้ำ)
  const budgetTarget: number | null = activitiesLocked
    ? null
    : lockedDraft
      ? lockedDraft.budget
      : lockBudget && hasActivities && initial
        ? initial.budgetAmount
        : null;
  const budgetTargetLabel = lockedDraft ? "ร่างโครงการ" : "งบที่กำหนดไว้เดิม";
  const activityBudgetDiff = budgetTarget !== null && hasActivities ? totalBudget - budgetTarget : 0;
  const budgetMismatch = Math.abs(activityBudgetDiff) >= 0.01;

  function validate(formData: FormData): Partial<Record<FieldKey, boolean>> {
    const errors: Partial<Record<FieldKey, boolean>> = {};
    if (!String(formData.get("file_url_word") ?? "").trim()) errors.file_url_word = true;
    if (!String(formData.get("file_url_pdf") ?? "").trim()) errors.file_url_pdf = true;
    if (responsible.length === 0) errors.responsible = true;
    if (!objectives.some((o) => o.trim() !== "")) errors.objectives = true;
    if (!indicatorsQuantity.some((r) => r.indicator.trim() !== "" && r.target.trim() !== ""))
      errors.indicators_quantity = true;
    if (!indicatorsQuality.some((r) => r.indicator.trim() !== "" && r.target.trim() !== ""))
      errors.indicators_quality = true;
    return errors;
  }

  async function handleSubmit(formData: FormData) {
    // กันกดส่งซ้ำ: ถ้ากำลังส่งอยู่ ไม่ทำซ้ำ
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    let keepLocked = false;
    try {
      keepLocked = await doSubmit(formData);
    } finally {
      // ส่งสำเร็จตอนสร้างใหม่: ล็อกปุ่มไว้จนกว่าจะเปลี่ยนหน้า (กันกดซ้ำระหว่างรอ) ส่วนกรณีอื่นปลดล็อก
      if (!keepLocked) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  /** คืน true เมื่อส่งสำเร็จตอนสร้างใหม่ (ให้คงปุ่มถูกล็อกไว้) */
  async function doSubmit(formData: FormData): Promise<boolean> {
    if (!initial && !selectedDraftId) {
      await toastError("กรุณาเลือกโครงการจากร่างโครงการก่อนส่งข้อเสนอ");
      return false;
    }
    if (isDuplicateName) {
      await toastError("โครงการนี้ได้ส่งข้อเสนอโครงการไปแล้ว ไม่สามารถส่งซ้ำได้");
      return false;
    }
    if (!initial && !budgetConfirmed) {
      await toastError("กรุณากดยืนยันงบประมาณที่ได้รับก่อนส่งข้อเสนอโครงการ");
      return false;
    }
    if (!initial) formData.set("budget_confirmed", "yes");
    formData.set("has_activities", hasActivities ? "yes" : "no");
    formData.set("activities_json", JSON.stringify(hasActivities ? activities : []));
    formData.set("objectives_json", JSON.stringify(objectives.filter((o) => o.trim() !== "")));
    formData.set("indicators_quantity_json", JSON.stringify(indicatorsQuantity.filter((r) => r.indicator.trim() !== "")));
    formData.set("indicators_quality_json", JSON.stringify(indicatorsQuality.filter((r) => r.indicator.trim() !== "")));

    if (budgetMismatch) {
      await toastError(
        activityBudgetDiff > 0
          ? `งบประมาณกิจกรรมย่อยรวมเกินจากที่กำหนดไว้ใน${budgetTargetLabel} ${formatBaht(activityBudgetDiff)} บาท กรุณาแก้ไขให้ยอดรวมตรงกันก่อนบันทึก`
          : `งบประมาณกิจกรรมย่อยรวมยังขาดจากที่กำหนดไว้ใน${budgetTargetLabel} ${formatBaht(Math.abs(activityBudgetDiff))} บาท กรุณาแก้ไขให้ยอดรวมตรงกันก่อนบันทึก`,
      );
      return false;
    }

    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = FIELD_ORDER.find((k) => errors[k]);
      if (firstKey) refFor(firstKey).current?.scrollIntoView({ behavior: "smooth", block: "center" });
      await toastError("กรุณากรอกข้อมูลให้ครบถ้วนตามที่ระบุ (จุดที่มีกรอบสีแดง)");
      return false;
    }
    setFieldErrors({});

    try {
      const result = await action(formData);
      if (result && typeof result === "object" && result.error) {
        await toastError(result.error);
        return false;
      }
      await toastSuccess(successMessage);
      onSuccess?.();
      return !initial;
    } catch (err) {
      await toastError(errorMessage(err));
      return false;
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4 text-left">
      <input type="hidden" name="budget_year_id" value={budgetYearId} />
      {selectedDraftId && <input type="hidden" name="draft_project_id" value={selectedDraftId} />}

      <div>
        <div className="card-title">ข้อมูลทั่วไป</div>
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div ref={fileWordRef} className={fieldErrors.file_url_word ? "rounded-xl ring-2 ring-red-400" : ""}>
                <ProposalFileUpload
                  name="file_url_word"
                  label="ไฟล์โครงการ Word (.doc, .docx)"
                  accept=".doc,.docx"
                  initialPath={initial?.fileUrlWordPath}
                />
                <FieldError show={!!fieldErrors.file_url_word} message="กรุณาแนบไฟล์โครงการ Word" />
              </div>
              <div ref={filePdfRef} className={fieldErrors.file_url_pdf ? "rounded-xl ring-2 ring-red-400" : ""}>
                <ProposalFileUpload
                  name="file_url_pdf"
                  label="ไฟล์โครงการ PDF (.pdf)"
                  accept=".pdf"
                  initialPath={initial?.fileUrlPdfPath}
                />
                <FieldError show={!!fieldErrors.file_url_pdf} message="กรุณาแนบไฟล์โครงการ PDF" />
              </div>
            </div>
          </div>
          {!initial && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <label className="label">
                เลือกโครงการ (จากร่างโครงการที่เตรียมไว้) <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedDraftId}
                onChange={(e) => handleDraftSelect(e.target.value)}
                required
                className="input"
              >
                <option value="">— กรุณาเลือกโครงการ —</option>
                {availableDrafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {lockedDraft && isDuplicateName && <DuplicateWarning />}
              <p className="mt-1 text-xs text-slate-500">
                {availableDrafts.length === 0
                  ? "ร่างโครงการทุกรายการถูกเสนอไปแล้ว ไม่มีรายการให้เลือก — หากต้องการเสนอโครงการอื่น กรุณาติดต่อผู้ดูแลระบบให้เพิ่มร่างโครงการก่อน"
                  : `เลือกได้เฉพาะร่างโครงการที่ยังไม่ได้เสนอ (${availableDrafts.length.toLocaleString("th-TH")} รายการ) เลือกแล้วระบบจะเติมชื่อโครงการ กลุ่มงาน แหล่งเงินงบประมาณ และงบประมาณให้อัตโนมัติ`}
              </p>
            </div>
          )}
          <div>
            <label className="label">ชื่อโครงการ</label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              // ชื่อโครงการเลือกจากร่างโครงการเท่านั้น (ฟอร์มสร้างใหม่) / ครูแก้ชื่อเองไม่ได้ (ฟอร์มแก้ไข) — readOnly ยังส่งค่าไปกับฟอร์มตามปกติ
              readOnly={nameReadOnly}
              placeholder={!initial ? "ชื่อโครงการจะแสดงเมื่อเลือกจากร่างโครงการด้านบน" : undefined}
              className={`input read-only:cursor-not-allowed read-only:bg-slate-100 read-only:text-slate-500 ${
                isDuplicateName ? "border-red-400 ring-1 ring-red-300" : ""
              }`}
            />
            {nameReadOnly && (
              <p className="mt-1 text-xs text-slate-500">
                {initial
                  ? "ชื่อโครงการแก้ไขไม่ได้ หากต้องการแก้ชื่อ กรุณาติดต่อผู้ดูแลระบบ"
                  : "ชื่อโครงการเลือกจากร่างโครงการเท่านั้น พิมพ์เองไม่ได้"}
              </p>
            )}
            {isDuplicateName && <DuplicateWarning />}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">สนองกลยุทธ์โรงเรียน</label>
              <select
                name="strategy_alignment"
                required
                value={strategyAlignment}
                onChange={(e) => setStrategyAlignment(e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  เลือกกลยุทธ์..
                </option>
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
                required
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
                className="input"
              >
                <option value="" disabled>
                  เลือกมาตรฐาน..
                </option>
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
            <select
              name="admin_group_id"
              required
              value={adminGroupId}
              onChange={(e) => setAdminGroupId(e.target.value)}
              disabled={!!lockedDraft || lockBudget}
              className="input disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="" disabled>
                เลือกกลุ่มบริหาร..
              </option>
              {adminGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {(lockedDraft || lockBudget) && <input type="hidden" name="admin_group_id" value={adminGroupId} />}
          </div>
          <div ref={responsibleRef} className={fieldErrors.responsible ? "rounded-xl ring-2 ring-red-400 p-1" : ""}>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <TeacherMultiSelect teachers={teachers} value={responsible} onChange={setResponsible} />
            {responsible.map((n) => (
              <input key={n} type="hidden" name="responsible" value={n} />
            ))}
            <FieldError show={!!fieldErrors.responsible} message="กรุณาเลือกผู้รับผิดชอบโครงการอย่างน้อย 1 คน" />
          </div>
          <div ref={objectivesRef} className={fieldErrors.objectives ? "rounded-xl ring-2 ring-red-400 p-1" : ""}>
            <ListField
              label="วัตถุประสงค์"
              placeholder="เพื่อ..."
              values={objectives}
              onChange={setObjectives}
              addLabel="+ เพิ่มวัตถุประสงค์"
            />
            <FieldError show={!!fieldErrors.objectives} message="กรุณากรอกวัตถุประสงค์อย่างน้อย 1 ข้อ" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">ขั้นตอนการดำเนินงาน และงบประมาณ</div>
        <div className="mb-3 w-full sm:w-56">
          <label className="label">แหล่งเงินงบประมาณ</label>
          <select
            name="budget_source_id"
            required
            value={budgetSourceId}
            onChange={(e) => setBudgetSourceId(e.target.value)}
            disabled={!!lockedDraft || lockBudget}
            className="input disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="" disabled>
              เลือกแหล่งเงินงบประมาณ..
            </option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {(lockedDraft || lockBudget) && <input type="hidden" name="budget_source_id" value={budgetSourceId} />}
        </div>
        {lockBudget && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            กลุ่มงานที่รับผิดชอบ แหล่งเงินงบประมาณ และงบรวมก้อนเดียวแก้ไขไม่ได้ หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลระบบ
          </p>
        )}
        <div className="mb-1 text-sm font-medium text-slate-700">โครงการนี้กรอกงบประมาณแบบไหน?</div>
        <div role="radiogroup" aria-label="วิธีกรอกงบประมาณโครงการ" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              value: true,
              title: "แยกงบตามกิจกรรม",
              desc: "โครงการมีหลายกิจกรรม ต้องการระบุชื่อ ผู้รับผิดชอบ และงบของแต่ละกิจกรรม ระบบจะรวมงบให้เอง",
            },
            {
              value: false,
              title: "งบรวมก้อนเดียว",
              desc: "โครงการไม่ได้แยกกิจกรรม ใส่งบประมาณรวมของโครงการช่องเดียว",
            },
          ].map((opt) => {
            const selected = hasActivities === opt.value;
            return (
              <button
                key={opt.title}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseHasActivities(opt.value)}
                disabled={lockBudget || activitiesLocked}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed ${
                  selected
                    ? "border-navy-800 bg-navy-50/60"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } ${(lockBudget || activitiesLocked) && !selected ? "opacity-50" : ""}`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-navy-800 bg-navy-800" : "border-slate-300"
                  }`}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{opt.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        {hasActivities ? (
          <>
            <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/80">
              <div className="hidden grid-cols-[1fr_8rem_6rem_3.5rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                <div>ชื่อกิจกรรมย่อย</div>
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
                      <label className="label sm:hidden">ชื่อกิจกรรมย่อย</label>
                      <input
                        value={row.name}
                        onChange={(e) => updateActivity(i, { name: e.target.value })}
                        readOnly={activitiesLocked}
                        className="input read-only:bg-slate-100 read-only:text-slate-600"
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
                        readOnly={activitiesLocked}
                        className="input text-right read-only:bg-slate-100 read-only:text-slate-600"
                        placeholder="0.00"
                      />
                    </div>
                    {activities.length > 1 && !activitiesLocked && (
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
                <span className="font-bold text-navy-800">
                  {formatBaht(budgetTarget ?? totalBudget)} บาท
                </span>
              </div>
              {budgetMismatch && (
                <div role="alert" className="flex flex-wrap items-center justify-end gap-2 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  <span>
                    งบประมาณกิจกรรมย่อยรวม {formatBaht(totalBudget)} บาท —{" "}
                    {activityBudgetDiff > 0
                      ? `เกินจาก${budgetTargetLabel} ${formatBaht(activityBudgetDiff)} บาท`
                      : `ยังขาดอีก ${formatBaht(Math.abs(activityBudgetDiff))} บาท`}
                  </span>
                </div>
              )}
            </div>
            {budgetTarget !== null && !activitiesLocked && (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  งบประมาณกิจกรรมย่อยกรอกเองได้ตามจริง แต่ยอดรวมงบประมาณทั้งสิ้นจะยึดตามที่กำหนดไว้ใน{budgetTargetLabel} —
                  ยอดรวมกิจกรรมย่อยต้องตรงกับยอดนี้พอดี จึงจะบันทึกได้
                </p>
                {lockedDraft && <input type="hidden" name="locked_budget_amount" value={lockedDraft.budget} />}
              </>
            )}
            {activitiesLocked && lockedDraft && <input type="hidden" name="locked_budget_amount" value={lockedDraft.budget} />}
            {!activitiesLocked && (
              <button type="button" onClick={() => setActivities((prev) => [...prev, emptyActivity()])} className="btn-secondary btn-sm">
                + เพิ่มกิจกรรม
              </button>
            )}
          </>
        ) : (
          <div>
            <label className="label">งบประมาณโครงการ</label>
            <input
              type="number"
              step="0.01"
              name="project_budget"
              required
              value={projectBudget}
              onChange={(e) => setProjectBudget(e.target.value)}
              disabled={!!lockedDraft || lockBudget}
              className="input disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="0.00"
            />
            {(lockedDraft || lockBudget) && <input type="hidden" name="project_budget" value={projectBudget} />}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">ตัวชี้วัดและเป้าหมายความสำเร็จ</div>
        <div className="grid grid-cols-1 gap-4">
          <div
            ref={indicatorsQuantityRef}
            className={fieldErrors.indicators_quantity ? "rounded-xl ring-2 ring-red-400 p-1" : ""}
          >
            <IndicatorList
              label="เชิงปริมาณ"
              rows={indicatorsQuantity}
              onChange={setIndicatorsQuantity}
              addLabel="+ เพิ่มตัวชี้วัดเชิงปริมาณ"
              indicatorPlaceholder="เช่น ร้อยละของนักเรียนที่เข้าร่วมกิจกรรมตามเป้าหมายที่กำหนด"
              targetPlaceholder="เช่น ร้อยละ 90"
            />
            <FieldError
              show={!!fieldErrors.indicators_quantity}
              message="กรุณากรอกตัวชี้วัดเชิงปริมาณอย่างน้อย 1 รายการ (ทั้งตัวชี้วัดและค่าเป้าหมาย)"
            />
          </div>
          <div
            ref={indicatorsQualityRef}
            className={fieldErrors.indicators_quality ? "rounded-xl ring-2 ring-red-400 p-1" : ""}
          >
            <IndicatorList
              label="เชิงคุณภาพ"
              rows={indicatorsQuality}
              onChange={setIndicatorsQuality}
              addLabel="+ เพิ่มตัวชี้วัดเชิงคุณภาพ"
              indicatorPlaceholder="เช่น ระดับความพึงพอใจของผู้เข้าร่วมกิจกรรมต่อการดำเนินโครงการ"
              targetPlaceholder="เช่น ระดับดีขึ้นไป (ร้อยละ 80)"
            />
            <FieldError
              show={!!fieldErrors.indicators_quality}
              message="กรุณากรอกตัวชี้วัดเชิงคุณภาพอย่างน้อย 1 รายการ (ทั้งตัวชี้วัดและค่าเป้าหมาย)"
            />
          </div>
        </div>
      </div>

      {!initial && (
        <label
          className={`flex items-start gap-3 rounded-xl border-2 p-3 text-sm ${
            budgetConfirmed ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300 bg-amber-50/60"
          }`}
        >
          <input
            type="checkbox"
            checked={budgetConfirmed}
            onChange={(e) => setBudgetConfirmed(e.target.checked)}
            disabled={!lockedDraft}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span className="text-slate-800">
            {lockedDraft
              ? `ข้าพเจ้ายืนยันว่าได้รับงบประมาณโครงการนี้ ${formatBaht(lockedDraft.budget)} บาท`
              : "เลือกโครงการจากร่างโครงการก่อน แล้วยืนยันงบประมาณที่ได้รับ"}
          </span>
        </label>
      )}

      <SubmitButton
        label={submitting ? (initial ? "กำลังบันทึก…" : "กำลังส่ง…") : submitLabel}
        pendingLabel={initial ? "กำลังบันทึก… กรุณารอสักครู่" : "กำลังส่งข้อเสนอ… กรุณารอสักครู่"}
        disabled={submitting || budgetMismatch}
      />
      {budgetMismatch && budgetTarget !== null && (
        <p role="alert" className="text-sm font-medium text-red-600">
          บันทึกไม่ได้: งบรวมของกิจกรรมย่อย {formatBaht(totalBudget)} บาท ต้องเท่ากับ {formatBaht(budgetTarget)} บาท
          ({activityBudgetDiff > 0 ? "เกิน" : "ขาด"} {formatBaht(Math.abs(activityBudgetDiff))} บาท)
        </p>
      )}
    </form>
  );
}
