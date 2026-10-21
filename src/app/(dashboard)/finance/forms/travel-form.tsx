"use client";

// ฟอร์มกรอกรายงานการเดินทางไปราชการ (แบบ 8708 ส่วนที่ 1 ใบเบิกค่าใช้จ่าย + ส่วนที่ 2 หลักฐานการจ่ายเงิน)
// บันทึกเก็บไว้แก้/พิมพ์ซ้ำได้ (fin_travel_forms) — ช่องที่เว้นว่างพิมพ์เป็นจุดไข่ปลาให้เขียนเอง

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { TimeSelect } from "@/components/time-select";
import { PlusIcon, PrinterIcon, TrashIcon } from "@/components/icons";
import { allowanceDays, claimTotal, lodgingNights, rateFor, travelDuration, type LoanTravel, type TravelClaim, type TravelMember, type TravelPlace } from "@/lib/travel-claim";
import { saveReceiptForm } from "./form-store";
import type { FormDefaults } from "./receipt-forms";

const LOAN_COLS = "id, doc_no, borrower_name, borrower_position, amount, received_date, request_date, purpose, travel_return_date, travel";
type LoanRow = {
  id: string;
  doc_no: string | null;
  borrower_name: string;
  borrower_position: string | null;
  amount: number;
  received_date: string | null;
  request_date: string;
  purpose: string | null;
  travel_return_date: string | null;
  travel: LoanTravel | null;
};

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

export function TravelForm({ id, initial, loanId = null, defaults, onSaved }: { id: string | null; initial: TravelClaim | null; loanId?: string | null; defaults: FormDefaults; onSaved: (id: string) => void }) {
  const [linkedLoan, setLinkedLoan] = useState<string | null>(loanId ?? initial?.loan_id ?? null);
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
    payer: initial?.payer ?? { name: defaults.officer, position: "เจ้าหน้าที่การเงิน" },
  });
  const [saving, setSaving] = useState(false);
  const [km, setKm] = useState("");
  const [overnight, setOvernight] = useState(true);
  // ช่วยกรอก: รายชื่อบุคลากร (ชื่อ → ตำแหน่ง) และสัญญายืมเงินของผู้ใช้
  const { user } = useAuth();
  const [people, setPeople] = useState<{ name: string; position: string }[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const positionOf = (name: string) => people.find((p) => p.name === name.trim())?.position;

  function pickLoan(id: string) {
    const l = loans.find((x) => x.id === id);
    if (l) applyLoan(l);
  }
  /** เติมจากสัญญายืมเงิน: เลขที่/วันที่/ผู้ยืม/จำนวนเงิน + รายละเอียดการเดินทางที่กรอกไว้ในสัญญา (ถ้ามี) — ผูกสัญญาไว้ ตอนพิมพ์ดึงเลขที่ล่าสุดเอง */
  function applyLoan(l: LoanRow) {
    const tr = l.travel;
    setLinkedLoan(l.id);
    setF((cur) => ({
      ...cur,
      loan_no: l.doc_no ?? "",
      borrower: l.borrower_name,
      name: cur.name || l.borrower_name,
      position: cur.position || l.borrower_position || "",
      purpose: tr?.destination || cur.purpose || l.purpose || "",
      companions: tr?.companions || cur.companions,
      depart_time: tr?.depart_time || cur.depart_time,
      return_time: tr?.return_time || cur.return_time,
    }));
    setDates((d) => ({ ...d, loan_date: l.received_date ?? d.loan_date, depart_date: tr?.depart_date ?? d.depart_date, return_date: l.travel_return_date ?? d.return_date }));
    if (tr?.depart_from) setFrom(tr.depart_from);
    if (tr?.return_to) setBack(tr.return_to);
    if (tr) {
      setOvernight(tr.overnight);
      if (tr.km) setKm(String(tr.km));
    }
    setMoney4((m) => ({ ...m, loan_amount: s(l.amount) }));
  }
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("proc_profiles")
      .select("user_id, full_name, position")
      .not("full_name", "is", null)
      .order("full_name")
      .then(({ data }) => {
        const list = (data ?? []).map((p) => ({ name: (p.full_name ?? "").trim(), position: (p.position ?? "").trim() })).filter((p) => p.name);
        setPeople(list);
        // ฉบับใหม่: ผู้เดินทางเริ่มต้นเป็นผู้ใช้เอง
        const me = (data ?? []).find((p) => p.user_id === user?.userId);
        if (!initial && me?.full_name) setF((cur) => (cur.name ? cur : { ...cur, name: me.full_name ?? "", position: me.position ?? cur.position, borrower: cur.borrower || "" }));
      });
    if (user?.userId)
      supabase
        .from("proc_loan_contracts")
        .select(LOAN_COLS)
        .or(`borrower_user_id.eq.${user.userId},created_by.eq.${user.userId}`)
        .eq("loan_type", "travel")
        .order("request_date", { ascending: false })
        .limit(30)
        .then(({ data }) => setLoans(((data ?? []) as unknown as LoanRow[]).map((l) => ({ ...l, amount: Number(l.amount) }))));
    // เปิดจากสัญญายืมเงิน (ฉบับใหม่): เติมข้อมูลจากสัญญานั้น (รวมสัญญาที่ยังไม่ออกเลขที่ / ที่เจ้าหน้าที่บันทึกแทน)
    if (loanId && !initial)
      supabase
        .from("proc_loan_contracts")
        .select(LOAN_COLS)
        .eq("id", loanId)
        .maybeSingle()
        .then(({ data }) => data && applyLoan({ ...(data as unknown as LoanRow), amount: Number((data as unknown as LoanRow).amount) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId]);

  /** คำนวณตามอัตรากระทรวงการคลัง (คู่มือ สพฐ. หน้า 5–7, 33): เบี้ยเลี้ยง 240/270 บาท/วัน, ที่พักเหมาจ่าย 800/1,200 บาท/คืน, รถยนต์ส่วนตัว 4 บาท/กม. */
  function calcRates() {
    const dur = travelDuration(data);
    if (!dur) return void toastError("กรอกวันเวลาออกเดินทางและกลับถึงก่อน");
    const days = allowanceDays(dur, overnight);
    const nights = overnight ? lodgingNights(dates.depart_date!, dates.return_date!) : 0;
    const r = rateFor(f.position);
    const nextMoney = { ...money4, allowance: s(days * r.allowance), lodging: s(nights * r.lodging) };
    if (n(km) > 0) nextMoney.transport = s(n(km) * 4);
    setMoney4(nextMoney);
    setF({
      ...f,
      allowance_type: f.allowance_type || "เหมาจ่าย",
      allowance_days: String(days),
      lodging_type: nights ? f.lodging_type || "เหมาจ่าย" : f.lodging_type,
      lodging_days: nights ? String(nights) : f.lodging_days,
      transport_desc: n(km) > 0 ? `รถยนต์ส่วนบุคคล ระยะทาง ${n(km)} กม. x 4 บาท` : f.transport_desc,
    });
    if (claimFor === "group")
      setMembers(
        members.map((m) => {
          if (!m.name.trim()) return m;
          const mr = rateFor(m.position);
          return { ...m, allowance: s(days * mr.allowance), lodging: s(nights * mr.lodging), note: `เบี้ยเลี้ยง ${mr.allowance} x ${days} วัน${nights ? ` ที่พัก ${mr.lodging} x ${nights} คืน` : ""}` };
        }),
      );
    if (!dates.date) setDates({ ...dates, date: dates.return_date });
  }
  const printRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof Text) => (v: string) => setF({ ...f, [k]: v });
  const setD = (k: keyof typeof dates) => (v: string | null) => setDates({ ...dates, [k]: v });
  const setM = (k: keyof typeof money4) => (v: string) => setMoney4({ ...money4, [k]: v });
  const setSign = (who: keyof typeof signers, k: "name" | "position") => (v: string) => setSigners({ ...signers, [who]: { ...signers[who], [k]: v } });

  const memberData: TravelMember[] = members.map((m) => ({ name: m.name, position: m.position, allowance: n(m.allowance), lodging: n(m.lodging), transport: n(m.transport), other: n(m.other), note: m.note }));
  const data: TravelClaim = {
    loan_id: linkedLoan,
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
      const res = await saveReceiptForm(id, "travel", title, data, { loan_id: linkedLoan });
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
          <input type="checkbox" name={name} checked={cur === o.v} onChange={() => on(o.v)} className="h-4 w-4 rounded-sm" />
          {o.l}
        </label>
      ))}
    </div>
  );

  return (
    <div className="card space-y-5">
      <section>
        <h3 className="mb-2 font-semibold text-slate-800">สัญญาเงินยืม (ถ้ามี)</h3>
        {loans.length > 0 && (
          <div className="mb-3">
            <label className="label">ดึงจากสัญญายืมเงินของฉัน</label>
            <select value={linkedLoan ?? ""} onChange={(e) => (e.target.value ? pickLoan(e.target.value) : setLinkedLoan(null))} className="input w-full">
              <option value="">— เลือกสัญญายืมเงิน —</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {`${l.doc_no ?? "รอการเงินออกเลขที่"} · ${money(l.amount)} บาท · ${formatThaiDate(l.request_date)}${l.purpose ? ` · ${l.purpose.slice(0, 40)}` : ""}`}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <div>
            <label className="label">ข้าพเจ้า (ชื่อผู้เดินทาง/หัวหน้าคณะ)</label>
            <input list="travel-people" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, position: positionOf(e.target.value) ?? f.position })} className="input w-full" />
          </div>
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <D label="ตั้งแต่วันที่" value={dates.depart_date} onChange={setD("depart_date")} />
            <div>
              <label className="label">เวลา</label>
              <TimeSelect value={f.depart_time} onChange={set("depart_time")} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="label">กลับถึง</label>
          {radio("back", back, PLACES, (v) => setBack(v as TravelPlace))}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <D label="วันที่" value={dates.return_date} onChange={setD("return_date")} min={dates.depart_date ?? undefined} />
            <div>
              <label className="label">เวลา</label>
              <TimeSelect value={f.return_time} onChange={set("return_time")} />
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-600 sm:col-span-2">
          รวมเวลาไปราชการครั้งนี้ {dur ? <b>{`${dur.days} วัน ${dur.hours} ชั่วโมง`}</b> : <span className="text-slate-400">(กรอกวันเวลาไป–กลับ ระบบคำนวณให้)</span>}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-slate-800">ขอเบิกค่าใช้จ่ายสำหรับ</h3>
        {radio("for", claimFor, [{ v: "self", l: "ข้าพเจ้า" }, { v: "group", l: "คณะเดินทาง" }], (v) => setClaimFor(v as "self" | "group"))}
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="mb-2">
            ช่วยคำนวณตามอัตรากระทรวงการคลัง: เบี้ยเลี้ยง 240 บาท/วัน (ชำนาญการพิเศษลงมา) หรือ 270 บาท/วัน (เชี่ยวชาญขึ้นไป) · ค่าเช่าที่พักเหมาจ่าย 800 / 1,200 บาท/คืน · รถยนต์ส่วนบุคคล 4 บาท/กม.
            (นับ 24 ชม. = 1 วัน เศษเกิน 12 ชม. = 1 วัน · ไม่พักแรม เกิน 6 ชม. = ครึ่งวัน)
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} />
              พักแรม
            </label>
            <div>
              <label className="label">ระยะทางรถยนต์ส่วนบุคคล (กม. ไป-กลับ)</label>
              <input type="number" min="0" value={km} onChange={(e) => setKm(e.target.value)} className="input w-40" />
            </div>
            <button type="button" onClick={calcRates} className="btn-secondary btn-sm">
              คำนวณให้{claimFor === "group" ? " (ทุกคนในส่วนที่ 2)" : ""}
            </button>
          </div>
        </div>
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
        {/* รายชื่อผู้เดินทาง: การ์ดต่อคน (ตารางกว้างเกินจอมือถือ) */}
        <div className="space-y-3">
          {members.map((m, i) => {
            const upd = (patch: Partial<MemberRow>) => setMembers(members.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const rowTotal = n(m.allowance) + n(m.lodging) + n(m.transport) + n(m.other);
            return (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">คนที่ {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      รวม <b className="tabular-nums">{money(rowTotal)}</b> บาท
                    </span>
                    <button type="button" onClick={() => setMembers(members.length > 1 ? members.filter((_, j) => j !== i) : [emptyMember()])} className="btn-danger btn-sm" title="ลบผู้เดินทาง">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label">ชื่อ</label>
                    <input list="travel-people" value={m.name} onChange={(e) => upd({ name: e.target.value, position: positionOf(e.target.value) ?? m.position })} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">ตำแหน่ง</label>
                    <input value={m.position} onChange={(e) => upd({ position: e.target.value })} className="input w-full" />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["allowance", "เบี้ยเลี้ยง"],
                      ["lodging", "ค่าเช่าที่พัก"],
                      ["transport", "ค่าพาหนะ"],
                      ["other", "ค่าใช้จ่ายอื่น"],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k}>
                      <label className="label">{label}</label>
                      <input type="number" step="0.01" min="0" value={m[k]} onChange={(e) => upd({ [k]: e.target.value })} className="input w-full text-right" />
                    </div>
                  ))}
                </div>
                <div className="mt-2">
                  <label className="label">หมายเหตุ</label>
                  <input value={m.note} onChange={(e) => upd({ note: e.target.value })} placeholder="เช่น เบี้ยเลี้ยง 240 x 3 วัน" className="input w-full" />
                </div>
              </div>
            );
          })}
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

      <datalist id="travel-people">
        {people.map((p) => (
          <option key={p.name} value={p.name}>
            {p.position}
          </option>
        ))}
      </datalist>
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
