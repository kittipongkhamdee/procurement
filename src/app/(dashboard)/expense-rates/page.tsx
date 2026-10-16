"use client";

// อัตราค่าใช้จ่ายตามระเบียบ — ใช้ล็อกอัตราสูงสุดในเมนู "เบิกค่าใช้จ่ายโครงการ (ตาราง 2)"
// ครูทุกคนดูได้ เจ้าหน้าที่พัสดุ/แอดมินเพิ่ม แก้ไข ลบได้

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { CLAIM_KINDS, type ClaimKind, type ExpenseRate } from "@/lib/expense-claims";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { createExpenseRate, deleteExpenseRate, updateExpenseRate } from "./actions";

const KIND_KEYS = Object.keys(CLAIM_KINDS) as ClaimKind[];

function RateModal({ rate, onSaved }: { rate: ExpenseRate | null; onSaved: () => void }) {
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    try {
      const res = rate ? await updateExpenseRate(rate.id, new FormData(form)) : await createExpenseRate(new FormData(form));
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!rate) form.reset();
      await toastSuccess("บันทึกเรียบร้อยแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      ref={modalRef}
      title={rate ? "แก้ไขอัตรา" : "เพิ่มอัตรา"}
      lazy
      trigger={
        rate ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="btn-label">แก้ไข</span>
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            เพิ่มอัตรา
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">
            ประเภทรายการ <span className="text-red-600">*</span>
          </label>
          <select name="kind" defaultValue={rate?.kind ?? "snack"} className="input w-full">
            {KIND_KEYS.map((k) => (
              <option key={k} value={k}>
                {CLAIM_KINDS[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            อัตราสูงสุด (บาท) <span className="text-red-600">*</span>
          </label>
          <input name="max_rate" type="number" min="0" step="0.01" defaultValue={rate?.max_rate ?? ""} required className="input w-full text-right" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            ชื่ออัตรา <span className="text-red-600">*</span>
          </label>
          <input name="name" defaultValue={rate?.name ?? ""} required placeholder="เช่น ค่าอาหาร (สถานที่ราชการ)" className="input w-full" />
        </div>
        <div>
          <label className="label">หน่วย</label>
          <input name="unit_note" defaultValue={rate?.unit_note ?? ""} placeholder="เช่น บาท/มื้อ/คน" className="input w-full" />
        </div>
        <div>
          <label className="label">ลำดับการแสดง</label>
          <input name="sort_order" type="number" defaultValue={rate?.sort_order ?? 0} className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">เงื่อนไข/หมายเหตุ</label>
          <input name="note" defaultValue={rate?.note ?? ""} className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">อ้างอิงระเบียบ/หนังสือ</label>
          <input name="source" defaultValue={rate?.source ?? ""} className="input w-full" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="is_active" type="checkbox" defaultChecked={rate?.is_active ?? true} />
          ใช้งาน (ให้เลือกในฟอร์มเบิกค่าใช้จ่าย)
        </label>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ExpenseRatesPage() {
  const { isProcStaff } = useAuth();
  const [rates, setRates] = useState<ExpenseRate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await createClient()
      .from("proc_expense_rates")
      .select("id, kind, name, max_rate, unit_note, note, source, sort_order, is_active")
      .order("sort_order")
      .order("name");
    setError(error?.message ?? null);
    setRates((data ?? []).map((r) => ({ ...r, max_rate: Number(r.max_rate) })));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleDelete(r: ExpenseRate) {
    if (!(await confirmDelete({ title: "ลบอัตรานี้?", text: r.name }))) return;
    const res = await deleteExpenseRate(r.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  const fmt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">อัตราค่าใช้จ่ายตามระเบียบ</h1>
          <p className="page-subtitle">อัตราสูงสุดที่เบิกได้ ใช้ล็อกอัตราในเมนู &quot;เบิกค่าใช้จ่ายโครงการ (ตาราง 2)&quot;</p>
        </div>
        {isProcStaff && <RateModal rate={null} onSaved={reload} />}
      </div>
      {rates === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell @container">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <div className="divide-y divide-slate-100 @min-[48rem]:hidden">
            {rates.map((r) => (
              <div key={r.id} className={`px-4 py-3 ${r.is_active ? "" : "opacity-50"}`}>
                <p className="text-xs text-slate-500">{CLAIM_KINDS[r.kind as ClaimKind]?.label ?? r.kind}</p>
                <p className="font-medium text-slate-900">{r.name}</p>
                <p className="text-sm text-slate-700">
                  ไม่เกิน <span className="font-semibold">{fmt(r.max_rate)}</span> {r.unit_note ?? "บาท"}
                </p>
                {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                {isProcStaff && (
                  <div className="mt-2 flex gap-2">
                    <RateModal rate={r} onSaved={reload} />
                    <button type="button" onClick={() => handleDelete(r)} className="btn-danger btn-sm">
                      <TrashIcon className="h-3.5 w-3.5" />
                      <span className="btn-label">ลบ</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {rates.length === 0 && <p className="table-empty">ยังไม่มีข้อมูล</p>}
          </div>
          <table className="hidden table-base w-full @min-[48rem]:table">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>รายการ</th>
                <th className="text-right">อัตราสูงสุด</th>
                <th>หน่วย</th>
                <th>เงื่อนไข / อ้างอิง</th>
                {isProcStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className={r.is_active ? "" : "opacity-50"}>
                  <td>{CLAIM_KINDS[r.kind as ClaimKind]?.label ?? r.kind}</td>
                  <td className="font-medium text-slate-900">
                    {r.name}
                    {!r.is_active && <span className="ml-2 text-sm text-slate-500">(ไม่ใช้งาน)</span>}
                  </td>
                  <td className="text-right font-semibold">{fmt(r.max_rate)}</td>
                  <td>{r.unit_note ?? "บาท"}</td>
                  <td>
                    <div>{r.note ?? ""}</div>
                    {r.source && <div className="text-sm text-slate-500">{r.source}</div>}
                  </td>
                  {isProcStaff && (
                    <td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <RateModal rate={r} onSaved={reload} />
                        <button type="button" onClick={() => handleDelete(r)} title="ลบ" className="btn-danger btn-sm">
                          <TrashIcon className="h-3.5 w-3.5" />
                          <span className="btn-label">ลบ</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
