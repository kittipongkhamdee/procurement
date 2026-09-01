"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";

type Contract = Pick<Tables<"proc_contracts">, "id" | "contract_no" | "vendor_name" | "amount" | "inspector_name">;

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

export function DeliveryForm({
  action,
  contracts,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  contracts: Contract[];
  onSuccess?: () => void;
}) {
  const [contractId, setContractId] = useState("");
  const selected = useMemo(() => contracts.find((c) => c.id === contractId) ?? null, [contracts, contractId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await action(formData);
      await toastSuccess("บันทึกการส่งมอบงานเรียบร้อยแล้ว");
      form.reset();
      setContractId("");
      onSuccess?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label className="label">อ้างอิงเลขที่สัญญา</label>
        <select
          name="contract_id"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          required
          className="input w-full"
        >
          <option value="" disabled>
            เลือกเลขที่สัญญา..
          </option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contract_no} : {c.vendor_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">จำนวนเงินตามสัญญา</label>
        <input
          readOnly
          value={selected ? Number(selected.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : ""}
          className="input w-full bg-slate-50"
        />
      </div>
      <div>
        <label className="label">วันที่ส่งมอบ</label>
        <input type="date" name="delivery_date" required className="input w-full" />
      </div>
      <div>
        <label className="label">เดือนที่ส่งมอบ</label>
        <select name="delivery_month" required className="input w-full" defaultValue="">
          <option value="" disabled>
            เลือกเดือน..
          </option>
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">จำนวนเงินที่ส่งมอบ</label>
        <input
          type="number"
          step="0.01"
          name="amount"
          required
          defaultValue={selected ? Number(selected.amount) : undefined}
          key={contractId}
          className="input w-full text-right font-semibold text-emerald-700"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label">ผู้ตรวจรับ</label>
        <input
          name="inspector_name"
          defaultValue={selected?.inspector_name ?? ""}
          key={`insp-${contractId}`}
          className="input w-full"
        />
      </div>
      <div className="sm:col-span-3">
        <button type="submit" className="btn-primary">
          บันทึกการส่งมอบงาน
        </button>
      </div>
    </form>
  );
}
