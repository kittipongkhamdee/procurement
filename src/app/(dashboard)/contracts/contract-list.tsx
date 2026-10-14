"use client";

// รายการสัญญาของประเภทหนึ่ง (จ้าง/ซื้อ/เช่า) — ใช้ซ้ำในหน้าย่อยของ "งานสัญญา" (/contracts/<ประเภท>)
// ดึงรายการสัญญาผ่าน browser Supabase client; เพิ่ม/แก้ไขผ่าน popup ฟอร์มเดียวกัน (ContractModal)
// การ์ดสำหรับพื้นที่แคบ / ตารางสำหรับพื้นที่กว้าง (@container แพทเทิร์นเดียวกับทะเบียนคุมทรัพย์สิน)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ThaiAddressInput } from "@/components/thai-address-input";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { uploadFileDirect } from "@/lib/storage/client-upload";
import { driveFileId, driveViewUrl, isDriveRef } from "@/lib/storage/ref";
import { ChevronLeftIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { clearContractFile, createContract, deleteContract, setContractFile, updateContract } from "./actions";
import { EMPTY_ITEM_ROW, ItemRowsEditor, computeTotals, itemRowsTotal, type ItemRow, type VatType } from "@/components/item-rows-editor";
import { loadItemSuggestions, loadUnitSuggestions, type ItemDefaults } from "@/lib/unit-suggestions";

/** คำแนะนำชื่อรายการ/หน่วยนับ สำหรับตารางรายการพัสดุของสัญญาซื้อ */
type ItemSuggestions = { names: string[]; units: string[]; defaults: Record<string, ItemDefaults> };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Contract = {
  id: string;
  contract_no: string;
  contract_date: string;
  start_date: string | null;
  end_date: string | null;
  project_id: string | null;
  budget_source_id: string | null;
  contract_file_path: string | null;
  vendor_name: string;
  id_card: string | null;
  house_no: string | null;
  moo: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  zipcode: string | null;
  phone: string | null;
  detail: string | null;
  budget: number | null;
  amount: number;
  guarantee_type: string | null;
  guarantee_amount: number | null;
  penalty_rate: number | null;
  discount: number | null;
  vat_type: string | null;
  rental_area: string | null;
  rent_monthly: number | null;
  rent_unit: string | null;
  rent_periods: number | null;
  inspector_name: string | null;
  note: string | null;
  plan_projects: { name: string } | null;
  plan_budget_sources: { name: string } | null;
};
type BudgetSource = { id: string; name: string };
type Project = { id: string; name: string; budget_source_id?: string | null };

const GUARANTEE_TYPES = ["เงินสด", "เช็คธนาคาร", "หนังสือค้ำประกันของธนาคาร", "พันธบัตรรัฐบาล", "ไม่มีหลักประกัน"];

export type ContractType = "จ้าง" | "ซื้อ" | "เช่า";

/** คำเรียกในฟอร์ม/ตารางที่ต่างกันตามประเภทสัญญา */
const TERMS: Record<ContractType, { party: string; detail: string; start: string; end: string; penalty: string }> = {
  จ้าง: {
    party: "ผู้รับจ้าง",
    detail: "รายละเอียดงานจ้าง",
    start: "วันเริ่มงาน",
    end: "วันสิ้นสุดสัญญา (ส่งมอบงาน)",
    penalty: "ค่าปรับต่อวัน (ร้อยละของค่าจ้าง)",
  },
  ซื้อ: {
    party: "ผู้ขาย",
    detail: "รายการพัสดุที่ซื้อ",
    start: "วันเริ่มสัญญา",
    end: "กำหนดส่งมอบพัสดุ",
    penalty: "ค่าปรับต่อวัน (ร้อยละของราคาพัสดุที่ยังไม่ได้รับ)",
  },
  เช่า: {
    party: "ผู้เช่า",
    detail: "รายละเอียดพื้นที่เช่า",
    start: "วันเริ่มเช่า",
    end: "วันสิ้นสุดการเช่า",
    penalty: "ค่าปรับต่อวัน (ร้อยละ)",
  },
};

/** จำนวนเดือนเต็มของช่วงเช่า (นับวันสุดท้ายรวม) เช่น 1 พ.ย. 68 – 31 ต.ค. 69 = 12 เดือน, 15 มิ.ย. – 14 ก.ค. = 1 เดือน */
function rentalMonths(start: string | null, end: string | null): number {
  if (!start || !end || end < start) return 0;
  const [sy, sm, sd] = start.split("-").map(Number);
  const e = new Date(end + "T00:00:00Z");
  e.setUTCDate(e.getUTCDate() + 1);
  const months = (e.getUTCFullYear() - sy) * 12 + (e.getUTCMonth() + 1 - sm) - (e.getUTCDate() >= sd ? 0 : 1);
  return Math.max(months, 0);
}

const RENT_UNITS = ["วัน", "เดือน", "ภาคเรียน", "ปีการศึกษา"] as const;
type RentUnit = (typeof RENT_UNITS)[number];

/** จำนวนวันของช่วงเช่า นับวันแรกและวันสุดท้ายรวม */
function rentalDays(start: string | null, end: string | null): number {
  if (!start || !end || end < start) return 0;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

/** สถานะสัญญาจากวันสิ้นสุด: ยังไม่ระบุ / ยังไม่ครบกำหนด / ใกล้ครบ (≤7 วัน) / เลยกำหนด */
function contractStatus(endDate: string | null): { label: string; cls: string } {
  if (!endDate) return { label: "ไม่ระบุวันสิ้นสุด", cls: "badge-slate" };
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(endDate) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { label: `เลยกำหนด ${-days} วัน`, cls: "badge-red" };
  if (days <= 7) return { label: `เหลือ ${days} วัน`, cls: "badge-amber" };
  return { label: "อยู่ในสัญญา", cls: "badge-emerald" };
}

function ContractModal({
  type,
  contract,
  projects,
  teachers,
  budgetSources,
  itemSuggestions,
  onSaved,
}: {
  type: ContractType;
  contract: Contract | null;
  projects: Project[];
  teachers: string[];
  budgetSources: BudgetSource[];
  itemSuggestions: ItemSuggestions | null;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  const terms = TERMS[type];
  // สัญญาซื้อ: กรอกรายการพัสดุเป็นตาราง (แบบเดียวกับบันทึกขออนุมัติ) และจำนวนเงินตามสัญญา = ยอดรวมรายการ
  const hasItems = type === "ซื้อ";
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW }]);
  const [discount, setDiscount] = useState(contract?.discount != null ? String(contract.discount) : "");
  const [vatType, setVatType] = useState<VatType>((contract?.vat_type as VatType | null) ?? "none");
  const totals = computeTotals(itemRowsTotal(items), parseFloat(discount) || 0, vatType);
  const itemsTotal = totals.net;
  const [itemsLoaded, setItemsLoaded] = useState(!contract);
  // สัญญาเช่า: จำนวนเงินตามสัญญา = ค่าเช่าต่อเดือน × จำนวนเดือน (นับจากวันเริ่ม–สิ้นสุดการเช่า แก้จำนวนเดือนเองได้)
  const isRental = type === "เช่า";
  const [startDate, setStartDate] = useState<string | null>(contract?.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(contract?.end_date ?? null);
  const [rent, setRent] = useState(contract?.rent_monthly != null ? String(contract.rent_monthly) : "");
  const [rentUnit, setRentUnit] = useState<RentUnit>((contract?.rent_unit as RentUnit | null) ?? "เดือน");
  // จำนวนหน่วย: วัน/เดือน คำนวณจากวันเริ่ม–สิ้นสุด (แก้เองได้), ภาคเรียน/ปีการศึกษา กรอกเอง (ค่าเริ่มต้น 1)
  const [periodsInput, setPeriodsInput] = useState(contract?.rent_periods != null ? String(contract.rent_periods) : "");
  const autoPeriods = rentUnit === "เดือน" ? rentalMonths(startDate, endDate) : rentUnit === "วัน" ? rentalDays(startDate, endDate) : 1;
  const months = periodsInput !== "" ? Number(periodsInput) || 0 : autoPeriods;
  const rentalTotal = Math.round((parseFloat(rent) || 0) * months * 100) / 100;

  function loadItems() {
    if (!hasItems || itemsLoaded || !contract) return;
    setItemsLoaded(true);
    createClient()
      .from("proc_contract_items")
      .select("name, qty, unit, unit_price, note")
      .eq("contract_id", contract.id)
      .order("seq")
      .then(({ data }) => {
        if (data && data.length > 0)
          setItems(
            data.map((r) => ({
              name: r.name ?? "",
              qty: r.qty != null ? String(r.qty) : "",
              unit: r.unit ?? "",
              unitPrice: r.unit_price != null ? String(r.unit_price) : "",
              note: r.note ?? "",
            })),
          );
      });
  }
  const [budgetSourceId, setBudgetSourceId] = useState(contract?.budget_source_id ?? "");
  // โครงการเดิมของสัญญาที่ไม่อยู่ในรายการปีปัจจุบัน — ให้ยังเลือกค้างไว้ได้ตอนแก้ไข
  const projectOptions =
    contract?.project_id && !projects.some((p) => p.id === contract.project_id)
      ? [{ id: contract.project_id, name: contract.plan_projects?.name ?? "(โครงการปีก่อน)" }, ...projects]
      : projects;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    try {
      const formData = new FormData(form);
      if (hasItems) {
        const filled = items.filter((r) => r.name.trim());
        if ((parseFloat(discount) || 0) > totals.subtotal) {
          await toastError("ส่วนลดต้องไม่มากกว่ายอดรวมรายการ");
          return;
        }
        if (filled.length === 0 || itemsTotal <= 0) {
          await toastError("กรุณากรอกรายการพัสดุอย่างน้อย 1 รายการ และยอดรวมต้องมากกว่า 0");
          return;
        }
        formData.set("items_json", JSON.stringify(filled));
        formData.set("amount", String(itemsTotal));
        formData.set("discount", discount);
        formData.set("vat_type", vatType);
      }
      if (isRental) {
        if (!(rentalTotal > 0)) {
          await toastError("กรุณากรอกอัตราค่าเช่าและจำนวน (หรือวันเริ่ม–สิ้นสุดการเช่า)");
          return;
        }
        formData.set("amount", String(rentalTotal));
        formData.set("rent_periods", String(months));
      }
      const start = String(formData.get("start_date") ?? "");
      const end = String(formData.get("end_date") ?? "");
      if (start && end && end < start) {
        await toastError(`${terms.end}ต้องไม่ก่อน${terms.start}`);
        return;
      }
      const res = contract ? await updateContract(contract.id, formData) : await createContract(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!contract) {
        form.reset();
        setItems([{ ...EMPTY_ITEM_ROW }]);
        setDiscount("");
        setVatType("none");
      }
      await toastSuccess(contract ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกสัญญาเรียบร้อยแล้ว");
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
      title={contract ? `แก้ไขสัญญา ${contract.contract_no}` : `บันทึกสัญญา${type}ใหม่`}
      wide
      lazy
      onOpenChange={(open) => open && loadItems()}
      trigger={
        contract ? (
          <span className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            แก้ไข
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกสัญญาใหม่
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="contract_type" value={type} />
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ข้อมูลสัญญา</legend>
          <div>
            <label className="label">
              เลขที่สัญญา <span className="text-red-600">*</span>
            </label>
            <input name="contract_no" defaultValue={contract?.contract_no ?? ""} required className="input w-full" />
          </div>
          <div>
            <label className="label">
              วันที่ทำสัญญา <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="contract_date" defaultValue={contract?.contract_date ?? null} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">โครงการ</label>
            <select
              name="project_id"
              defaultValue={contract?.project_id ?? ""}
              onChange={(e) => {
                // ดึงแหล่งงบประมาณเริ่มต้นตามโครงการที่เลือก (แก้ทับได้)
                const src = projectOptions.find((p) => p.id === e.target.value)?.budget_source_id;
                if (src) setBudgetSourceId(src);
              }}
              className="input w-full"
            >
              <option value="">-- ไม่ระบุ --</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">แหล่งงบประมาณ</label>
            <select
              name="budget_source_id"
              value={budgetSourceId}
              onChange={(e) => setBudgetSourceId(e.target.value)}
              className="input w-full"
            >
              <option value="">-- ไม่ระบุ --</option>
              {budgetSources.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{hasItems ? "รายละเอียดเพิ่มเติม" : terms.detail}</label>
            <textarea name="detail" defaultValue={contract?.detail ?? ""} rows={hasItems ? 2 : 3} className="input w-full" />
          </div>
          {hasItems && (
            <div className="sm:col-span-2">
              <label className="label">
                {terms.detail} <span className="text-red-600">*</span>
              </label>
              <ItemRowsEditor
                rows={items}
                onChange={setItems}
                idPrefix={`contract-${contract?.id ?? "new"}`}
                nameSuggestions={itemSuggestions?.names}
                unitSuggestions={itemSuggestions?.units}
                itemDefaults={itemSuggestions?.defaults}
                totals={{ discount, onDiscountChange: setDiscount, vatType, onVatTypeChange: setVatType }}
              />
            </div>
          )}
          <div>
            <label className="label">{terms.start}</label>
            <ThaiDatePicker name="start_date" value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label className="label">{terms.end}</label>
            <ThaiDatePicker name="end_date" value={endDate} onChange={setEndDate} />
          </div>
          {isRental && (
            <>
              <div className="sm:col-span-2">
                <label className="label">พื้นที่/ล็อกที่เช่า</label>
                <input name="rental_area" defaultValue={contract?.rental_area ?? ""} placeholder="เช่น โรงอาหาร ล็อกที่ 3" className="input w-full" />
              </div>
              <div>
                <label className="label">
                  อัตราค่าเช่า (บาท) <span className="text-red-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input type="number" inputMode="decimal" step="0.01" min="0" name="rent_monthly" value={rent} onChange={(e) => setRent(e.target.value)} className="input min-w-0 flex-1 text-right" />
                  <select
                    name="rent_unit"
                    value={rentUnit}
                    onChange={(e) => {
                      setRentUnit(e.target.value as RentUnit);
                      setPeriodsInput("");
                    }}
                    aria-label="หน่วยค่าเช่า"
                    className="input w-36"
                  >
                    {RENT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        ต่อ{u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">จำนวน ({rentUnit})</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={periodsInput !== "" ? periodsInput : autoPeriods ? String(autoPeriods) : ""}
                  onChange={(e) => setPeriodsInput(e.target.value)}
                  className="input w-full text-right"
                />
                {(rentUnit === "เดือน" || rentUnit === "วัน") && (
                  <p className="mt-1 text-xs text-slate-500">คำนวณจากวันเริ่ม–สิ้นสุดการเช่า แก้เองได้</p>
                )}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">{terms.party}</legend>
          <div className="sm:col-span-2">
            <label className="label">
              ชื่อ{terms.party} <span className="text-red-600">*</span>
            </label>
            <input name="vendor_name" defaultValue={contract?.vendor_name ?? ""} required className="input w-full" />
          </div>
          <div>
            <label className="label">เลขประจำตัวผู้เสียภาษี / บัตรประชาชน</label>
            <input name="id_card" defaultValue={contract?.id_card ?? ""} inputMode="numeric" className="input w-full" />
          </div>
          <div>
            <label className="label">โทรศัพท์</label>
            <input name="phone" defaultValue={contract?.phone ?? ""} inputMode="tel" className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="label">บ้านเลขที่</label>
              <input name="house_no" defaultValue={contract?.house_no ?? ""} className="input w-full" />
            </div>
            <div>
              <label className="label">หมู่ที่</label>
              <input name="moo" defaultValue={contract?.moo ?? ""} className="input w-full" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-slate-500">พิมพ์ตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์ แล้วเลือกจากรายการ ช่องที่เหลือจะเติมให้อัตโนมัติ</p>
            <ThaiAddressInput
              defaultValue={{ tambon: contract?.tambon, amphoe: contract?.amphoe, province: contract?.province, zipcode: contract?.zipcode }}
            />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">เงินและเงื่อนไข</legend>
          <div>
            <label className="label">
              จำนวนเงินตามสัญญา (บาท) <span className="text-red-600">*</span>
            </label>
            {isRental ? (
              <input readOnly value={rentalTotal > 0 ? rentalTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : ""} placeholder="อัตราค่าเช่า × จำนวน" className="input w-full bg-slate-50 text-right font-semibold" />
            ) : hasItems ? (
              <input readOnly value={itemsTotal > 0 ? itemsTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : ""} placeholder="คำนวณจากรายการพัสดุ" className="input w-full bg-slate-50 text-right font-semibold" />
            ) : (
              <input type="number" inputMode="decimal" step="0.01" min="0" name="amount" defaultValue={contract?.amount ?? ""} required className="input w-full text-right font-semibold" />
            )}
          </div>
          {!isRental && (
            <div>
              <label className="label">งบประมาณโครงการ (บาท)</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" name="budget" defaultValue={contract?.budget ?? ""} className="input w-full text-right" />
            </div>
          )}
          <div>
            <label className="label">หลักประกันสัญญา</label>
            <select name="guarantee_type" defaultValue={contract?.guarantee_type ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {GUARANTEE_TYPES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">จำนวนเงินหลักประกัน (บาท)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="guarantee_amount" defaultValue={contract?.guarantee_amount ?? ""} className="input w-full text-right" />
          </div>
          <div>
            <label className="label">{terms.penalty}</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="penalty_rate" defaultValue={contract?.penalty_rate ?? ""} className="input w-full text-right" />
          </div>
          {!isRental && (
            <div>
              <label className="label">ผู้ตรวจรับ</label>
              <input name="inspector_name" defaultValue={contract?.inspector_name ?? ""} list="contract-teacher-names" autoComplete="off" className="input w-full" />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="label">หมายเหตุ</label>
            <textarea name="note" defaultValue={contract?.note ?? ""} rows={2} className="input w-full" />
          </div>
        </fieldset>
        <datalist id="contract-teacher-names">
          {teachers.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? "กำลังบันทึก..." : contract ? "บันทึกการแก้ไข" : "บันทึกสัญญา"}
          </button>
        </div>
      </form>
    </Modal>
  );
}


/** ปุ่ม "รายละเอียด" — ดูข้อมูลสัญญาทั้งหมดแบบอ่านอย่างเดียว (รวมรายการพัสดุของสัญญาซื้อ) */
function ContractDetailModal({ type, contract: c }: { type: ContractType; contract: Contract }) {
  const terms = TERMS[type];
  const [items, setItems] = useState<{ name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null; note: string | null }[] | null>(null);

  function load() {
    if (type !== "ซื้อ" || items) return;
    createClient()
      .from("proc_contract_items")
      .select("name, qty, unit, unit_price, total, note")
      .eq("contract_id", c.id)
      .order("seq")
      .then(({ data }) => setItems(data ?? []));
  }

  const money = (n: number | null | undefined) => (n != null ? `${formatBaht(Number(n))} บาท` : "-");
  const address = [c.house_no && `บ้านเลขที่ ${c.house_no}`, c.moo && `หมู่ที่ ${c.moo}`, c.tambon && `ตำบล${c.tambon}`, c.amphoe && `อำเภอ${c.amphoe}`, c.province && `จังหวัด${c.province}`, c.zipcode]
    .filter(Boolean)
    .join(" ");
  const st = contractStatus(c.end_date);
  const rows: [string, React.ReactNode][] = [
    ["เลขที่สัญญา", c.contract_no],
    ["วันที่ทำสัญญา", formatThaiDate(c.contract_date)],
    ["โครงการ", c.plan_projects?.name ?? "ไม่ระบุ"],
    ["แหล่งงบประมาณ", c.plan_budget_sources?.name ?? "ไม่ระบุ"],
    [type === "ซื้อ" ? "รายละเอียดเพิ่มเติม" : terms.detail, c.detail || "-"],
    [terms.start, c.start_date ? formatThaiDate(c.start_date) : "-"],
    [terms.end, <span key="e">{c.end_date ? formatThaiDate(c.end_date) : "-"} <span className={st.cls}>{st.label}</span></span>],
    ...(type === "เช่า"
      ? ([
          ["พื้นที่/ล็อกที่เช่า", c.rental_area || "-"],
          ["อัตราค่าเช่า", c.rent_monthly != null ? `${formatBaht(Number(c.rent_monthly))} บาท ต่อ${c.rent_unit ?? "เดือน"} × ${c.rent_periods ?? "-"} ${c.rent_unit ?? "เดือน"}` : "-"],
        ] as [string, React.ReactNode][])
      : []),
    [`ชื่อ${terms.party}`, c.vendor_name],
    ["เลขประจำตัวผู้เสียภาษี / บัตรประชาชน", c.id_card || "-"],
    ["ที่อยู่", address || "-"],
    ["โทรศัพท์", c.phone || "-"],
    ["จำนวนเงินตามสัญญา", <span key="a" className="font-semibold">{money(c.amount)}</span>],
    ...(type !== "เช่า" ? ([["งบประมาณโครงการ", money(c.budget)]] as [string, React.ReactNode][]) : []),
    ["หลักประกันสัญญา", c.guarantee_type ? `${c.guarantee_type}${c.guarantee_amount != null ? ` ${money(c.guarantee_amount)}` : ""}` : "-"],
    [terms.penalty, c.penalty_rate != null ? `ร้อยละ ${c.penalty_rate}` : "-"],
    ...(type !== "เช่า" ? ([["ผู้ตรวจรับ", c.inspector_name || "-"]] as [string, React.ReactNode][]) : []),
    ["หมายเหตุ", c.note || "-"],
  ];

  return (
    <Modal
      title={`สัญญา${type} ${c.contract_no}`}
      wide
      lazy
      onOpenChange={(open) => open && load()}
      trigger={
        <span className="btn-secondary btn-sm">
          <SearchIcon className="h-3.5 w-3.5" />
          รายละเอียด
        </span>
      }
    >
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="whitespace-pre-line text-slate-900 sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
      {type === "ซื้อ" && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-navy-800">{terms.detail}</h3>
          {items === null ? (
            <p className="text-sm text-slate-500">กำลังโหลด...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีรายการ</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">ที่</th>
                    <th className="px-2 py-2 text-left">รายการ</th>
                    <th className="px-2 py-2 text-right">จำนวน</th>
                    <th className="px-2 py-2 text-right">ราคา/หน่วย</th>
                    <th className="px-2 py-2 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1">
                        {it.name}
                        {it.note ? <span className="text-slate-500"> ({it.note})</span> : null}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {it.qty ?? "-"} {it.unit ?? ""}
                      </td>
                      <td className="px-2 py-1 text-right">{it.unit_price != null ? formatBaht(Number(it.unit_price)) : "-"}</td>
                      <td className="px-2 py-1 text-right">{it.total != null ? formatBaht(Number(it.total)) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

const CONTRACT_BUCKET = "procurement-files";

// อัปโหลด/ดู/เปลี่ยนไฟล์สัญญาฉบับจริง (PDF) — เพิ่มภายหลังบันทึกสัญญาได้
function ContractFileButtons({
  contract: c,
  onChanged,
  viewOnly = false,
  canDelete = false,
}: {
  contract: Contract;
  onChanged: () => void;
  viewOnly?: boolean;
  canDelete?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function upload(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      await toastError("กรุณาเลือกไฟล์ PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      await toastError("ไฟล์ใหญ่เกิน 20 MB");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      // อัปโหลดไปปลายทางที่ระบบตั้งไว้ (Google Drive หรือ Supabase Storage)
      const uploaded = await uploadFileDirect(file, { pathPrefix: "contracts", onProgress: setProgress, finalize: true });
      if (!uploaded.ref) {
        await toastError(`อัปโหลดไม่สำเร็จ: ${uploaded.error ?? ""}`);
        return;
      }
      const res = await setContractFile(c.id, uploaded.ref);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("อัปโหลดไฟล์สัญญาเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile() {
    const ok = await confirmDelete({ title: "ลบไฟล์สัญญา?", text: `สัญญาเลขที่ ${c.contract_no}` });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await clearContractFile(c.id);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("ลบไฟล์สัญญาเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    if (!c.contract_file_path) return;
    if (isDriveRef(c.contract_file_path)) {
      window.open(driveViewUrl(driveFileId(c.contract_file_path)), "_blank");
      return;
    }
    const win = window.open("", "_blank");
    const { data, error } = await createClient().storage.from(CONTRACT_BUCKET).createSignedUrl(c.contract_file_path, 3600);
    if (error || !data) {
      win?.close();
      await toastError("เปิดไฟล์ไม่สำเร็จ");
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      {c.contract_file_path && (
        <button type="button" onClick={view} className="btn-secondary btn-sm">
          ดูสัญญา
        </button>
      )}
      {!viewOnly && (
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="btn-secondary btn-sm">
          {busy ? `กำลังอัปโหลด ${progress}%` : c.contract_file_path ? "เปลี่ยนไฟล์" : "อัปโหลดสัญญา"}
        </button>
      )}
      {canDelete && c.contract_file_path && (
        <button type="button" disabled={busy} onClick={removeFile} className="btn-danger btn-sm">
          ลบไฟล์
        </button>
      )}
    </>
  );
}

const NO_FILE_BADGE = (
  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
    ยังไม่ได้อัปโหลดไฟล์สัญญา
  </span>
);

export function ContractList({ type, title, subtitle }: { type: ContractType; title: string; subtitle: string }) {
  const { isAdmin, isProcStaff } = useAuth();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [budgetSources, setBudgetSources] = useState<BudgetSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [itemSuggestions, setItemSuggestions] = useState<ItemSuggestions | null>(null);

  useEffect(() => {
    if (type !== "ซื้อ") return;
    const supabase = createClient();
    Promise.all([loadItemSuggestions(supabase), loadUnitSuggestions(supabase)]).then(([items, units]) =>
      setItemSuggestions({ names: items.names, units, defaults: items.defaults }),
    );
  }, [type]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const [{ data: contractsData, error }, { data: projectsData }, { data: teacherData }, { data: sourceData }] = await Promise.all([
      supabase
        .from("proc_contracts")
        .select(
          "id, contract_no, contract_date, start_date, end_date, project_id, budget_source_id, contract_file_path, plan_budget_sources(name), vendor_name, id_card, house_no, moo, tambon, amphoe, province, zipcode, phone, detail, budget, amount, guarantee_type, guarantee_amount, penalty_rate, discount, vat_type, rental_area, rent_monthly, rent_unit, rent_periods, inspector_name, note, plan_projects(name)",
        )
        .eq("contract_type", type)
        .order("contract_date", { ascending: false }),
      currentYear
        ? supabase.from("plan_projects").select("id, name, budget_source_id").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] as Project[] }),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order"),
    ]);
    setError(error?.message ?? null);
    setContracts((contractsData as unknown as Contract[]) ?? []);
    setProjects(projectsData ?? []);
    setTeachers((teacherData ?? []).map((t) => t.name));
    setBudgetSources(sourceData ?? []);
  }, [type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!contracts || !q) return contracts ?? [];
    return contracts.filter((c) =>
      [c.contract_no, c.vendor_name, c.plan_projects?.name, c.detail].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [contracts, query]);
  const total = filtered.reduce((sum, c) => sum + Number(c.amount), 0);

  async function handleDelete(c: Contract) {
    const ok = await confirmDelete({ title: `ลบสัญญา ${c.contract_no}?`, text: `${TERMS[type].party} ${c.vendor_name}` });
    if (!ok) return;
    try {
      const res = await deleteContract(c.id);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("ลบสัญญาเรียบร้อยแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  function actions(c: Contract) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ContractDetailModal type={type} contract={c} />
        {isProcStaff ? (
          <ContractFileButtons contract={c} onChanged={reload} canDelete={isAdmin} />
        ) : (
          c.contract_file_path && <ContractFileButtons contract={c} onChanged={reload} viewOnly />
        )}
        {isProcStaff && (
          <ContractModal type={type} contract={c} projects={projects} teachers={teachers} budgetSources={budgetSources} itemSuggestions={itemSuggestions} onSaved={reload} />
        )}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(c)} className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            ลบ
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/contracts" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
            <ChevronLeftIcon className="h-4 w-4" />
            งานสัญญา
          </Link>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {isProcStaff && (
          <ContractModal type={type} contract={null} projects={projects} teachers={teachers} budgetSources={budgetSources} itemSuggestions={itemSuggestions} onSaved={reload} />
        )}
      </div>

      {contracts === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`ค้นหาเลขที่สัญญา ${TERMS[type].party} โครงการ`}
                className="input w-full pl-9"
              />
            </div>
            <p className="text-sm text-slate-500">
              {filtered.length} สัญญา · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

            {/* พื้นที่แคบ: การ์ด */}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((c) => {
                const st = contractStatus(c.end_date);
                return (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{c.contract_no}</span>
                      <span className={st.cls}>{st.label}</span>
                      {!c.contract_file_path && NO_FILE_BADGE}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{c.vendor_name}</p>
                    <p className="text-xs text-slate-500">{c.plan_projects?.name ?? "ไม่ระบุโครงการ"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      ทำสัญญา {formatThaiDate(c.contract_date)}
                      {c.end_date ? ` · สิ้นสุด ${formatThaiDate(c.end_date)}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBaht(Number(c.amount))} บาท</p>
                    <div className="mt-2">{actions(c)}</div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบสัญญาที่ค้นหา" : "ยังไม่มีข้อมูล"}</p>}
            </div>

            {/* พื้นที่กว้าง: ตาราง */}
            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่สัญญา</th>
                  <th>วันที่ทำสัญญา</th>
                  <th>โครงการ</th>
                  <th>{TERMS[type].party}</th>
                  <th>สิ้นสุดสัญญา</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = contractStatus(c.end_date);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="font-medium text-slate-900">{c.contract_no}</div>
                        {!c.contract_file_path && <div className="mt-1 [&>span]:text-sm">{NO_FILE_BADGE}</div>}
                      </td>
                      <td>{formatThaiDate(c.contract_date)}</td>
                      <td>{c.plan_projects?.name ?? "-"}</td>
                      <td>{c.vendor_name}</td>
                      <td>
                        <div>{c.end_date ? formatThaiDate(c.end_date) : "-"}</div>
                        <span className={`${st.cls} text-sm`}>{st.label}</span>
                      </td>
                      <td className="text-right font-semibold text-slate-900">{formatBaht(Number(c.amount))}</td>
                      <td className="text-right">{actions(c)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {query ? "ไม่พบสัญญาที่ค้นหา" : "ยังไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
