"use client";

import { useMemo, useState } from "react";

type ProjectOption = { id: string; name: string; budget: number; paid: number };
const ROW_COUNT = 15;
type ItemRow = { name: string; qty: string; unit: string; unitPrice: string };

function emptyRows(): ItemRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({ name: "", qty: "", unit: "", unitPrice: "" }));
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
  const [buy, setBuy] = useState("");
  const [hire, setHire] = useState("");
  const [travel, setTravel] = useState("");
  const [rows, setRows] = useState<ItemRow[]>(emptyRows());

  const selected = useMemo(() => projects.find((p) => p.id === projectId) ?? null, [projects, projectId]);

  const requestedAmount = (parseFloat(buy) || 0) + (parseFloat(hire) || 0) + (parseFloat(travel) || 0);
  const remaining = selected ? selected.budget - selected.paid - requestedAmount : 0;
  const grandTotal = rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0), 0);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("items_json", JSON.stringify(rows));
    formData.set("budget", selected ? String(selected.budget) : "");
    formData.set("paid", selected ? String(selected.paid) : "");
    formData.set("requested_amount", String(requestedAmount));
    formData.set("remaining", String(remaining));
    formData.set(
      "detail_text",
      `1. จัดซื้อ ${formatBaht(parseFloat(buy) || 0)} บาท\n2. จัดจ้าง ${formatBaht(
        parseFloat(hire) || 0,
      )} บาท\n3. เบี้ยเลี้ยง/เดินทาง ${formatBaht(parseFloat(travel) || 0)} บาท\nรวมทั้งสิ้น ${formatBaht(
        requestedAmount,
      )} บาท`,
    );
    return action(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <section className="card">
        <h2 className="card-title">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="date" name="doc_date" required className="input" />
          <input
            name="subject"
            defaultValue="ขออนุมัติใช้งบประมาณปฏิบัติงานตามโครงการ"
            required
            className="input sm:col-span-2"
          />
          <input
            name="addressed_to"
            defaultValue="ผู้อำนวยการโรงเรียนตาเบาวิทยา"
            required
            className="input sm:col-span-3"
          />

          <select
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="input sm:col-span-3 border-navy-600 bg-navy-950/[0.03]"
          >
            <option value="" disabled>
              -- เลือกโครงการที่ต้องการเบิก --
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input name="fund_type" placeholder="ประเภทเงิน" className="input" />
          <input readOnly value={selected ? formatBaht(selected.budget) : ""} placeholder="งบประมาณทั้งหมด" className="input bg-slate-50 text-right" />
          <input readOnly value={selected ? formatBaht(selected.paid) : ""} placeholder="เบิกจ่ายไปแล้ว" className="input bg-slate-50 text-right" />

          <div className="sm:col-span-3">
            <label className="label">
              รายละเอียดการขออนุมัติ (ระบุจำนวนเงิน)
            </label>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-slate-600">1. จัดซื้อ</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={buy}
                        onChange={(e) => setBuy(e.target.value)}
                        className="input w-full text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">2. จัดจ้าง</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={hire}
                        onChange={(e) => setHire(e.target.value)}
                        className="input w-full text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-600">3. ค่าเบี้ยเลี้ยง/เดินทางไปราชการ</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={travel}
                        onChange={(e) => setTravel(e.target.value)}
                        className="input w-full text-right"
                      />
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2">รวมทั้งสิ้น (ขออนุมัติครั้งนี้)</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatBaht(requestedAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <input readOnly value={formatBaht(remaining)} placeholder="คงเหลือสุทธิ" className="input sm:col-span-3 bg-slate-50 text-right font-bold text-emerald-700" />

          <input name="requested_by_name" placeholder="ผู้ขออนุมัติ" required className="input" />
          <input name="requested_by_position" placeholder="ตำแหน่ง" className="input" />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">รายการสินค้า</h2>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-10 px-2 py-2">ลำดับ</th>
                <th className="px-2 py-2 text-left">ชื่อรายการ</th>
                <th className="w-24 px-2 py-2">จำนวน</th>
                <th className="w-24 px-2 py-2">หน่วยนับ</th>
                <th className="w-28 px-2 py-2">ราคา/หน่วย</th>
                <th className="w-28 px-2 py-2">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                const total = (parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice) || 0);
                return (
                  <tr key={i}>
                    <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                    <td className="px-2 py-1">
                      <input value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} className="input w-full" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" step="0.01" value={row.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={row.unit} onChange={(e) => updateRow(i, { unit: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1">
                      <input type="number" step="0.01" value={row.unitPrice} onChange={(e) => updateRow(i, { unitPrice: e.target.value })} className="input w-full text-center" />
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-slate-700">{total > 0 ? formatBaht(total) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                  รวมทั้งหมด
                </td>
                <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatBaht(grandTotal)}</td>
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
