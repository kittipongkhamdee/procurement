"use client";

// เบิกค่าใช้จ่ายโครงการ (ตาราง 2 แนบท้ายหนังสือ ว 119 — ไม่ใช่การจัดซื้อจัดจ้าง ไม่ต้องทำรายงานพัสดุ)
// ค่าอาหารว่าง ค่าอาหาร ค่าตอบแทนวิทยากร ค่าเบี้ยเลี้ยง ค่าที่พัก ค่าพาหนะ — กรอกอัตรา × มื้อ/ชม. × คน × วัน ระบบคำนวณให้
// พิมพ์บันทึกขออนุมัติเบิกค่าใช้จ่าย + ใบติดหลักฐาน (ใบสำคัญรับเงิน + สำเนาบัตร ฯลฯ) + อัพรูปอ้างอิง

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ApprovalRefField, approvalRemaining, loadApprovalRefs, type ApprovalRefOption } from "@/components/approval-ref-field";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { addWorkingDays, evidenceRule } from "@/lib/w119";
import { CLAIM_KINDS, claimAmount, claimCalcText, type ClaimKind, type ExpenseRate } from "@/lib/expense-claims";
import { DOC_NUMBER_KINDS, docNumberTemplate, nextDocNumber } from "@/lib/doc-numbers";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { DocNoField } from "@/components/doc-no-field";
import { FileTextIcon, PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { ProcurementPhotosButton } from "../procurement-photos";
import { createExpenseClaim, deleteExpenseClaim, updateExpenseClaim, type ClaimItemInput } from "./expense-claim-actions";

type Item = {
  kind: string;
  rate_id: string | null;
  name: string;
  rate: number | null;
  units: number | null;
  people: number | null;
  days: number | null;
  amount: number;
  payee: string | null;
  evidence: string | null;
  receipt_book: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
};
type Claim = {
  id: string;
  approval_id: string | null;
  doc_no: string | null;
  record_date: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  venue: string | null;
  admin_group: string | null;
  project_id: string | null;
  activity_id: string | null;
  approval_ref: string | null;
  approval_ref_date: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  fund_source: string | null;
  payment_method: string;
  amount: number;
  proc_expense_claim_items: Item[];
  proc_expense_claim_photos: { id: string }[];
};
type Option = { id: string; name: string };
type Activity = { id: string; name: string | null; project_id: string };
type Lookups = { projects: Option[]; activities: Activity[]; groups: Option[]; teachers: string[]; positions: Record<string, string>; rates: ExpenseRate[] ; approvals: ApprovalRefOption[] };

const EVIDENCES = ["ใบสำคัญรับเงิน", "ใบเสร็จรับเงิน", "บิลเงินสด", "ใบรับรองแทนใบเสร็จรับเงิน", "แบบ บก.4231 (ค่าพาหนะส่วนตัว)"];
const FUNDS = ["เงินอุดหนุน", "เงินรายได้สถานศึกษา"];
const POSITIONS = ["ครูผู้ช่วย", "ครู", "ครู วิทยฐานะครูชำนาญการ", "ครู วิทยฐานะครูชำนาญการพิเศษ", "ครู วิทยฐานะครูเชี่ยวชาญ"];
const PAGE_SIZE = 20;
const KIND_KEYS = Object.keys(CLAIM_KINDS) as ClaimKind[];

const str = (n: number | null) => (n == null ? "" : String(n));
const num = (v: string) => (v.trim() === "" ? null : Number(v));
function newItem(kind: ClaimKind = "snack"): ClaimItemInput {
  return { kind, rate_id: "", name: CLAIM_KINDS[kind].label, rate: "", units: "", people: "", days: "", amount: "", payee: "", evidence: CLAIM_KINDS[kind].evidence, receipt_book: "", receipt_no: "", receipt_date: "" };
}
function itemAmount(i: ClaimItemInput) {
  return claimAmount({ kind: i.kind, rate: num(i.rate), units: num(i.units), people: num(i.people), days: num(i.days) }) ?? (Number(i.amount) || 0);
}
function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** ขอเบิกช้ากว่า 5 วันทำการนับถัดจากวันที่ดำเนินการเสร็จ (แนวปฏิบัติในคู่มือ) */
function isLate(c: { event_date: string; event_end_date: string | null; record_date: string }) {
  return c.record_date > addWorkingDays(c.event_end_date ?? c.event_date, 5);
}

function ClaimModal({ claim, lookups, suggestedNo, onSaved }: { claim: Claim | null; lookups: Lookups; suggestedNo: string; onSaved: () => void }) {
  const modalRef = useRef<ModalHandle>(null);
  const { isAdmin } = useAuth();
  const [saving, setSaving] = useState(false);
  const [approvalId, setApprovalId] = useState(claim?.approval_id ?? "");
  const [projectId, setProjectId] = useState(claim?.project_id ?? "");
  const [activityId, setActivityId] = useState(claim?.activity_id ?? "");
  const [eventDate, setEventDate] = useState<string | null>(claim?.event_date ?? null);
  const [eventEnd, setEventEnd] = useState<string | null>(claim?.event_end_date ?? null);
  const [recordDate, setRecordDate] = useState<string | null>(claim?.record_date ?? null);
  const [responsible, setResponsible] = useState(claim?.responsible_name ?? "");
  const [position, setPosition] = useState(claim?.responsible_position ?? "");
  const [items, setItems] = useState<ClaimItemInput[]>(
    claim?.proc_expense_claim_items.length
      ? claim.proc_expense_claim_items.map((i) => ({
          kind: i.kind,
          rate_id: i.rate_id ?? "",
          name: i.name,
          rate: str(i.rate),
          units: str(i.units),
          people: str(i.people),
          days: str(i.days),
          amount: String(i.amount),
          payee: i.payee ?? "",
          evidence: i.evidence ?? "",
          receipt_book: i.receipt_book ?? "",
          receipt_no: i.receipt_no ?? "",
          receipt_date: i.receipt_date ?? "",
        }))
      : [newItem()],
  );
  const total = items.reduce((s, i) => s + itemAmount(i), 0);
  const due = eventDate ? addWorkingDays(eventEnd ?? eventDate, 5) : null;
  const late = !!(due && recordDate && recordDate > due);
  const setItem = (idx: number, patch: Partial<ClaimItemInput>) => setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const remaining = approvalRemaining(lookups.approvals.find((a) => a.id === approvalId) ?? null, claim ? { approvalId: claim.approval_id, amount: claim.amount } : undefined);
    if (remaining != null && total > remaining + 0.005) return void (await toastError(`ยอดรวมเกินวงเงินคงเหลือของบันทึกขออนุมัติ (${formatBaht(remaining)} บาท)`));
    for (const it of items.filter((i) => i.name.trim())) {
      const kindRates = lookups.rates.filter((r) => r.kind === it.kind && r.is_active);
      if (kindRates.length === 0) continue;
      const r = kindRates.find((x) => x.id === it.rate_id);
      if (!r) return void (await toastError(`"${it.name}" ต้องเลือกอัตราตามระเบียบ`));
      if (Number(it.rate) > r.max_rate) return void (await toastError(`"${it.name}" อัตราเกินที่ระเบียบกำหนด (ไม่เกิน ${r.max_rate.toLocaleString("th-TH")} บาท)`));
    }
    const formData = new FormData(form);
    formData.set("items_json", JSON.stringify(items.filter((i) => i.name.trim())));
    setSaving(true);
    try {
      const res = claim ? await updateExpenseClaim(claim.id, formData) : await createExpenseClaim(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!claim) {
        form.reset();
        setItems([newItem()]);
        setEventDate(null);
        setEventEnd(null);
        setRecordDate(null);
      }
      await toastSuccess(claim ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : res.docNo ? `บันทึกเรียบร้อยแล้ว — เลขที่ ${res.docNo}` : "บันทึกเรียบร้อยแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const activityOptions = lookups.activities.filter((a) => a.project_id === projectId);

  return (
    <Modal
      ref={modalRef}
      title={claim ? `แก้ไขบันทึกขอเบิก ${claim.doc_no ?? ""}` : "บันทึกขออนุมัติเบิกค่าใช้จ่ายใหม่"}
      wide
      lazy
      trigger={
        claim ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="btn-label">แก้ไข</span>
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกขอเบิกค่าใช้จ่าย
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">บันทึกข้อความ</legend>
          <ApprovalRefField
            approvals={lookups.approvals}
            value={approvalId}
            total={total}
            own={claim ? { approvalId: claim.approval_id, amount: claim.amount } : undefined}
            onChange={(a, id) => {
              setApprovalId(id);
              // ดึงโครงการ/กิจกรรมจากบันทึกขออนุมัติมาเป็นค่าเริ่มต้น (แก้ได้)
              if (a?.project_id) {
                setProjectId(a.project_id);
                setActivityId(lookups.activities.find((x) => x.project_id === a.project_id && x.name === a.activity_name)?.id ?? "");
              }
            }}
          />
          <DocNoField current={claim ? claim.doc_no : undefined} suggested={suggestedNo} isAdmin={isAdmin} />
          <div>
            <label className="label">
              วันที่บันทึกขอเบิก <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="record_date" value={recordDate} onChange={setRecordDate} />
            {due && (
              <p className={`mt-1 text-xs ${late ? "text-red-600" : "text-slate-500"}`}>
                ควรขอเบิกภายใน 5 วันทำการหลังดำเนินการเสร็จ (ไม่เกิน {formatThaiDate(due)}){late ? " — เกินกำหนดแล้ว" : ""}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              ชื่องาน/กิจกรรมที่ดำเนินการ <span className="text-red-600">*</span>
            </label>
            <input name="event_name" defaultValue={claim?.event_name ?? ""} required placeholder="เช่น ประชุมผู้ปกครองนักเรียน ภาคเรียนที่ 2/2569" className="input w-full" />
          </div>
          <div>
            <label className="label">
              วันที่ดำเนินการ <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="event_date" value={eventDate} onChange={setEventDate} />
          </div>
          <div>
            <label className="label">ถึงวันที่ (ถ้าหลายวัน)</label>
            <ThaiDatePicker name="event_end_date" value={eventEnd} onChange={setEventEnd} />
          </div>
          <div>
            <label className="label">สถานที่</label>
            <input name="venue" defaultValue={claim?.venue ?? ""} placeholder="เช่น หอประชุมโรงเรียน" className="input w-full" />
          </div>
          <div>
            <label className="label">กลุ่มสาระ/ฝ่าย</label>
            <select name="admin_group" defaultValue={claim?.admin_group ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {claim?.admin_group && !lookups.groups.some((g) => g.name === claim.admin_group) && <option value={claim.admin_group}>{claim.admin_group}</option>}
              {lookups.groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">โครงการ</label>
            <select
              name="project_id"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setActivityId("");
              }}
              className="input w-full"
            >
              <option value="">-- ไม่ระบุ --</option>
              {lookups.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">กิจกรรม</label>
            <select name="activity_id" value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!projectId} className="input w-full">
              <option value="">{projectId ? "-- ไม่ระบุ --" : "-- เลือกโครงการก่อน --"}</option>
              {activityOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">อ้างบันทึกอนุมัติโครงการ เลขที่</label>
            <input name="approval_ref" defaultValue={claim?.approval_ref ?? ""} placeholder="ไม่บังคับ" className="input w-full" />
          </div>
          <div>
            <label className="label">ลงวันที่</label>
            <ThaiDatePicker name="approval_ref_date" defaultValue={claim?.approval_ref_date ?? null} />
          </div>
          <div>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <input
              name="responsible_name"
              list="claim-teachers"
              value={responsible}
              onChange={(e) => {
                setResponsible(e.target.value);
                const p = lookups.positions[e.target.value];
                if (p) setPosition(p);
              }}
              className="input w-full"
            />
            <datalist id="claim-teachers">
              {lookups.teachers.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ตำแหน่ง</label>
            <input name="responsible_position" list="claim-positions" value={position} onChange={(e) => setPosition(e.target.value)} className="input w-full" />
            <datalist id="claim-positions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">เบิกจ่ายจากเงิน</label>
            <input name="fund_source" list="claim-funds" defaultValue={claim?.fund_source ?? ""} placeholder="เช่น เงินอุดหนุน" className="input w-full" />
            <datalist id="claim-funds">
              {FUNDS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">วิธีจ่ายเงิน</label>
            <select name="payment_method" defaultValue={claim?.payment_method ?? "cash"} className="input w-full">
              <option value="cash">เงินสด</option>
              <option value="transfer">โอนเงิน</option>
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">รายการค่าใช้จ่าย (กรอกอัตรา ระบบคำนวณจำนวนเงินให้)</legend>
          <p className="mb-2 text-xs text-slate-500">
            เลือกอัตราตามระเบียบ ระบบไม่ให้กรอกเกินอัตราสูงสุด — ดู/แก้อัตราได้ที่เมนู{" "}
            <Link href="/expense-rates" className="text-navy-700 underline">
              อัตราค่าใช้จ่ายตามระเบียบ
            </Link>
          </p>
          <div className="space-y-3">
            {items.map((it, idx) => {
              const k = CLAIM_KINDS[it.kind as ClaimKind] ?? CLAIM_KINDS.other;
              const calc = { kind: it.kind, rate: num(it.rate), units: num(it.units), people: num(it.people), days: num(it.days) };
              const auto = claimAmount(calc);
              const kindRates = lookups.rates.filter((r) => r.kind === it.kind && r.is_active);
              const selectedRate = kindRates.find((r) => r.id === it.rate_id) ?? null;
              const overRate = !!selectedRate && Number(it.rate) > selectedRate.max_rate;
              return (
                <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
                  <div className="col-span-2">
                    <label className="label">ประเภท</label>
                    <select
                      value={it.kind}
                      onChange={(e) => {
                        const kind = e.target.value as ClaimKind;
                        const wasDefault = it.name === k.label;
                        setItem(idx, { kind, rate_id: "", rate: "", units: "", people: "", days: "", name: wasDefault ? CLAIM_KINDS[kind].label : it.name, evidence: CLAIM_KINDS[kind].evidence });
                      }}
                      className="input w-full"
                    >
                      {KIND_KEYS.map((kk) => (
                        <option key={kk} value={kk}>
                          {CLAIM_KINDS[kk].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <label className="label">รายการ {idx + 1}</label>
                    <input value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} className="input w-full" />
                  </div>
                  {kindRates.length > 0 && (
                    <div className="col-span-2 sm:col-span-6">
                      <label className="label">
                        อัตราตามระเบียบ <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={it.rate_id}
                        onChange={(e) => {
                          const r = lookups.rates.find((x) => x.id === e.target.value);
                          setItem(idx, { rate_id: e.target.value, rate: r ? String(r.max_rate) : "" });
                        }}
                        className="input w-full"
                      >
                        <option value="">-- เลือกอัตรา --</option>
                        {kindRates.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} — ไม่เกิน {r.max_rate.toLocaleString("th-TH")} {r.unit_note ?? "บาท"}
                          </option>
                        ))}
                      </select>
                      {selectedRate?.note && <p className="mt-1 text-xs text-slate-500">{selectedRate.note}</p>}
                    </div>
                  )}
                  <div>
                    <label className="label">อัตรา (บาท)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={selectedRate ? selectedRate.max_rate : undefined}
                      value={it.rate}
                      onChange={(e) => setItem(idx, { rate: e.target.value })}
                      disabled={kindRates.length > 0 && !selectedRate}
                      className={`input w-full text-right ${overRate ? "border-red-400 text-red-600" : ""}`}
                    />
                    {overRate && <p className="mt-1 text-xs text-red-600">เกินอัตรา {selectedRate?.max_rate.toLocaleString("th-TH")}</p>}
                  </div>
                  {k.units && (
                    <div>
                      <label className="label">จำนวน{k.units}</label>
                      <input type="number" min="0" step={it.kind === "mileage" ? "1" : "0.5"} value={it.units} onChange={(e) => setItem(idx, { units: e.target.value })} className="input w-full text-right" />
                    </div>
                  )}
                  {k.people && (
                    <div>
                      <label className="label">จำนวนคน</label>
                      <input type="number" min="0" value={it.people} onChange={(e) => setItem(idx, { people: e.target.value })} className="input w-full text-right" />
                    </div>
                  )}
                  {k.days && (
                    <div>
                      <label className="label">จำนวนวัน</label>
                      <input type="number" min="0" step="0.5" value={it.days} onChange={(e) => setItem(idx, { days: e.target.value })} className="input w-full text-right" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="label">จำนวนเงิน (บาท)</label>
                    {auto != null ? (
                      <p className="input w-full bg-slate-50 text-right">{formatBaht(auto)}</p>
                    ) : (
                      <input type="number" min="0" step="0.01" value={it.amount} onChange={(e) => setItem(idx, { amount: e.target.value })} className="input w-full text-right" />
                    )}
                  </div>
                  {auto != null && <p className="col-span-2 text-xs text-slate-500 sm:col-span-6">{claimCalcText(calc)} = {formatBaht(auto)} บาท</p>}
                  <div className="col-span-2 sm:col-span-3">
                    <label className="label">จ่ายให้ (ผู้รับเงิน/ร้าน)</label>
                    <input value={it.payee} onChange={(e) => setItem(idx, { payee: e.target.value })} placeholder="เช่น นางสมศรี ทำอาหารอร่อย" className="input w-full" />
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="label">หลักฐาน</label>
                    <select value={it.evidence} onChange={(e) => setItem(idx, { evidence: e.target.value })} className="input w-full">
                      {it.evidence && !EVIDENCES.includes(it.evidence) && <option value={it.evidence}>{it.evidence}</option>}
                      {EVIDENCES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">เล่มที่</label>
                    <input value={it.receipt_book} onChange={(e) => setItem(idx, { receipt_book: e.target.value })} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">เลขที่</label>
                    <input value={it.receipt_no} onChange={(e) => setItem(idx, { receipt_no: e.target.value })} className="input w-full" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">ลงวันที่</label>
                    <ThaiDatePicker value={it.receipt_date || null} onChange={(iso) => setItem(idx, { receipt_date: iso ?? "" })} />
                  </div>
                  <div className="col-span-2 flex items-end justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((rows) => rows.filter((_, i) => i !== idx))} className="btn-danger btn-sm">
                        <TrashIcon className="h-3.5 w-3.5" />
                        ลบรายการ
                      </button>
                    )}
                  </div>
                  <p className="col-span-2 text-xs text-slate-500 sm:col-span-6">
                    {evidenceRule(it.evidence).mode === "paste" ? "ติดในใบติดหลักฐาน: " : "แนบต่อท้ายใบติดหลักฐาน: "}
                    {evidenceRule(it.evidence).attach.join(" + ")}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setItems((rows) => [...rows, newItem("meal")])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </button>
            <p className="text-sm text-slate-700">
              รวม <span className="font-semibold">{formatBaht(total)}</span> บาท
            </p>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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

export default function ExpenseClaimsPage() {
  const { isAdmin, isProcStaff } = useAuth();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [allDocNos, setAllDocNos] = useState<string[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, string>>({});
  const [lookups, setLookups] = useState<Lookups>({ projects: [], activities: [], groups: [], teachers: [], positions: {}, rates: [] , approvals: [] });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    setFiscalYear(currentYear?.year ?? null);
    let listQuery = supabase
      .from("proc_expense_claims")
      .select(
        "id, approval_id, doc_no, record_date, event_name, event_date, event_end_date, venue, admin_group, project_id, activity_id, approval_ref, approval_ref_date, responsible_name, responsible_position, fund_source, payment_method, amount, proc_expense_claim_items(kind, rate_id, name, rate, units, people, days, amount, payee, evidence, receipt_book, receipt_no, receipt_date, seq), proc_expense_claim_photos(id)",
      );
    if (currentYear) {
      const ce = currentYear.year - 543;
      listQuery = listQuery.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
    }
    const [{ data, error }, { data: nos }, { data: projects }, { data: activities }, { data: groups }, { data: teachers }, { data: positions }, { data: rates }] = await Promise.all([
      listQuery.order("record_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("proc_expense_claims").select("doc_no"),
      currentYear ? supabase.from("plan_projects").select("id, name").eq("budget_year_id", currentYear.id).order("sort_order") : Promise.resolve({ data: [] as Option[] }),
      supabase.from("plan_activities").select("id, name, project_id").order("sort_order"),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_teacher_positions").select("teacher_name, position"),
      supabase.from("proc_expense_rates").select("id, kind, name, max_rate, unit_note, note, source, sort_order, is_active").order("sort_order"),
    ]);
    setError(error?.message ?? null);
    const n = (x: number | null) => (x == null ? null : Number(x));
    setClaims(
      ((data as unknown as (Claim & { proc_expense_claim_items: (Item & { seq: number })[] })[]) ?? []).map((c) => ({
        ...c,
        amount: Number(c.amount),
        proc_expense_claim_items: [...c.proc_expense_claim_items]
          .sort((a, b) => a.seq - b.seq)
          .map((i) => ({ ...i, rate: n(i.rate), units: n(i.units), people: n(i.people), days: n(i.days), amount: Number(i.amount) })),
      })),
    );
    setAllDocNos((nos ?? []).map((r) => r.doc_no ?? ""));
    const { data: formats } = await supabase.from("proc_app_settings").select("key, value").in("key", DOC_NUMBER_KINDS.map((k) => k.key));
    const approvalRefs = await loadApprovalRefs(supabase, currentYear?.year ?? null);
    setNumberFormats(Object.fromEntries((formats ?? []).map((f) => [f.key, f.value ?? ""])));
    setLookups({
      approvals: approvalRefs,
      projects: projects ?? [],
      activities: (activities as Activity[]) ?? [],
      groups: groups ?? [],
      teachers: (teachers ?? []).map((x) => x.name),
      positions: Object.fromEntries((positions ?? []).map((p) => [p.teacher_name, p.position])),
      rates: (rates ?? []).map((r) => ({ ...r, max_rate: Number(r.max_rate) })),
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // เลขที่ถัดไป <ลำดับที่>/<ปีงบประมาณ> — นับลำดับของเมนูนี้เอง (แก้เองได้)
  const nextDocNo = useMemo(() => nextDocNumber(docNumberTemplate("claim", numberFormats), fiscalYear, allDocNos), [allDocNos, fiscalYear, numberFormats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!claims || !q) return claims ?? [];
    return claims.filter((c) =>
      [c.doc_no, c.event_name, c.responsible_name, c.venue, ...c.proc_expense_claim_items.flatMap((i) => [i.name, i.payee])].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [claims, query]);
  const visible = filtered.slice(0, shown);
  const total = filtered.reduce((s, c) => s + c.amount, 0);

  async function handleDelete(c: Claim) {
    const ok = await confirmDelete({ title: `ลบบันทึกขอเบิก ${c.doc_no}?`, text: c.event_name });
    if (!ok) return;
    const res = await deleteExpenseClaim(c.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  // อ้างอิงบันทึกขออนุมัติที่ยังไม่อนุมัติ → ยังพิมพ์ไม่ได้ (รายการเก่าที่ไม่ได้อ้างอิงพิมพ์ได้ตามเดิม)
  const printable = (x: Claim) => !x.approval_id || lookups.approvals.find((a) => a.id === x.approval_id)?.status === "อนุมัติ";

  function actions(c: Claim) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        {!printable(c) && <span className="badge-amber !text-sm whitespace-nowrap">บันทึกขออนุมัติยังไม่อนุมัติ</span>}
        {printable(c) && (
        <a href={`/supplies/expense-claims/${c.id}/pdf`} target="_blank" rel="noreferrer" title="พิมพ์บันทึกขอเบิก" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          <span className="btn-label">พิมพ์บันทึก</span>
        </a>
        )}
        <ProcurementPhotosButton kind="expense" requestId={c.id} count={c.proc_expense_claim_photos?.length ?? 0} canEdit={isProcStaff} onChanged={reload} />
        {printable(c) && (
        <a href={`/supplies/expense-claims/${c.id}/pdf?sheet=evidence`} target="_blank" rel="noreferrer" title="ใบติดหลักฐาน" className="btn-secondary btn-sm">
          <FileTextIcon className="h-3.5 w-3.5" />
          <span className="btn-label">ใบติดหลักฐาน</span>
        </a>
        )}
        {isProcStaff && <ClaimModal claim={c} lookups={lookups} suggestedNo="" onSaved={reload} />}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(c)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  const lateBadge = <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">ขอเบิกเกิน 5 วันทำการ</span>;
  const itemSummary = (c: Claim) => c.proc_expense_claim_items.map((i) => i.name).join(", ");
  const eventDates = (c: Claim) =>
    c.event_end_date && c.event_end_date !== c.event_date ? `${formatThaiDate(c.event_date)} – ${formatThaiDate(c.event_end_date)}` : formatThaiDate(c.event_date);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">เบิกค่าใช้จ่ายโครงการ (ตาราง 2)</h1>
          <p className="page-subtitle">
            ค่าอาหารว่าง ค่าอาหาร ค่าวิทยากร ค่าเบี้ยเลี้ยง ค่าที่พัก ค่าพาหนะ — ไม่ใช่การจัดซื้อจัดจ้าง (ตาราง 2 ว 119) เบิกผ่านงานการเงิน
            {fiscalYear ? ` · ปีงบประมาณ ${fiscalYear}` : ""}
          </p>
        </div>
        {isProcStaff && <ClaimModal claim={null} lookups={lookups} suggestedNo={nextDocNo} onSaved={reload} />}
      </div>

      <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <b>ใช้เมนูนี้เมื่อ:</b> เบิกค่าอาหาร อาหารว่างและเครื่องดื่ม ค่าวิทยากร ค่าที่พัก ค่าพาหนะ ค่าเบี้ยเลี้ยง (ตาราง 2 — ไม่ใช่การจัดซื้อจัดจ้าง) —{" "}
        <b>ป้ายไวนิล วัสดุ ถ่ายเอกสาร ตกแต่งสถานที่</b> เป็นการจัดซื้อจัดจ้าง ให้ใช้เมนู{" "}
        <Link href="/supplies/w119" className="font-semibold underline">
          ว.119
        </Link>{" "}
        (ไม่เกิน 10,000 บาท) หรือ งานซื้อ/งานจ้าง
      </div>

      {claims === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE_SIZE);
                }}
                placeholder="ค้นหาเลขที่ งาน รายการ ผู้รับเงิน"
                className="input w-full pl-9"
              />
            </div>
            <p className="text-sm text-slate-500">
              {filtered.length} รายการ · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {visible.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{c.doc_no || "(ไม่มีเลขที่)"}</span>
                    <span className="text-sm text-slate-700">{c.event_name}</span>
                    {isLate(c) && lateBadge}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{itemSummary(c)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ดำเนินการ {eventDates(c)} · ขอเบิก {formatThaiDate(c.record_date)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatBaht(c.amount)} บาท</p>
                  <div className="mt-2">{actions(c)}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}</p>}
            </div>

            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่ดำเนินการ</th>
                  <th>วันที่ขอเบิก</th>
                  <th>งาน / รายการ</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-slate-900">{c.doc_no || "-"}</td>
                    <td>{eventDates(c)}</td>
                    <td>
                      <div>{formatThaiDate(c.record_date)}</div>
                      {isLate(c) && <div className="mt-1 [&>span]:text-sm">{lateBadge}</div>}
                    </td>
                    <td>
                      <div>{c.event_name}</div>
                      <div className="text-sm text-slate-500">{itemSummary(c)}</div>
                    </td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(c.amount)}</td>
                    <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(c)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      {query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > shown && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" onClick={() => setShown((v) => v + PAGE_SIZE)} className="btn-secondary">
                  โหลดเพิ่ม (แสดง {shown} จาก {filtered.length} รายการ)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
