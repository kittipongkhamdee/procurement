"use client";

// แบบใบสำคัญรับเงิน (กิจกรรมเสริมสร้างความรู้ให้กับนักเรียน — หนังสือ สพฐ. ว 2983/2555, แนวทางฯ ปีงบ 2569 หน้า 98–99)
//   ๑ ใบสำคัญรับเงินสำหรับวิทยากร · ๒ แบบใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน
// กรอกบนหน้านี้แล้วพิมพ์ PDF (ไม่บันทึกลงฐานข้อมูล) — ช่องที่เว้นว่างพิมพ์เป็นจุดไข่ปลาให้เขียนเอง

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ChevronLeftIcon, PlusIcon, PrinterIcon, TrashIcon } from "@/components/icons";

type Item = { description: string; amount: string };
type Row = { name: string; address: string; food: string; lodging: string; transport: string; paid_date: string | null };
const emptyRow = (): Row => ({ name: "", address: "", food: "", lodging: "", transport: "", paid_date: null });
const n = (s: string) => Math.round((Number(s) || 0) * 100) / 100;
const money = (x: number) => x.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceiptFormsPage() {
  const [tab, setTab] = useState<"speaker" | "student">("speaker");
  const [defaults, setDefaults] = useState({ school: "", area: "", officer: "" });

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
      supabase.from("fin_settings").select("key, value").eq("key", "fin_officer_name"),
      supabase.from("proc_app_settings").select("key, value").eq("key", "approval_signer_finance"),
    ]).then(([s, f, a]) =>
      setDefaults({
        school: s.data?.school_name ?? "",
        area: s.data?.education_area ?? "",
        officer: f.data?.[0]?.value || a.data?.[0]?.value || "",
      }),
    );
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/finance/ledger" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            บัญชีรับ-จ่ายเงิน
          </Link>
          <h1 className="page-title">แบบใบสำคัญรับเงิน</h1>
          <p className="page-subtitle">ค่าใช้จ่ายในการจัดกิจกรรมเพื่อเสริมสร้างความรู้ให้กับนักเรียน — กรอกแล้วพิมพ์ PDF (ช่องที่เว้นว่างพิมพ์เป็นจุดไข่ปลาให้เขียนเอง)</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("speaker")} className={tab === "speaker" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
          ๑ ใบสำคัญรับเงินสำหรับวิทยากร
        </button>
        <button type="button" onClick={() => setTab("student")} className={tab === "student" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
          ๒ ใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน
        </button>
      </div>
      {/* key: เติมค่าเริ่มต้นใหม่เมื่อโหลดค่าตั้งเสร็จ */}
      {tab === "speaker" ? <SpeakerForm key={`s${defaults.school}`} defaults={defaults} /> : <StudentForm key={`t${defaults.school}`} defaults={defaults} />}
    </div>
  );
}

/** ส่งข้อมูลไปสร้าง PDF ในแท็บใหม่ (POST — รายชื่อนักเรียนยาวเกิน URL) */
function PrintForm({ kind, data, label }: { kind: string; data: unknown; label: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} method="post" action="/finance/ledger/receipt-forms/pdf" target="_blank">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <button type="submit" className="btn-primary inline-flex items-center gap-2">
        <PrinterIcon className="h-4 w-4" />
        {label}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, className = "" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input w-full" />
    </div>
  );
}

function SpeakerForm({ defaults }: { defaults: { school: string; officer: string } }) {
  const [f, setF] = useState({ org: defaults.school, project: "", name: "", house_no: "", subdistrict: "", district: "", province: "", received_from: defaults.school, payer: defaults.officer });
  const [date, setDate] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([{ description: "", amount: "" }]);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const total = items.reduce((s, i) => s + n(i.amount), 0);
  const data = { ...f, date, items: items.map((i) => ({ description: i.description, amount: n(i.amount) })) };
  return (
    <div className="card space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="ชื่อส่วนราชการผู้จัดกิจกรรม" value={f.org} onChange={set("org")} />
        <Field label="โครงการ/หลักสูตร/กิจกรรม" value={f.project} onChange={set("project")} />
        <div>
          <label className="label">วันที่</label>
          <ThaiDatePicker value={date} onChange={setDate} />
        </div>
        <Field label="ข้าพเจ้า (ชื่อวิทยากร)" value={f.name} onChange={set("name")} />
        <Field label="อยู่บ้านเลขที่" value={f.house_no} onChange={set("house_no")} />
        <Field label="ตำบล/แขวง" value={f.subdistrict} onChange={set("subdistrict")} />
        <Field label="อำเภอ/เขต" value={f.district} onChange={set("district")} />
        <Field label="จังหวัด" value={f.province} onChange={set("province")} />
        <Field label="ได้รับเงินจาก" value={f.received_from} onChange={set("received_from")} />
        <Field label="ผู้จ่ายเงิน" value={f.payer} onChange={set("payer")} />
      </div>
      <div>
        <label className="label">รายการ (สูงสุด 14 รายการ)</label>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={it.description}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                placeholder="เช่น ค่าตอบแทนวิทยากร 6 ชั่วโมง ๆ ละ 600 บาท"
                className="input min-w-0 flex-1"
                aria-label="รายการ"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={it.amount}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                placeholder="จำนวนเงิน"
                className="input w-36"
                aria-label="จำนวนเงิน"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="btn-danger btn-sm" title="ลบแถว">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {items.length < 14 && (
            <button type="button" onClick={() => setItems([...items, { description: "", amount: "" }])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </button>
          )}
          <span className="text-sm text-slate-600">
            รวม <b className="tabular-nums">{money(total)}</b> บาท
          </span>
        </div>
      </div>
      <div className="flex justify-end">
        <PrintForm kind="speaker" data={data} label="พิมพ์ใบสำคัญรับเงิน (PDF)" />
      </div>
    </div>
  );
}

function StudentForm({ defaults }: { defaults: { school: string; area: string; officer: string } }) {
  const [f, setF] = useState({ org: defaults.school, project: "", area: defaults.area, payer: defaults.officer, payer_position: "เจ้าหน้าที่การเงิน" });
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [per, setPer] = useState({ food: "", lodging: "", transport: "" });
  const [paste, setPaste] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const upd = (i: number, k: keyof Row, v: string | null) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const totalOf = (r: Row) => n(r.food) + n(r.lodging) + n(r.transport);
  const grand = rows.reduce((s, r) => s + totalOf(r), 0);
  const data = {
    ...f,
    date_from: from,
    date_to: to,
    rows: rows.map((r) => ({ name: r.name, address: r.address, food: n(r.food), lodging: n(r.lodging), transport: n(r.transport), paid_date: r.paid_date })),
  };

  function addNames() {
    const names = paste.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!names.length) return;
    const base = rows.filter((r) => r.name.trim() || totalOf(r) > 0);
    setRows([...base, ...names.map((name) => ({ ...emptyRow(), name, ...per }))]);
    setPaste("");
  }

  return (
    <div className="card space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="ชื่อส่วนราชการผู้จัดกิจกรรม" value={f.org} onChange={set("org")} />
        <Field label="โครงการ/หลักสูตร/กิจกรรม" value={f.project} onChange={set("project")} />
        <div>
          <label className="label">วันที่ (เริ่ม)</label>
          <ThaiDatePicker value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <ThaiDatePicker value={to} onChange={setTo} minDate={from ?? undefined} />
        </div>
        <Field label="สังกัด" value={f.area} onChange={set("area")} placeholder="เช่น สพม.สุรินทร์" />
        <Field label="ผู้จ่ายเงิน" value={f.payer} onChange={set("payer")} />
        <Field label="ตำแหน่งผู้จ่ายเงิน" value={f.payer_position} onChange={set("payer_position")} />
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-700">เพิ่มรายชื่อทีละหลายคน</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="ค่าอาหาร/คน" value={per.food} onChange={(v) => setPer({ ...per, food: v })} placeholder="เช่น 160" />
          <Field label="ค่าเช่าที่พัก/คน" value={per.lodging} onChange={(v) => setPer({ ...per, lodging: v })} />
          <Field label="ค่าพาหนะ/คน" value={per.transport} onChange={(v) => setPer({ ...per, transport: v })} />
        </div>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder="วางรายชื่อนักเรียน 1 ชื่อต่อบรรทัด (คัดลอกจาก Excel ได้)" className="input mt-2 w-full" />
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={addNames} className="btn-secondary btn-sm">
            <PlusIcon className="h-3.5 w-3.5" />
            เพิ่มรายชื่อพร้อมจำนวนเงินต่อคน
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>ที่</th>
              <th>ชื่อ – สกุล</th>
              <th>ที่อยู่</th>
              <th className="text-right">ค่าอาหาร</th>
              <th className="text-right">ค่าเช่าที่พัก</th>
              <th className="text-right">ค่าพาหนะ</th>
              <th className="text-right">รวม</th>
              <th>วันที่รับเงิน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="tabular-nums">{i + 1}</td>
                <td>
                  <input value={r.name} onChange={(e) => upd(i, "name", e.target.value)} className="input w-44" aria-label="ชื่อ – สกุล" />
                </td>
                <td>
                  <input value={r.address} onChange={(e) => upd(i, "address", e.target.value)} className="input w-44" aria-label="ที่อยู่" />
                </td>
                {(["food", "lodging", "transport"] as const).map((k) => (
                  <td key={k}>
                    <input type="number" step="0.01" min="0" value={r[k]} onChange={(e) => upd(i, k, e.target.value)} className="input w-24 text-right" aria-label={k} />
                  </td>
                ))}
                <td className="whitespace-nowrap text-right tabular-nums">{money(totalOf(r))}</td>
                <td className="min-w-40">
                  <ThaiDatePicker value={r.paid_date} onChange={(d) => upd(i, "paid_date", d)} />
                </td>
                <td>
                  <button type="button" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [emptyRow()])} className="btn-danger btn-sm" title="ลบแถว">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setRows([...rows, { ...emptyRow(), ...per }])} className="btn-secondary btn-sm">
          <PlusIcon className="h-3.5 w-3.5" />
          เพิ่มแถว
        </button>
        <span className="text-sm text-slate-600">
          รวมทั้งสิ้น <b className="tabular-nums">{money(grand)}</b> บาท
        </span>
      </div>
      <div className="flex justify-end">
        <PrintForm kind="student" data={data} label="พิมพ์แบบใบสำคัญรับเงิน (PDF)" />
      </div>
    </div>
  );
}
