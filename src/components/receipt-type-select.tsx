import { RECEIPT_TYPES } from "@/lib/w119";

/** เลือกประเภทหลักฐานการรับเงิน (ใบเสร็จ/บิลเงินสด/ใบกำกับภาษี/ใบสำคัญรับเงิน/ใบรับรองแทนใบเสร็จ) — ส่งค่าในชื่อ receipt_type */
export function ReceiptTypeSelect({ defaultValue }: { defaultValue?: string | null }) {
  const current = defaultValue?.trim() || "ใบเสร็จรับเงิน";
  return (
    <select name="receipt_type" defaultValue={current} className="input w-full">
      {!(RECEIPT_TYPES as readonly string[]).includes(current) && <option value={current}>{current}</option>}
      {RECEIPT_TYPES.map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  );
}
