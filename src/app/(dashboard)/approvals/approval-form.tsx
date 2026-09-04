"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatThaiDate } from "@/lib/thai";
import { confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";

type ProjectOption = { id: string; name: string; budget: number; approvedSoFar: number };
type ActivityOption = { id: string; project_id: string; name: string | null };
type AdminGroupOption = { id: string; name: string };
type TeacherOption = { id: string; name: string; is_active: boolean };
const ITEM_ROW_COUNT = 15;
type ItemRow = { name: string; qty: string; unitPrice: string; note: string };

const SUMMARY_LABELS = ["จัดซื้อจัดจ้าง", "ค่าเบี้ยเลี้ยง/ค่าตอบแทน", "ค่าเดินทางไปราชการ", "ค่าสาธารณูปโภค", "อื่นๆ (ระบุ)"];

type SummaryRow = { label: string; amount: string; note: string };

function emptySummaryRows(): SummaryRow[] {
  return SUMMARY_LABELS.map((label) => ({ label, amount: "", note: "" }));
}

function emptyItemRows(): ItemRow[] {
  return Array.from({ length: ITEM_ROW_COUNT }, () => ({ name: "", qty: "", unitPrice: "", note: "" }));
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
  items: { name: string | null; qty: number | null; unit_price: number | null; note: string | null }[];
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
  const rows = initial.items.map((item) => ({
    name: item.name ?? "",
    qty: item.qty != null ? String(item.qty) : "",
    unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    note: item.note ?? "",
  }));
  while (rows.length < ITEM_ROW_COUNT) rows.push({ name: "", qty: "", unitPrice: "", note: "" });
  return rows;
}

export function ApprovalForm({
  action,
  projects,
  activities,
  adminGroups,
  teachers,
  initial,
  submitLabel = "บันทึกและสร้างเอกสาร",
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: ProjectOption[];
  activities: ActivityOption[];
  adminGroups: AdminGroupOption[];
  teachers: TeacherOption[];
  initial?: ApprovalFormInitial;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>(initialSummaryRows(initial));
  const [itemRows, setItemRows] = useState<ItemRow[]>(initialItemRows(initial));
  const [activityName, setActivityName] = useState(initial?.activity_name ?? "");
  const [planDateISO, setPlanDateISO] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const requestedAmount = summaryRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = selected ? selected.budget - selected.approvedSoFar - requestedAmount : 0;
  const itemsGrandTotal = itemRows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0), 0);

  function updateSummaryRow(index: number, patch: Partial<SummaryRow>) {
    setSummaryRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>) {
    setItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
              <label className="label">เลขที่หนังสือ</label>
              <input readOnly value={initial.doc_number ?? ""} className="input w-full bg-slate-50" />
            </div>
          ) : (
            <div>
              <label className="label">เลขที่หนังสือ</label>
              <input readOnly value="รันอัตโนมัติเมื่อบันทึก" className="input w-full bg-slate-50 text-slate-400" />
            </div>
          )}
          <div>
            <label className="label">วันที่บันทึกข้อความ</label>
            <input type="date" name="doc_date" defaultValue={initial?.doc_date ?? ""} required className="input w-full" />
          </div>
          <div />
          <input
            name="subject"
            defaultValue={initial?.subject ?? "ขออนุญาตดำเนินการและอนุมัติใช้เงินโครงการ"}
            required
            className="input sm:col-span-3"
          />
          <input
            name="addressed_to"
            defaultValue={initial?.addressed_to ?? "ผู้อำนวยการโรงเรียนตาเบาวิทยา"}
            required
            className="input sm:col-span-3"
          />

          <select name="department" defaultValue={initial?.department ?? ""} className="input">
            <option value="">-- ฝ่าย/กลุ่ม/สาระฯ/งาน --</option>
            {adminGroups.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="input sm:col-span-3 border-navy-600 bg-navy-950/[0.03]"
          >
            <option value="" disabled>
              -- เลือกโครงการ/งานที่ต้องการเบิก --
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            disabled={!projectId}
            className="input sm:col-span-3"
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

          <div className="sm:col-span-3">
            <label className="label">จะดำเนินการวันที่</label>
            <input
              type="date"
              value={planDateISO}
              onChange={(e) => setPlanDateISO(e.target.value)}
              className="input w-full"
            />
            {(planDateISO || initial?.plan_date_text) && (
              <p className="mt-1 text-xs text-slate-500">
                {planDateISO
                  ? `จะบันทึกเป็น: ${formatThaiDate(planDateISO)}`
                  : `ปัจจุบัน: ${initial?.plan_date_text} (เลือกวันที่ใหม่เพื่อเปลี่ยน)`}
              </p>
            )}
          </div>

          <select
            name="requested_by_name"
            defaultValue={initial?.requested_by_name ?? ""}
            required
            className="input sm:col-span-3"
          >
            <option value="" disabled>
              -- ผู้รับผิดชอบโครงการ --
            </option>
            {visibleTeachers.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
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
          <input
            readOnly
            value={selected ? formatBaht(selected.budget) : ""}
            placeholder="เงินโครงการทั้งสิ้น"
            className="input bg-slate-50 text-right"
          />
          <input
            readOnly
            value={formatBaht(remaining)}
            placeholder="เงินโครงการเหลือ"
            className="input bg-slate-50 text-right font-bold text-emerald-700"
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">รายการวัสดุ อุปกรณ์ (หน้า 2 ของเอกสาร)</h2>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">รายการ</th>
                <th className="w-24 px-2 py-2">จำนวน (หน่วย)</th>
                <th className="w-28 px-2 py-2">ราคา/หน่วย</th>
                <th className="w-28 px-2 py-2">จำนวนเงิน</th>
                <th className="w-32 px-2 py-2">หมายเหตุ</th>
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
                      <input type="number" step="0.01" value={row.unitPrice} onChange={(e) => updateItemRow(i, { unitPrice: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-slate-700">{total > 0 ? formatBaht(total) : ""}</td>
                    <td className="px-2 py-1">
                      <input value={row.note} onChange={(e) => updateItemRow(i, { note: e.target.value })} className="input w-full" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={3} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                  รวมทั้งหมด
                </td>
                <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatBaht(itemsGrandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
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
