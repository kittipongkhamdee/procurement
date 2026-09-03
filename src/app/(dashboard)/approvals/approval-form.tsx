"use client";

import { useMemo, useState } from "react";

type ProjectOption = { id: string; name: string; budget: number; approvedSoFar: number };
const ITEM_ROW_COUNT = 15;
type ItemRow = { name: string; qty: string; unitPrice: string; note: string };

const SUMMARY_LABELS = ["จัดซื้อจัดจ้าง", "ค่าเบี้ยเลี้ยง/ค่าตอบแทน", "ค่าเดินทางไปราชการ", "ค่าสาธารณูปโภค", "อื่นๆ (ระบุ)"];
const FUND_TYPE_OPTIONS = ["งบค่าจัดการเรียนการสอน", "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน", "เงินรายได้สถานศึกษา"];

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

export function ApprovalForm({
  action,
  projects,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: ProjectOption[];
}) {
  const [projectId, setProjectId] = useState("");
  const [fundType, setFundType] = useState("");
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>(emptySummaryRows());
  const [itemRows, setItemRows] = useState<ItemRow[]>(emptyItemRows());

  const selected = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  const requestedAmount = summaryRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const remaining = selected ? selected.budget - selected.approvedSoFar - requestedAmount : 0;
  const itemsGrandTotal = itemRows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0), 0);

  function updateSummaryRow(index: number, patch: Partial<SummaryRow>) {
    setSummaryRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateItemRow(index: number, patch: Partial<ItemRow>) {
    setItemRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("summary_items_json", JSON.stringify(summaryRows));
    formData.set("items_json", JSON.stringify(itemRows));
    formData.set("budget", selected ? String(selected.budget) : "");
    formData.set("requested_amount", String(requestedAmount));
    formData.set("remaining", String(remaining));
    formData.set("fund_type", fundType);
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <section className="card">
        <h2 className="card-title">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="doc_number" placeholder="เลขที่หนังสือ (ที่ งป/...)" className="input" />
          <input type="date" name="doc_date" required className="input" />
          <div />
          <input
            name="subject"
            defaultValue="ขออนุญาตดำเนินการและอนุมัติใช้เงินโครงการ"
            required
            className="input sm:col-span-3"
          />
          <input
            name="addressed_to"
            defaultValue="ผู้อำนวยการโรงเรียนตาเบาวิทยา"
            required
            className="input sm:col-span-3"
          />

          <input name="department" placeholder="ฝ่าย/กลุ่ม/สาระฯ/งาน" className="input" />
          <input name="activity_name" placeholder="ชื่อกิจกรรม" className="input sm:col-span-2" />

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

          <input name="plan_date_text" placeholder="จะดำเนินการวันที่" className="input sm:col-span-3" />

          <input name="group_name" placeholder="กลุ่มงาน (สำหรับหน้ารายการวัสดุอุปกรณ์)" className="input" />
          <input
            name="budget_year_text"
            placeholder="ปีการศึกษา (สำหรับหน้ารายการวัสดุอุปกรณ์)"
            className="input"
          />

          <input name="requested_by_name" placeholder="ผู้รับผิดชอบโครงการ" required className="input" />
          <input name="requested_by_position" placeholder="ตำแหน่ง" className="input" />
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

        <div className="mt-4">
          <label className="label">ความเห็นเจ้าหน้าที่การเงิน — งบประมาณที่ใช้</label>
          <div className="flex flex-wrap gap-4">
            {FUND_TYPE_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="fund_type_choice"
                  checked={fundType === opt}
                  onChange={() => setFundType(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
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
        <button type="submit" className="btn-primary px-6">
          บันทึกและสร้างเอกสาร
        </button>
      </div>
    </form>
  );
}
