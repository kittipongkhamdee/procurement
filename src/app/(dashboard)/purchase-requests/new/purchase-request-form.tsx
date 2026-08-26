"use client";

import { useMemo, useRef, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";

type Project = Pick<Tables<"plan_projects">, "id" | "name">;
type Activity = Pick<Tables<"plan_activities">, "id" | "name" | "project_id">;
type Vendor = Tables<"proc_vendors">;

const ROW_COUNT = 15;

type ItemRow = { name: string; qty: string; unit: string; unitPrice: string };

function emptyRows(): ItemRow[] {
  return Array.from({ length: ROW_COUNT }, () => ({ name: "", qty: "", unit: "", unitPrice: "" }));
}

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function PurchaseRequestForm({
  action,
  projects,
  activities,
  vendors,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: Project[];
  activities: Activity[];
  vendors: Vendor[];
}) {
  const [docType, setDocType] = useState<"ซื้อ" | "จ้าง">("ซื้อ");
  const [recordDate, setRecordDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [rows, setRows] = useState<ItemRow[]>(emptyRows());
  const formRef = useRef<HTMLFormElement>(null);

  const filteredActivities = useMemo(
    () => activities.filter((a) => a.project_id === projectId),
    [activities, projectId],
  );

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  const workDays = useMemo(() => {
    if (!recordDate || !deliveryDate) return null;
    const diff = Math.round(
      (new Date(deliveryDate).getTime() - new Date(recordDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff >= 0 ? diff + 1 : null;
  }, [recordDate, deliveryDate]);

  const grandTotal = rows.reduce((sum, r) => {
    const qty = parseFloat(r.qty) || 0;
    const price = parseFloat(r.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("items_json", JSON.stringify(rows));
    return action(formData);
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {/* ข้อมูลทั่วไป */}
      <section className="card">
        <h2 className="card-title">ประเภท / กำหนดการ</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">ประเภท</label>
            <select
              name="doc_type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as "ซื้อ" | "จ้าง")}
              className="input w-full"
              required
            >
              <option value="ซื้อ">ซื้อ</option>
              <option value="จ้าง">จ้าง</option>
            </select>
          </div>
          <div>
            <label className="label">เลขที่เอกสาร</label>
            <input name="doc_no" required className="input w-full" placeholder="เช่น 015/2569" />
          </div>
          <div>
            <label className="label">วันที่บันทึกฯ</label>
            <input
              type="date"
              name="record_date"
              required
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">ส่งมอบ/ตรวจรับ</label>
            <input
              type="date"
              name="delivery_date"
              required
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">
              วันทำงาน (คำนวณอัตโนมัติ)
            </label>
            <input
              readOnly
              value={workDays ?? ""}
              className="input w-full bg-slate-50 text-center font-semibold"
            />
          </div>
          <div>
            <label className="label">ผู้ตรวจรับ</label>
            <input name="inspector_name" className="input w-full" />
          </div>
          <div>
            <label className="label">ตำแหน่งผู้ตรวจรับ</label>
            <input name="inspector_position" className="input w-full" />
          </div>
          <div>
            <label className="label">กลุ่มบริหาร/กลุ่มสาระ</label>
            <input name="admin_group" className="input w-full" />
          </div>
        </div>
      </section>

      {/* โครงการ/กิจกรรม/จำนวนเงิน */}
      <section className="card">
        <h2 className="card-title">โครงการ / กิจกรรม / จำนวนเงิน</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">โครงการ</label>
            <select
              name="project_id"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="input w-full"
              required
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
          <div>
            <label className="label">กิจกรรม</label>
            <select
              name="activity_id"
              key={projectId}
              defaultValue=""
              className="input w-full"
              required
              disabled={!projectId}
            >
              <option value="" disabled>
                {projectId ? "เลือกกิจกรรม.." : "เลือกโครงการก่อน"}
              </option>
              {filteredActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">จำนวนเงิน (บาท)</label>
            <input
              type="number"
              step="0.01"
              name="amount"
              required
              className="input w-full text-right font-semibold text-emerald-700"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ชื่อรายการ</label>
            <input name="item_name" required className="input w-full" placeholder="ตัวอย่าง: วัสดุการศึกษาจำนวน 15 รายการ" />
          </div>
          <div>
            <label className="label">เหตุผล</label>
            <input name="reason" required className="input w-full" placeholder="ใช้ในการจัดการเรียนการสอน" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">
              รายละเอียด (เฉพาะงานจ้าง)
            </label>
            <textarea name="detail" rows={2} className="input w-full" />
          </div>
        </div>
      </section>

      {/* ข้อมูลร้านค้า */}
      <section className="card">
        <h2 className="card-title">ข้อมูลร้านค้า/ผู้รับจ้าง</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">ผู้ขาย/ผู้รับจ้าง</label>
            <select
              name="vendor_id"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="input w-full"
              required
            >
              <option value="" disabled>
                เลือกผู้ขาย/ผู้รับจ้าง..
              </option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              ไม่พบร้านค้าที่ต้องการ? เพิ่มข้อมูลได้ที่หน้า{" "}
              <a href="/vendors" className="text-navy-800 hover:underline">
                ข้อมูลผู้ขาย/ผู้รับจ้าง
              </a>
            </p>
          </div>
          <div>
            <label className="label">เจ้าหน้าที่พัสดุ</label>
            <input name="supply_officer_name" className="input w-full" />
          </div>
        </div>
        {selectedVendor && (
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
            <div>
              <dt className="text-slate-400">เลขผู้เสียภาษี</dt>
              <dd>{selectedVendor.tax_id ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">โทรศัพท์</dt>
              <dd>{selectedVendor.phone ?? "-"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-400">ที่อยู่</dt>
              <dd>
                {[
                  selectedVendor.house_no,
                  selectedVendor.moo && `หมู่ ${selectedVendor.moo}`,
                  selectedVendor.tambon,
                  selectedVendor.amphoe,
                  selectedVendor.province,
                  selectedVendor.zipcode,
                ]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* รายการวัสดุ */}
      <section className="card">
        <h2 className="card-title">รายการวัสดุ</h2>
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
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(i, { name: e.target.value })}
                        className="input w-full"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.qty}
                        onChange={(e) => updateRow(i, { qty: e.target.value })}
                        className="input w-full text-center"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={row.unit}
                        onChange={(e) => updateRow(i, { unit: e.target.value })}
                        className="input w-full text-center"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
                        className="input w-full text-center"
                      />
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-slate-700">
                      {total > 0 ? formatBaht(total) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                  รวมทั้งหมด
                </td>
                <td className="px-2 py-2 text-right font-bold text-emerald-700">
                  {formatBaht(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <a href="/purchase-requests" className="btn-secondary">
          ยกเลิก
        </a>
        <button type="submit" className="btn-primary px-6">
          บันทึกข้อมูล
        </button>
      </div>
    </form>
  );
}
