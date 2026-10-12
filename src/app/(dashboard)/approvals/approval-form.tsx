"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatThaiDate } from "@/lib/thai";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";

type ProjectOption = { id: string; name: string; adminGroupId: string; budget: number; approvedSoFar: number };
type ActivityOption = { id: string; project_id: string; name: string | null; responsible: string[] };
type AdminGroupOption = { id: string; name: string };
type TeacherOption = { id: string; name: string; is_active: boolean };
type LearningAreaOption = { id: string; name: string };
// กลุ่มสาระการเรียนรู้ (จัดการได้ที่หน้าตั้งค่า) — เป็นตัวเลือกของช่อง "ฝ่าย/กลุ่ม/สาระฯ/งาน" ต่อจากกลุ่มบริหารงาน
// ใช้ชื่อวิชาที่ตัดคำนำหน้า "กลุ่มสาระการเรียนรู้" ออก มาจับคู่กับชื่อโครงการ เพื่อกรองตัวเลือกโครงการ
function learningAreaKeyword(name: string) {
  return name.replace(/^กลุ่มสาระการเรียนรู้\s*/, "").trim() || name;
}
// โครงการที่ใช้ร่วมกันทุกกลุ่มสาระ (เช่น "โครงการยกระดับผลสัมฤทธิ์ทางการเรียน 8 กลุ่มสาระและ O-Net")
const ALL_AREAS_PATTERN = /8\s*กลุ่มสาระ/;

// PDF แบบเดิม (เขียนทับเทมเพลต) รองรับ 29 แถว (ดู itemRowsY ใน src/lib/pdf-overlay/render-approval-pdf.ts — แถวเกินจะถูกตัดทิ้ง)
// PDF แบบใหม่ (วาดใหม่ทั้งหมด) พิมพ์ต่อหน้าถัดไปได้ จึงอนุญาตเกิน 29 แถวได้ถึง MAX_ITEM_ROWS
const TEMPLATE_ITEM_ROWS = 29;
const MAX_ITEM_ROWS = 100;
type ItemRow = { name: string; qty: string; unit: string; unitPrice: string; note: string };
const EMPTY_ITEM_ROW: ItemRow = { name: "", qty: "", unit: "", unitPrice: "", note: "" };

const SUMMARY_LABELS = ["จัดซื้อจัดจ้าง", "ค่าเบี้ยเลี้ยง/ค่าตอบแทน", "ค่าเดินทางไปราชการ", "ค่าสาธารณูปโภค", "อื่นๆ (ระบุ)"];

type SummaryRow = { label: string; amount: string; note: string };

function emptySummaryRows(): SummaryRow[] {
  return SUMMARY_LABELS.map((label) => ({ label, amount: "", note: "" }));
}

function emptyItemRows(): ItemRow[] {
  return [{ ...EMPTY_ITEM_ROW }];
}

// ป้ายกำกับช่องในฟอร์ม มีเลขลำดับกำกับ (เห็นชัดบนมือถือที่ช่องไม่มี placeholder เหลืออยู่หลังกรอกแล้ว)
function FieldLabel({ n, text, required }: { n: number; text: string; required?: boolean }) {
  return (
    <label className="label">
      {n}. {text}
      {required && <span className="text-red-600"> *</span>}
    </label>
  );
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export type ApprovalFormInitial = {
  doc_number: string | null;
  doc_date: string;
  subject: string;
  addressed_to: string;
  department: string | null;
  activity_name: string | null;
  project_id: string | null;
  plan_date_text: string | null;
  group_name: string | null;
  budget_year_text: string | null;
  requested_by_name: string | null;
  requested_by_position: string | null;
  fund_type: string | null;
  summary_items: { label: string; amount: number | null; note: string | null }[];
  items: { name: string | null; qty: number | null; unit: string | null; unit_price: number | null; note: string | null }[];
};

function initialSummaryRows(initial?: ApprovalFormInitial): SummaryRow[] {
  if (!initial) return emptySummaryRows();
  return SUMMARY_LABELS.map((label, i) => {
    const row = initial.summary_items[i];
    return { label, amount: row?.amount != null ? String(row.amount) : "", note: row?.note ?? "" };
  });
}

function initialItemRows(initial?: ApprovalFormInitial): ItemRow[] {
  if (!initial) return emptyItemRows();
  const rows = initial.items
    .filter((item) => item.name || item.qty != null || item.unit_price != null || item.note)
    .map((item) => ({
      name: item.name ?? "",
      qty: item.qty != null ? String(item.qty) : "",
      unit: item.unit ?? "",
      unitPrice: item.unit_price != null ? String(item.unit_price) : "",
      note: item.note ?? "",
    }));
  return rows.length > 0 ? rows : emptyItemRows();
}

export function ApprovalForm({
  action,
  projects,
  activities,
  adminGroups,
  teachers,
  learningAreas,
  unitSuggestions = [],
  initial,
  submitLabel = "บันทึกและสร้างเอกสาร",
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: ProjectOption[];
  activities: ActivityOption[];
  adminGroups: AdminGroupOption[];
  teachers: TeacherOption[];
  learningAreas: LearningAreaOption[];
  /** คำแนะนำหน่วยนับ (ขึ้นช่วยกรอกในช่อง "หน่วยนับ" ของรายการวัสดุ) */
  unitSuggestions?: string[];
  initial?: ApprovalFormInitial;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>(initialSummaryRows(initial));
  const [itemRows, setItemRows] = useState<ItemRow[]>(initialItemRows(initial));
  const [activityName, setActivityName] = useState(initial?.activity_name ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [requestedBy, setRequestedBy] = useState(initial?.requested_by_name ?? "");
  const [planDateISO, setPlanDateISO] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // เลือกกลุ่มงานแล้วให้แสดงเฉพาะโครงการของกลุ่มนั้น (โครงการที่เลือกอยู่ยังแสดงเสมอ กันค่าเดิมหายตอนแก้ไขบันทึกเก่า)
  // กลุ่มบริหารงาน → จับคู่ตามกลุ่มของโครงการ, กลุ่มสาระฯ → จับคู่ตามชื่อโครงการ, ไม่ได้เลือก → ทุกโครงการ
  function projectMatchesDepartment(p: ProjectOption, dept: string): boolean {
    if (!dept) return true;
    const group = adminGroups.find((g) => g.name === dept);
    if (group) return p.adminGroupId === group.id;
    const area = learningAreas.find((a) => a.name === dept);
    if (area) return p.name.includes("กลุ่มสาระ") && (p.name.includes(learningAreaKeyword(area.name)) || ALL_AREAS_PATTERN.test(p.name));
    return true;
  }
  const projectChoices = useMemo(
    () => projects.filter((p) => projectMatchesDepartment(p, department) || p.id === projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, adminGroups, learningAreas, department, projectId],
  );

  const selected = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);
  const activityOptions = useMemo(() => activities.filter((a) => a.project_id === projectId), [activities, projectId]);

  // เปลี่ยนโครงการแล้วให้เลือกกิจกรรมใหม่ (กิจกรรมเดิมอาจไม่ได้อยู่ในโครงการนี้) — ยกเว้นตอนโหลดครั้งแรก
  const isFirstProjectRender = useRef(true);
  useEffect(() => {
    if (isFirstProjectRender.current) {
      isFirstProjectRender.current = false;
      return;
    }
    setActivityName("");
  }, [projectId]);

  const visibleTeachers = useMemo(
    () => teachers.filter((t) => t.is_active || t.name === initial?.requested_by_name),
    [teachers, initial?.requested_by_name],
  );

  // ผู้รับผิดชอบที่เป็นตัวเลือกผู้ลงชื่อขออนุมัติ — ถ้าเลือกกิจกรรมแล้วใช้ผู้รับผิดชอบของกิจกรรมนั้น
  // ไม่งั้นรวมผู้รับผิดชอบทุกกิจกรรมของโครงการ (โครงการที่ไม่มีกิจกรรมย่อยก็เก็บไว้ที่กิจกรรมเดียวไม่มีชื่อ)
  function candidatesFor(pid: string, aname: string): string[] {
    const inProject = activities.filter((a) => a.project_id === pid);
    const matched = aname ? inProject.filter((a) => a.name === aname) : inProject;
    const names = matched.flatMap((a) => a.responsible.map((n) => n.trim()).filter(Boolean));
    return Array.from(new Set(names));
  }
  // ลงชื่อผู้ขออนุมัติอัตโนมัติเมื่อเปลี่ยนโครงการ/กิจกรรม: มีคนเดียวเลือกให้เลย, มีหลายคนให้เลือกเอง
  // (คงค่าเดิมไว้ถ้ายังอยู่ในตัวเลือก), ไม่มีข้อมูลผู้รับผิดชอบก็ไม่แตะค่าที่เลือกไว้
  function autoSelectRequester(pid: string, aname: string) {
    const list = candidatesFor(pid, aname);
    if (list.length === 1) setRequestedBy(list[0]);
    else if (list.length > 1) setRequestedBy((cur) => (list.includes(cur) ? cur : ""));
  }
  const requesterCandidates = useMemo(
    () => candidatesFor(projectId, activityName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, projectId, activityName],
  );
  const otherTeachers = visibleTeachers.filter((t) => !requesterCandidates.includes(t.name));

  function handleDepartmentChange(name: string) {
    setDepartment(name);
    const current = projects.find((p) => p.id === projectId);
    // โครงการที่เลือกไว้ไม่ใช่ของกลุ่มที่เพิ่งเลือก → ล้างโครงการ/กิจกรรมให้เลือกใหม่
    if (current && !projectMatchesDepartment(current, name)) {
      setProjectId("");
      setActivityName("");
    }
  }

  const requestedAmount = summaryRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = selected ? selected.budget - selected.approvedSoFar - requestedAmount : 0;
  const itemsGrandTotal = itemRows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0), 0);

  function updateSummaryRow(index: number, patch: Partial<SummaryRow>) {
    setSummaryRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>) {
    setItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addItemRow() {
    setItemRows((prev) => (prev.length >= MAX_ITEM_ROWS ? prev : [...prev, { ...EMPTY_ITEM_ROW }]));
  }

  function removeItemRow(index: number) {
    setItemRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // ปฏิทิน พ.ศ. ใช้ hidden input ซึ่งเบราว์เซอร์ไม่บังคับ required ให้ — เช็คเองก่อนส่ง
    if (!String(formData.get("doc_date") ?? "").trim()) {
      await toastError("กรุณาเลือกวันที่บันทึกข้อความ");
      return;
    }
    if (!String(formData.get("department") ?? "").trim()) {
      await toastError("กรุณาเลือกฝ่าย/กลุ่ม/สาระฯ/งาน");
      return;
    }
    if (!planDateISO && !initial?.plan_date_text) {
      await toastError("กรุณาเลือกวันที่จะดำเนินการ");
      return;
    }
    if (!summaryRows.some((r) => (parseFloat(r.amount) || 0) > 0) || requestedAmount <= 0) {
      await toastError("กรุณากรอกรายการเงินที่ขออนุมัติอย่างน้อย 1 รายการ และยอดรวมต้องมากกว่า 0");
      return;
    }
    formData.set("summary_items_json", JSON.stringify(summaryRows));
    formData.set("items_json", JSON.stringify(itemRows));
    formData.set("budget", selected ? String(selected.budget) : "");
    formData.set("requested_amount", String(requestedAmount));
    formData.set("remaining", String(remaining));
    formData.set("fund_type", initial?.fund_type ?? "");
    formData.set("activity_name", activityName);
    formData.set("plan_date_text", planDateISO ? formatThaiDate(planDateISO) : (initial?.plan_date_text ?? ""));
    formData.set("requested_by_position", initial?.requested_by_position ?? "");
    formData.set("group_name", initial?.group_name ?? "");
    formData.set("budget_year_text", initial?.budget_year_text ?? "");
    if (initial) formData.set("doc_number", initial.doc_number ?? "");

    const ok = await confirmWarning({ title: initial ? "ยืนยันบันทึกการแก้ไข?" : "ยืนยันบันทึกข้อมูล?" });
    if (!ok) return;

    setSubmitting(true);
    try {
      await action(formData);
      await toastSuccess(initial ? "บันทึกการแก้ไขแล้ว" : "บันทึกข้อมูลแล้ว");
      router.push("/approvals");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card">
        <h2 className="card-title">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {initial ? (
            <div>
              <FieldLabel n={1} text="เลขที่หนังสือ" />
              <input readOnly value={initial.doc_number ?? ""} className="input w-full bg-slate-50" />
            </div>
          ) : (
            <div>
              <FieldLabel n={1} text="เลขที่หนังสือ" />
              <input readOnly value="รันอัตโนมัติเมื่อบันทึก" className="input w-full bg-slate-50 text-slate-400" />
            </div>
          )}
          <div>
            <FieldLabel n={2} text="วันที่บันทึกข้อความ" required />
            <ThaiDatePicker name="doc_date" defaultValue={initial?.doc_date ?? null} />
          </div>
          <div className="hidden sm:block" />
          <div className="sm:col-span-3">
            <FieldLabel n={3} text="เรื่อง" required />
            <input
              name="subject"
              defaultValue={initial?.subject ?? "ขออนุญาตดำเนินการและอนุมัติใช้เงินโครงการ"}
              required
              className="input w-full"
            />
          </div>
          <div className="sm:col-span-3">
            <FieldLabel n={4} text="เรียน" required />
            <input
              name="addressed_to"
              defaultValue={initial?.addressed_to ?? "ผู้อำนวยการโรงเรียนตาเบาวิทยา"}
              required
              className="input w-full"
            />
          </div>

          <div className="sm:col-span-3">
            <FieldLabel n={5} text="ฝ่าย/กลุ่ม/สาระฯ/งาน" required />
            <select
              name="department"
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              required
              className="input w-full"
            >
              <option value="">-- ฝ่าย/กลุ่ม/สาระฯ/งาน --</option>
              <optgroup label="ฝ่าย/กลุ่มบริหาร/งาน">
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
              {learningAreas.length > 0 && (
                <optgroup label="กลุ่มสาระการเรียนรู้">
                  {learningAreas.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {/* ค่าเดิมของบันทึกเก่าที่ไม่อยู่ในรายการปัจจุบัน (เช่น กลุ่มสาระที่ปิดใช้งานหรือเปลี่ยนชื่อภายหลัง) */}
              {department &&
                !adminGroups.some((g) => g.name === department) &&
                !learningAreas.some((a) => a.name === department) && <option value={department}>{department}</option>}
            </select>
          </div>

          <div className="sm:col-span-3">
            <FieldLabel n={6} text="โครงการ/งานที่ต้องการเบิก" required />
            <select
              name="project_id"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                autoSelectRequester(e.target.value, "");
              }}
              required
              className="input w-full border-navy-600 bg-navy-950/[0.03]"
            >
              <option value="" disabled>
                -- เลือกโครงการ/งานที่ต้องการเบิก --
              </option>
              {projectChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <FieldLabel n={7} text="กิจกรรม" />
            <select
              value={activityName}
              onChange={(e) => {
                setActivityName(e.target.value);
                autoSelectRequester(projectId, e.target.value);
              }}
              disabled={!projectId}
              className="input w-full"
            >
              <option value="">
                {projectId ? "-- เลือกชื่อกิจกรรม --" : "-- เลือกโครงการก่อน --"}
              </option>
              {activityOptions.map((a) => (
                <option key={a.id} value={a.name ?? ""}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <FieldLabel n={8} text="จะดำเนินการวันที่" required />
            <ThaiDatePicker value={planDateISO || null} onChange={(iso) => setPlanDateISO(iso ?? "")} />
            {(planDateISO || initial?.plan_date_text) && (
              <p className="mt-1 text-xs text-slate-500">
                {planDateISO
                  ? `จะบันทึกเป็น: ${formatThaiDate(planDateISO)}`
                  : `ปัจจุบัน: ${initial?.plan_date_text} (เลือกวันที่ใหม่เพื่อเปลี่ยน)`}
              </p>
            )}
          </div>

          <div className="sm:col-span-3">
            <FieldLabel n={9} text="ผู้รับผิดชอบโครงการ (ผู้ขออนุมัติ)" required />
            <select
              name="requested_by_name"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              required
              className="input w-full"
            >
              <option value="" disabled>
                -- เลือกผู้ขออนุมัติ --
              </option>
              {requesterCandidates.length > 0 ? (
                <>
                  <optgroup label="ผู้รับผิดชอบตามโครงการ/กิจกรรมที่เลือก">
                    {requesterCandidates.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </optgroup>
                  {otherTeachers.length > 0 && (
                    <optgroup label="บุคลากรอื่น">
                      {otherTeachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                visibleTeachers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
            {requesterCandidates.length > 1 && (
              <p className="mt-1 text-xs text-amber-700">
                โครงการ/กิจกรรมนี้มีผู้รับผิดชอบ {requesterCandidates.length} คน — กรุณาเลือกผู้ลงชื่อขออนุมัติ 1 คน
              </p>
            )}
            {requesterCandidates.length === 1 && requestedBy === requesterCandidates[0] && (
              <p className="mt-1 text-xs text-slate-500">ลงชื่ออัตโนมัติตามผู้รับผิดชอบ (เปลี่ยนได้)</p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">รายการเงินที่ขออนุมัติ</h2>
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2">ที่</th>
                <th className="px-2 py-2 text-left">รายการ</th>
                <th className="w-32 px-2 py-2">จำนวนเงิน</th>
                <th className="px-2 py-2 text-left">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaryRows.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1 text-slate-700">{row.label}</td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateSummaryRow(i, { amount: e.target.value })}
                      className="input w-full text-right"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={row.note}
                      onChange={(e) => updateSummaryRow(i, { note: e.target.value })}
                      className="input w-full"
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="px-2 py-2 text-right">
                  รวมทั้งสิ้น
                </td>
                <td className="px-2 py-2 text-right text-red-600">{formatBaht(requestedAmount)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">เงินโครงการทั้งสิ้น (บาท)</label>
            <input
              readOnly
              value={selected ? formatBaht(selected.budget) : ""}
              placeholder="เลือกโครงการก่อน"
              className="input w-full bg-slate-50 text-right"
            />
          </div>
          <div>
            <label className="label">เงินโครงการเหลือ หลังขออนุมัติครั้งนี้ (บาท)</label>
            <input
              readOnly
              value={selected ? formatBaht(remaining) : ""}
              placeholder="เลือกโครงการก่อน"
              className="input w-full bg-slate-50 text-right font-bold text-emerald-700"
            />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">รายการวัสดุ อุปกรณ์ (หน้า 2 ของเอกสาร)</h2>
        <datalist id="approval-unit-suggestions">
          {unitSuggestions.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">รายการ</th>
                <th className="w-24 px-2 py-2">จำนวน</th>
                <th className="w-24 px-2 py-2">หน่วยนับ</th>
                <th className="w-28 px-2 py-2">ราคา/หน่วย</th>
                <th className="w-28 px-2 py-2">จำนวนเงิน</th>
                <th className="w-32 px-2 py-2">หมายเหตุ</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemRows.map((row, i) => {
                const total = (parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice) || 0);
                return (
                  <tr key={i}>
                    <td className="px-2 py-1">
                      <input value={row.name} onChange={(e) => updateItemRow(i, { name: e.target.value })} className="input w-full" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" step="0.01" value={row.qty} onChange={(e) => updateItemRow(i, { qty: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={row.unit} onChange={(e) => updateItemRow(i, { unit: e.target.value })} list="approval-unit-suggestions" placeholder="เช่น ชิ้น" autoComplete="off" className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" step="0.01" value={row.unitPrice} onChange={(e) => updateItemRow(i, { unitPrice: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-slate-700">{total > 0 ? formatBaht(total) : ""}</td>
                    <td className="px-2 py-1">
                      <input value={row.note} onChange={(e) => updateItemRow(i, { note: e.target.value })} className="input w-full" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(i)}
                        disabled={itemRows.length <= 1}
                        title="ลบแถวนี้"
                        aria-label="ลบแถวนี้"
                        className="text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={4} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                  รวมทั้งหมด
                </td>
                <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatBaht(itemsGrandTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <button
          type="button"
          onClick={addItemRow}
          disabled={itemRows.length >= MAX_ITEM_ROWS}
          className="btn-secondary btn-sm mt-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + เพิ่มรายการ
        </button>
        {itemRows.length > TEMPLATE_ITEM_ROWS && (
          <p className="mt-2 text-xs text-amber-700">
            เกิน {TEMPLATE_ITEM_ROWS} รายการ — PDF แบบเดิมพิมพ์ได้แค่ {TEMPLATE_ITEM_ROWS} รายการแรก ใช้ปุ่ม &quot;PDF แบบใหม่ (ทดลอง)&quot;
            เพื่อพิมพ์ครบทุกรายการ (ต่อหน้าถัดไปให้อัตโนมัติ)
          </p>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <a href="/approvals" className="btn-secondary">
          ยกเลิก
        </a>
        <button type="submit" disabled={submitting} className="btn-primary px-6">
          {submitting ? "กำลังบันทึก..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
