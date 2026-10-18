"use client";

// ตารางกรอก "รายการพัสดุ" (รายการ/จำนวน/หน่วยนับ/ราคาต่อหน่วย/จำนวนเงิน/หมายเหตุ) — หน้าตาและการช่วยกรอกแบบเดียวกับ
// รายการวัสดุ อุปกรณ์ในฟอร์มบันทึกขออนุมัติ: มือถือเป็นการ์ดต่อรายการ จอกว้างเป็นตาราง, ชื่อรายการ/หน่วยนับขึ้นช่วยกรอก
// (datalist) และเลือกชื่อเดิมแล้วเติมหน่วยนับ/ราคาครั้งล่าสุดให้ (เฉพาะช่องที่ว่าง)
// ใช้ที่สัญญาซื้อ (contracts/contract-list.tsx) — ฟอร์มบันทึกขออนุมัติยังมีโค้ดชุดเดิมของตัวเองอยู่

import type { ItemDefaults } from "@/lib/unit-suggestions";
import { suggestItemClass } from "@/lib/item-class";

/** itemClass: "" = ให้ระบบเสนอ (ราคาต่อหน่วย ≥ 10,000 = ครุภัณฑ์), "none" = ไม่เข้าคลัง (งานจ้าง/บริการ) */
export type ItemRow = { name: string; qty: string; unit: string; unitPrice: string; note: string; itemClass?: ItemClassValue };
export const EMPTY_ITEM_ROW: ItemRow = { name: "", qty: "", unit: "", unitPrice: "", note: "", itemClass: "" };

/** ประเภทที่ใช้จริงของแถว — ยังไม่เลือกเอง = ระบบเสนอ (งานจ้างเสนอ "ไม่เข้าคลัง") */
export function effectiveItemClass(row: ItemRow, hire = false): "material" | "equipment" | "none" {
  return resolveItemClass(row.itemClass, row.name, parseFloat(row.unitPrice) || null, hire);
}

export type ItemClassValue = "" | "material" | "equipment" | "none";

/** ประเภทที่ใช้จริง จากค่าที่เลือก (ว่าง = ระบบเสนอ) */
export function resolveItemClass(value: ItemClassValue | undefined, name: string, unitPrice: number | null, hire = false): "material" | "equipment" | "none" {
  if (value) return value;
  if (hire) return "none";
  return suggestItemClass(name, unitPrice);
}

/** ช่องเลือก วัสดุ/ครุภัณฑ์/ไม่เข้าคลัง — ยังไม่เลือกเอง แสดงค่าที่ระบบเสนอเป็นสีจาง */
export function ItemClassSelect({
  value,
  name,
  unitPrice,
  hire = false,
  onChange,
  className,
}: {
  value: ItemClassValue | undefined;
  name: string;
  unitPrice: number | null;
  hire?: boolean;
  onChange: (v: ItemClassValue) => void;
  className?: string;
}) {
  return (
    <select
      value={resolveItemClass(value, name, unitPrice, hire)}
      onChange={(e) => onChange(e.target.value as ItemClassValue)}
      title={value ? "เลือกเอง" : "ระบบเสนอให้ — ราคาต่อหน่วยตั้งแต่ 10,000 บาท = ครุภัณฑ์"}
      aria-label="ประเภทพัสดุ"
      className={`input ${value ? "" : "text-slate-500"} ${className ?? ""}`}
    >
      <option value="material">วัสดุ</option>
      <option value="equipment">ครุภัณฑ์</option>
      <option value="none">ไม่เข้าคลัง</option>
    </select>
  );
}

function ClassSelect({ row, hire, onChange, className }: { row: ItemRow; hire: boolean; onChange: (v: ItemRow["itemClass"]) => void; className?: string }) {
  return <ItemClassSelect value={row.itemClass} name={row.name} unitPrice={parseFloat(row.unitPrice) || null} hire={hire} onChange={onChange} className={className} />;
}
const MAX_ROWS = 100;

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function itemRowsTotal(rows: ItemRow[]) {
  return rows.reduce((s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.unitPrice) || 0), 0);
}

export { VAT_RATE, computeTotals, type VatType } from "@/lib/vat";
import { computeTotals, type VatType } from "@/lib/vat";

export type ItemTotalsControl = {
  discount: string;
  onDiscountChange: (v: string) => void;
  vatType: VatType;
  onVatTypeChange: (v: VatType) => void;
};

const VAT_LABELS: Record<VatType, string> = {
  none: "ไม่มีภาษีมูลค่าเพิ่ม",
  exclude: "ราคายังไม่รวมภาษี (บวก 7%)",
  include: "ราคารวมภาษีแล้ว (7%)",
};

export function ItemRowsEditor({
  rows,
  onChange,
  idPrefix,
  nameSuggestions = [],
  unitSuggestions = [],
  itemDefaults = {},
  totals,
  showClass = false,
  hire = false,
}: {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  /** ใช้ตั้ง id ของ datalist ไม่ให้ซ้ำกันเมื่อมีหลายฟอร์มในหน้าเดียว */
  idPrefix: string;
  nameSuggestions?: string[];
  unitSuggestions?: string[];
  itemDefaults?: Record<string, ItemDefaults>;
  /** แถวส่วนลดและภาษีมูลค่าเพิ่มท้ายตาราง (ไม่ส่งมา = แสดงแค่ยอดรวม) */
  totals?: ItemTotalsControl;
  /** แสดงช่องเลือก วัสดุ/ครุภัณฑ์/ไม่เข้าคลัง (รายการจัดซื้อ → บัญชีวัสดุ / ทะเบียนคุมทรัพย์สิน) */
  showClass?: boolean;
  /** งานจ้าง — ค่าเริ่มต้นเป็น "ไม่เข้าคลัง" */
  hire?: boolean;
}) {
  const nameListId = `${idPrefix}-item-names`;
  const unitListId = `${idPrefix}-item-units`;
  const total = itemRowsTotal(rows);
  const t = totals ? computeTotals(total, parseFloat(totals.discount) || 0, totals.vatType) : null;
  const vatSelect = totals && (
    <select value={totals.vatType} onChange={(e) => totals.onVatTypeChange(e.target.value as VatType)} className="input py-1 text-sm">
      {(Object.keys(VAT_LABELS) as VatType[]).map((k) => (
        <option key={k} value={k}>
          {VAT_LABELS[k]}
        </option>
      ))}
    </select>
  );
  const discountInput = totals && (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={totals.discount}
      onChange={(e) => totals.onDiscountChange(e.target.value)}
      placeholder="0.00"
      aria-label="ส่วนลด (บาท)"
      className="input w-32 py-1 text-right"
    />
  );

  function update(index: number, patch: Partial<ItemRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function withDefaults(row: ItemRow): ItemRow {
    const def = itemDefaults[row.name.trim()];
    if (!def) return row;
    return {
      ...row,
      unit: row.unit || def.unit || "",
      unitPrice: row.unitPrice || (def.unitPrice != null ? String(def.unitPrice) : ""),
    };
  }

  function changeName(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const fromSuggestion = (e.nativeEvent as InputEvent).inputType === "insertReplacementText";
    const next = { ...rows[index], name: e.target.value };
    onChange(rows.map((r, i) => (i === index ? (fromSuggestion ? withDefaults(next) : next) : r)));
  }

  function blurName(index: number) {
    const next = withDefaults(rows[index]);
    if (next !== rows[index]) onChange(rows.map((r, i) => (i === index ? next : r)));
  }

  function addRow() {
    if (rows.length < MAX_ROWS) onChange([...rows, { ...EMPTY_ITEM_ROW }]);
  }

  function remove(index: number) {
    if (rows.length > 1) onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <datalist id={nameListId}>
        {nameSuggestions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id={unitListId}>
        {unitSuggestions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {/* จอแคบ/แท็บเล็ต (ฟอร์มอยู่ใน popup พื้นที่แคบกว่าหน้าจอ): การ์ดต่อรายการ */}
      <div className="space-y-3 lg:hidden">
        {rows.map((row, i) => {
          const rowTotal = (parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice) || 0);
          return (
            <div key={i} className="rounded-md border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">รายการที่ {i + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={rows.length <= 1}
                  aria-label={`ลบรายการที่ ${i + 1}`}
                  className="rounded px-2 py-1 text-sm text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ✕ ลบ
                </button>
              </div>
              <label className="label">รายการ</label>
              <input value={row.name} onChange={(e) => changeName(i, e)} onBlur={() => blurName(i)} list={nameListId} autoComplete="off" placeholder="ชื่อพัสดุ" className="input w-full" />
              {showClass && (
                <>
                  <label className="label mt-3">ประเภท (ระบบเสนอให้ เปลี่ยนได้)</label>
                  <ClassSelect row={row} hire={hire} onChange={(v) => update(i, { itemClass: v })} className="w-full" />
                </>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <label className="label">จำนวน</label>
                  <input type="number" inputMode="decimal" step="0.01" value={row.qty} onChange={(e) => update(i, { qty: e.target.value })} className="input w-full text-center" />
                </div>
                <div>
                  <label className="label">หน่วยนับ</label>
                  <input value={row.unit} onChange={(e) => update(i, { unit: e.target.value })} list={unitListId} placeholder="เช่น ชิ้น" autoComplete="off" className="input w-full text-center" />
                </div>
                <div>
                  <label className="label">ราคา/หน่วย</label>
                  <input type="number" inputMode="decimal" step="0.01" value={row.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className="input w-full text-center" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-500">จำนวนเงิน (บาท)</span>
                <span className="font-semibold text-slate-700">{rowTotal > 0 ? formatBaht(rowTotal) : "-"}</span>
              </div>
              <label className="label mt-3">หมายเหตุ</label>
              <input value={row.note} onChange={(e) => update(i, { note: e.target.value })} className="input w-full" />
            </div>
          );
        })}
        <button type="button" onClick={addRow} disabled={rows.length >= MAX_ROWS} className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-navy-800/40 bg-navy-800/5 px-4 py-3 text-base font-semibold text-navy-800 transition hover:border-navy-800 hover:bg-navy-800/10 disabled:cursor-not-allowed disabled:opacity-50">
          + เพิ่มรายการ
        </button>
        <div className="space-y-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-600">{t ? "รวมเป็นเงิน" : "รวมทั้งหมด"} (บาท)</span>
            <span className={t ? "font-semibold text-slate-700" : "font-bold text-emerald-700"}>{formatBaht(total)}</span>
          </div>
          {t && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">หักส่วนลด (บาท)</span>
                {discountInput}
              </div>
              {vatSelect}
              {totals!.vatType !== "none" && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{totals!.vatType === "include" ? "ภาษีมูลค่าเพิ่ม 7% (รวมอยู่ในราคา)" : "ภาษีมูลค่าเพิ่ม 7%"}</span>
                  <span className="text-slate-700">{formatBaht(t.vat)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-600">รวมทั้งสิ้น (บาท)</span>
                <span className="font-bold text-emerald-700">{formatBaht(t.net)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* จอกว้าง: ตาราง */}
      <div className="hidden overflow-x-auto rounded-md border border-slate-200 lg:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-2 py-2">ที่</th>
              <th className="min-w-48 px-2 py-2 text-left">รายการ</th>
              <th className="w-20 px-2 py-2">จำนวน</th>
              <th className="w-24 px-2 py-2">หน่วยนับ</th>
              <th className="w-28 px-2 py-2">ราคา/หน่วย</th>
              <th className="w-28 px-2 py-2">จำนวนเงิน</th>
              {showClass && <th className="w-28 px-2 py-2">ประเภท</th>}
              <th className="w-32 px-2 py-2">หมายเหตุ</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const rowTotal = (parseFloat(row.qty) || 0) * (parseFloat(row.unitPrice) || 0);
              return (
                <tr key={i}>
                  <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1">
                    <input value={row.name} onChange={(e) => changeName(i, e)} onBlur={() => blurName(i)} list={nameListId} autoComplete="off" className="input w-full" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.01" value={row.qty} onChange={(e) => update(i, { qty: e.target.value })} className="input w-full text-center" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={row.unit} onChange={(e) => update(i, { unit: e.target.value })} list={unitListId} placeholder="เช่น ชิ้น" autoComplete="off" className="input w-full text-center" />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" step="0.01" value={row.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} className="input w-full text-center" />
                  </td>
                  <td className="px-2 py-1 text-right font-medium text-slate-700">{rowTotal > 0 ? formatBaht(rowTotal) : ""}</td>
                  {showClass && (
                    <td className="px-2 py-1">
                      <ClassSelect row={row} hire={hire} onChange={(v) => update(i, { itemClass: v })} className="w-full px-1" />
                    </td>
                  )}
                  <td className="px-2 py-1">
                    <input value={row.note} onChange={(e) => update(i, { note: e.target.value })} className="input w-full" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={rows.length <= 1}
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
              <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                {t ? "รวมเป็นเงิน" : "รวมทั้งหมด"}
              </td>
              <td className={`px-2 py-2 text-right ${t ? "font-semibold text-slate-700" : "font-bold text-emerald-700"}`}>{formatBaht(total)}</td>
              <td colSpan={showClass ? 3 : 2} />
            </tr>
            {t && (
              <>
                <tr>
                  <td colSpan={5} className="px-2 py-1 text-right text-xs font-semibold text-slate-600">
                    หักส่วนลด
                  </td>
                  <td className="px-2 py-1 text-right">{discountInput}</td>
                  <td colSpan={showClass ? 3 : 2} />
                </tr>
                <tr>
                  <td colSpan={5} className="px-2 py-1 text-right text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-end gap-2">
                      {vatSelect}
                      <span>{totals!.vatType === "include" ? "ภาษีมูลค่าเพิ่ม 7% (รวมอยู่ในราคา)" : "ภาษีมูลค่าเพิ่ม 7%"}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right text-slate-700">{totals!.vatType === "none" ? "-" : formatBaht(t.vat)}</td>
                  <td colSpan={showClass ? 3 : 2} />
                </tr>
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                    รวมทั้งสิ้น
                  </td>
                  <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatBaht(t.net)}</td>
                  <td colSpan={showClass ? 3 : 2} />
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>
      {/* จอกว้าง: ปุ่มเพิ่มรายการใต้ตาราง (จอแคบ/แท็บเล็ตอยู่ท้ายการ์ดรายการสุดท้าย) */}
      <button type="button" onClick={addRow} disabled={rows.length >= MAX_ROWS} className="mt-3 hidden w-full lg:flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-navy-800/40 bg-navy-800/5 px-4 py-3 text-base font-semibold text-navy-800 transition hover:border-navy-800 hover:bg-navy-800/10 disabled:cursor-not-allowed disabled:opacity-50">
        + เพิ่มรายการ
      </button>
    </div>
  );
}
