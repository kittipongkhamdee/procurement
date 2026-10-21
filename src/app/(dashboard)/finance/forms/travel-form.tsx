"use client";

// ฟอร์มกรอกรายงานการเดินทางไปราชการ (แบบ 8708 ส่วนที่ 1 ใบเบิกค่าใช้จ่าย + ส่วนที่ 2 หลักฐานการจ่ายเงิน)
// บันทึกเก็บไว้แก้/พิมพ์ซ้ำได้ (fin_travel_forms) — ช่องที่เว้นว่างพิมพ์เป็นจุดไข่ปลาให้เขียนเอง

import { useRef, useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { PlusIcon, PrinterIcon, TrashIcon } from "@/components/icons";
import { claimTotal, travelDuration, type TravelClaim, type TravelMember, type TravelPlace } from "@/lib/travel-claim";
import { saveReceiptForm } from "./actions";
import type { FormDefaults } from "./receipt-forms";

const money = (x: number) => x.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (s: string) => Math.round((Number(s) || 0) * 100) / 100;
const s = (x: number) => (x ? String(x) : "");
type MemberRow = { name: string; position: string; allowance: string; lodging: string; transport: string; other: string; note: string };
const emptyMember = (): MemberRow => ({ name: "", position: "", allowance: "", lodging: "", transport: "", other: "", note: "" });
const PLACES: { v: TravelPlace; l: string }[] = [
  { v: "home", l: "บ้านพัก" },
  { v: "office", l: "สำนักงาน" },
  { v: "thailand", l: "ประเทศไทย" },
];

type Text = Omit<TravelClaim, "loan_amount" | "allowance" | "lodging" | "transport" | "other" | "members" | "checker" | "approver" | "payer" | "loan_date" | "date" | "order_date" | "depart_date" | "return_date" | "depart_from" | "return_to" | "claim_for" | "print_part2">;

function initialText(i: TravelClaim | null, d: FormDefaults): Text {
  return {
    loan_no: i?.loan_no ?? "",
    borrower: i?.borrower ?? "",
    office: i?.office ?? d.school,
    to: i?.to ?? (d.school ? `ผู้อำนวยการ${d.school}` : ""),
    order_no: i?.order_no ?? "",
    name: i?.name ?? "",
    position: i?.position ?? "",
    affiliation: i?.affiliation ?? d.school,
    companions: i?.companions ?? "",
    purpose: i?.purpose ?? "",
    depart_time: i?.depart_time ?? "",
    return_time: i?.return_time ?? "",
    allowance_type: i?.allowance_type ?? "",
    allowance_days: i?.allowance_days ?? "",
    lodging_type: i?.lodging_type ?? "",
    lodging_days: i?.lodging_days ?? "",
    transport_desc: i?.transport_desc ?? "",
    other_desc: i?.other_desc ?? "",
    evidence_count: i?.evidence_count ?? "",
    note: i?.note ?? "",
    province: i?.province ?? "",
  };
}

function F({ label, value, onChange, placeholder, wide = false, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean; type?: string }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      <input type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? "0" : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input w-full" />
    </div>
  );
}
function D({ label, value, onChange, min }: { label: string; value: string | null; onChange: (v: string | null) => void; min?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <ThaiDatePicker value={value} onChange={onChange} minDate={min} />
    </div>
  );
}

export function TravelForm({ id, initial, defaults, onSaved }: { id: string | null; initial: TravelClaim | null; defaults: FormDefaults; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Text>(() => initialText(initial, defaults));
  const [dates, setDates] = useState({
    loan_date: initial?.loan_date ?? null,
    date: initial?.date ?? null,
    order_date: initial?.order_date ?? null,
    depart_date: initial?.depart_date ?? null,
    return_date: initial?.return_date ?? null,
  });
  const [from, setFrom] = useState<TravelPlace | null>(initial?.depart_from ?? "office");
  const [back, setBack] = useState<TravelPlace | null>(initial?.return_to ?? "office");
  const [claimFor, setClaimFor] = useState<"self" | "group">(initial?.claim_for ?? "self");
  const [part2, setPart2] = useState(initial?.print_part2 ?? false);
  const [money4, setMoney4] = useState({
    loan_amount: s(initial?.loan_amount ?? 0),
    allowance: s(initial?.allowance ?? 0),
    lodging: s(initial?.lodging ?? 0),
    transport: s(initial?.transport ?? 0),
    other: s(initial?.other ?? 0),
  });
  const [members, setMembers] = useState<MemberRow[]>(() =>
    initial?.members.length ? initial.members.map((m) => ({ ...m, allowance: s(m.allowance), lodging: s(m.lodging), transport: s(m.transport), other: s(m.other) })) : [emptyMember()],
  );
  const [signers, setSigners] = useState({
    checker: initial?.checker ?? { name: defaults.officer, position: "เจ้าหน้าที่การเงิน" },
    approver: initial?.approver ?? { name: defaults.director, position: defaults.school ? `ผู้อำนวยการ${defaults.school}` : "" },
    payer: initial?.payer ?? { name: "", position: "" },
  });
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof Text) => (v: string) => setF({ ...f, [k]: v });
  const setD = (k: keyof typeof dates) => (v: string | null) => setDates({ ...dates, [k]: v });
  const setM = (k: keyof typeof money4) => (v: string) => setMoney4({ ...money4, [k]: v });
  const setSign = (who: keyof typeof signers, k: "name" | "position") => (v: string) => setSigners({ ...signers, [who]: { ...signers[who], [k]: v } });

  const memberData: TravelMember[] = members.map((m) => ({ name: m.name, position: m.position, allowance: n(m.allowance), lodging: n(m.lodging), transport: n(m.transport), other: n(m.other), note: m.note }));
  const data: TravelClaim = {
    ...f,
    ...dates,
    depart_from: from,
    return_to: back,
    claim_for: claimFor,
    print_part2: part2,
    loan_amount: n(money4.loan_amount),
    allowance: n(money4.allowance),
    lodging: n(money4.lodging),
    transport: n(money4.transport),
    other: n(money4.other),
    members: memberData,
    ...signers,
  };
  const dur = travelDuration(data);
  const total = claimTotal(data);
  const sumM = (k: "allowance" | "lodging" | "transport" | "other") => memberData.reduce((a, m) => a + m[k], 0);

  function applyMemberTotals() {
    setMoney4({ ...money4, allowance: s(sumM("allowance")), lodging: s(sumM("lodging")), transport: s(sumM("transport")), other: s(sumM("other")) });
  }
  async function save() {
    setSaving(true);
    try {
      const title = [f.name, f.purpose].filter(Boolean).join(" — ");
      const res = await saveReceiptForm(id, "travel", title, data);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("บันทึกแล้ว");
      onSaved(res.id!);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const radio = (name: string, cur: string | null, opts: { v: string; l: string }[], on: (v: string) => void) => (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <label key={o.v} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${cur === o.v ? "border-navy-800 bg-navy-800/[0.06] font-semibold" : "border-slate-200"}`}>
          <input type="radio" name={name} checked={cur === o.v} onChange={() => on(o.v)} />
          {o.l}
        </label>
      ))}
    </div>
  );

  return (
    <div className="card space-y-5">
      <section>
        <h3 className="mb-2 font-semibold text-slate-800">สัญญาเงินยืม (ถ้ามี)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <F label="สัญญาเงินยืมเลขที่" value={f.loan_no} onChange={set("loan_no")} />
          <D label="วันที่" value={dates.loan_date} onChange={setD("loan_date")} />
          <F label="ชื่อผู้ยืม" value={f.borrower} onChange={set("borrower")} />
          <F label="จำนวนเงิน (บาท)" type="number" value={money4.loan_amount} onChange={setM("loan_amount")} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="ที่ทำการ" value={f.office} onChange={set("office")} />
          <D label="วันที่ (วันทำการที่กลับถึงสำนักงาน)" value={dates.date} onChange={setD("date")} />
          <F label="เรียน" value={f.to} onChange={set("to")} />
          <F label="จังหวัด (ส่วนที่ 2)" value={f.province} onChange={set("province")} />
          <F label="ตามคำสั่ง/บันทึก ที่" value={f.order_no} onChange={set("order_no")} />
          <D label="ลงวันที่" value={dates.order_date} onChange={setD("order_date")} />
          <F label="ข้าพเจ้า (ชื่อผู้เดินทาง/หัวหน้าคณะ)" value={f.name} onChange={set("name")} />
          <F label="ตำแหน่ง" value={f.position} onChange={set("position")} />
          <F label="สังกัด" value={f.affiliation} onChange={set("affiliation")} />
          <F label="พร้อมด้วย (ผู้ร่วมเดินทาง)" value={f.companions} onChange={set("companions")} placeholder="ชื่อ-สกุลผู้ร่วมเดินทาง (ถ้ามี)" />
          <F label="เดินทางไปปฏิบัติราชการ (เรื่อง/สถานที่)" value={f.purpose} onChange={set("purpose")} wide />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="label">ออกเดินทางจาก</label>
          {radio("from", from, PLACES, (v) => setFrom(v as TravelPlace))}
          <div className="grid grid-cols-2 gap-2">
            <D label="ตั้งแต่วันที่" value={dates.depart_date} onChange={setD("depart_date")} />
            <F label="เวลา (น.)" value={f.depart_time} onChange={set("depart_time")} placeholder="เช่น 06.00" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="label">กลับถึง</label>
          {radio("back", back, PLACES, (v) => setBack(v as TravelPlace))}
          <div className="grid grid-cols-2 gap-2">
            <D label="วันที่" value={dates.return_date} onChange={setD("return_date")} min={dates.depart_date ?? undefined} />
            <F label="เวลา (น.)" value={f.return_time} onChange={set("return_time")} placeholder="เช่น 18.30" />
          </div>
        </div>
        <p className="text-sm text-slate-600 sm:col-span-2">
          รวมเวลาไปราชการครั้งนี้ {dur ? <b>{`${dur.days} วัน ${dur.hours} ชั่วโมง`}</b> : <span className="text-slate-400">(กรอกวันเวลาไป–กลับ ระบบคำนวณให้)</span>}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ขอเบิกค่าใช้จ่ายสำหรับ</h3>
        {radio("for", claimFor, [{ v: "self", l: "ข้าพเจ้า" }, { v: "group", l: "คณะเดินทาง" }], (v) => setClaimFor(v as "self" | "group"))}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <F label="ค่าเบี้ยเลี้ยงเดินทางประเภท" value={f.allowance_type} onChange={set("allowance_type")} placeholder="เช่น ก / ข" />
          <F label="จำนวน (วัน)" value={f.allowance_days} onChange={set("allowance_days")} />
          <F label="รวม (บาท)" type="number" value={money4.allowance} onChange={setM("allowance")} wide />
          <F label="ค่าเช่าที่พักประเภท" value={f.lodging_type} onChange={set("lodging_type")} placeholder="เช่น เหมาจ่าย / จ่ายจริง" />
          <F label="จำนวน (วัน)" value={f.lodging_days} onChange={set("lodging_days")} />
          <F label="รวม (บาท)" type="number" value={money4.lodging} onChange={setM("lodging")} wide />
          <F label="ค่าพาหนะ (รายละเอียด)" value={f.transport_desc} onChange={set("transport_desc")} wide placeholder="เช่น รถยนต์ส่วนตัว 120 กม. x 4 บาท" />
          <F label="รวม (บาท)" type="number" value={money4.transport} onChange={setM("transport")} wide />
          <F label="ค่าใช้จ่ายอื่น (รายละเอียด)" value={f.other_desc} onChange={set("other_desc")} wide />
          <F label="รวม (บาท)" type="number" value={money4.other} onChange={setM("other")} wide />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-600">
            รวมเงินทั้งสิ้น <b className="tabular-nums">{money(total)}</b> บาท
          </span>
          <F label="หลักฐานการจ่ายที่ส่งมาด้วย (ฉบับ)" value={f.evidence_count} onChange={set("evidence_count")} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-800">ส่วนที่ 2 หลักฐานการจ่ายเงิน (รายชื่อผู้เดินทาง)</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={part2 || claimFor === "group"} disabled={claimFor === "group"} onChange={(e) => setPart2(e.target.checked)} />
            พิมพ์ส่วนที่ 2 {claimFor === "group" && "(เบิกเป็นคณะ — พิมพ์เสมอ)"}
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th>ที่</th>
                <th>ชื่อ</th>
                <th>ตำแหน่ง</th>
                <th className="text-right">เบี้ยเลี้ยง</th>
                <th className="text-right">ที่พัก</th>
                <th className="text-right">พาหนะ</th>
                <th className="text-right">อื่นๆ</th>
                <th>หมายเหตุ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <input value={m.name} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="input w-40" aria-label="ชื่อ" />
                  </td>
                  <td>
                    <input value={m.position} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, position: e.target.value } : x)))} className="input w-28" aria-label="ตำแหน่ง" />
                  </td>
                  {(["allowance", "lodging", "transport", "other"] as const).map((k) => (
                    <td key={k}>
                      <input type="number" step="0.01" min="0" value={m[k]} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} className="input w-24 text-right" aria-label={k} />
                    </td>
                  ))}
                  <td>
                    <input value={m.note} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} placeholder="เช่น 240 x 3 วัน" className="input w-36" aria-label="หมายเหตุ" />
                  </td>
                  <td>
                    <button type="button" onClick={() => setMembers(members.length > 1 ? members.filter((_, j) => j !== i) : [emptyMember()])} className="btn-danger btn-sm" title="ลบแถว">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMembers([...members, emptyMember()])} className="btn-secondary btn-sm">
            <PlusIcon className="h-3.5 w-3.5" />
            เพิ่มผู้เดินทาง
          </button>
          <button type="button" onClick={applyMemberTotals} className="btn-secondary btn-sm">
            ใช้ยอดรวมจากรายชื่อนี้เป็นยอดขอเบิก
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ผู้ลงนาม</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <F label="ผู้ตรวจสอบหลักฐาน" value={signers.checker.name} onChange={setSign("checker", "name")} />
          <F label="ตำแหน่ง" value={signers.checker.position} onChange={setSign("checker", "position")} />
          <F label="ผู้อนุมัติ" value={signers.approver.name} onChange={setSign("approver", "name")} />
          <F label="ตำแหน่ง" value={signers.approver.position} onChange={setSign("approver", "position")} />
          <F label="ผู้จ่ายเงิน" value={signers.payer.name} onChange={setSign("payer", "name")} />
          <F label="ตำแหน่ง" value={signers.payer.position} onChange={setSign("payer", "position")} />
          <div className="sm:col-span-2">
            <label className="label">หมายเหตุ</label>
            <textarea value={f.note} onChange={(e) => set("note")(e.target.value)} rows={2} className="input w-full" placeholder="เช่น วันเวลาเดินทางของผู้ร่วมคณะที่ต่างกัน" />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={save} disabled={saving} className="btn-secondary">
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <form ref={printRef} method="post" action="/finance/forms/pdf" target="_blank">
          <input type="hidden" name="kind" value="travel" />
          <input type="hidden" name="data" value={JSON.stringify(data)} />
          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <PrinterIcon className="h-4 w-4" />
            พิมพ์แบบ 8708 (PDF)
          </button>
        </form>
      </div>
    </div>
  );
}
