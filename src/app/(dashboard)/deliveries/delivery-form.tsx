"use client";

import { useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";

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
}: {
  action: (formData: FormData) => void | Promise<void>;
  contracts: Contract[];
}) {
  const [contractId, setContractId] = useState("");
  const selected = useMemo(() => contracts.find((c) => c.id === contractId) ?? null, [contracts, contractId]);

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-slate-600">อ้างอิงเลขที่สัญญา</label>
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
        <label className="mb-1 block text-xs font-medium text-slate-600">จำนวนเงินตามสัญญา</label>
        <input
          readOnly
          value={selected ? Number(selected.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : ""}
          className="input w-full bg-slate-50"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">วันที่ส่งมอบ</label>
        <input type="date" name="delivery_date" required className="input w-full" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">เดือนที่ส่งมอบ</label>
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
        <label className="mb-1 block text-xs font-medium text-slate-600">จำนวนเงินที่ส่งมอบ</label>
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
        <label className="mb-1 block text-xs font-medium text-slate-600">ผู้ตรวจรับ</label>
        <input
          name="inspector_name"
          defaultValue={selected?.inspector_name ?? ""}
          key={`insp-${contractId}`}
          className="input w-full"
        />
      </div>
      <div className="sm:col-span-3">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          บันทึกการส่งมอบงาน
        </button>
      </div>
    </form>
  );
}
