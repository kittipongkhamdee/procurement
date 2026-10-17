"use client";

// บัญชีวัสดุ — 1 วัสดุ = 1 บัญชี รับเข้าจากรายการจัดซื้อที่ติ๊กเป็น "วัสดุ" (ดึงตามเลขที่) หรือเพิ่มเอง (ยอดยกมา/รับอื่นๆ)
// เบิกจ่ายตัดตามล็อตที่รับเข้าก่อน (FIFO) — แก้ไข/บันทึกได้เฉพาะเจ้าหน้าที่ (ครูดูได้อย่างเดียว)

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { ledgerRows, nextStockCode, STOCK_CATEGORIES, stockBalance, type StockMove } from "@/lib/stock";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { FileTextIcon, PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { addStockReceipt, createRequisition, deleteStockItem, deleteStockMove, importFromProcurement, saveStockItem, type StockSourceType } from "./stock-actions";

type StockItem = {
  id: string;
  code: string | null;
  category: string;
  name: string;
  size_desc: string | null;
  unit: string;
  location: string | null;
  max_qty: number | null;
  min_qty: number | null;
  note: string | null;
};
type AutoReq = { id: string; doc_no: string | null; req_date: string; requester_name: string; note: string | null; created_at: string; lines: string[] };
const DISMISS_KEY = "stock-auto-import-seen";

/** แจ้งรายการที่นำเข้าอัตโนมัติจากฟอร์มจัดซื้อ (ผู้ใช้กดตกลงเบิกทั้งหมดตอนบันทึก) — ปิดแล้วจำไว้ในเครื่องนี้ */
function AutoImportNotice({ reqs }: { reqs: AutoReq[] }) {
  const [seen, setSeen] = useState<string>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const fresh = reqs.filter((r) => r.created_at > seen);
  if (fresh.length === 0) return null;
  function dismiss() {
    const latest = fresh.reduce((m, r) => (r.created_at > m ? r.created_at : m), seen);
    try {
      localStorage.setItem(DISMISS_KEY, latest);
    } catch {
      // ignore
    }
    setSeen(latest);
  }
  return (
    <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <div className="mb-1 flex items-center justify-between gap-2">
        <b>นำเข้าบัญชีวัสดุและออกใบเบิกอัตโนมัติแล้ว {fresh.length} รายการ</b>
        <button type="button" onClick={dismiss} className="btn-secondary btn-sm">
          รับทราบ
        </button>
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {fresh.map((r) => (
          <li key={r.id}>
            ใบเบิกเลขที่ <b>{r.doc_no ?? "-"}</b> ลงวันที่ {formatThaiDate(r.req_date)} · {r.note ?? ""} · ผู้เบิก {r.requester_name}
            <div className="text-emerald-800">{r.lines.join(", ")}</div>
            <a href={`/supplies/requisitions/${r.id}/pdf`} target="_blank" rel="noreferrer" className="font-semibold underline">
              พิมพ์ใบเบิก
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Source = { type: StockSourceType; id: string; doc_no: string; date: string; title: string; requester: string | null; materials: number; imported: number };

const SOURCE_LABEL: Record<StockSourceType, string> = { purchase: "จัดซื้อ/จ้าง", w119: "ว 119", urgent: "เร่งด่วน" };
const qtyText = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function ItemModal({ item, items, onSaved }: { item: StockItem | null; items: StockItem[]; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [category, setCategory] = useState(item?.category ?? STOCK_CATEGORIES[0].name);
  const [saving, setSaving] = useState(false);
  const suggestedCode = item?.code ?? nextStockCode(category, items.filter((i) => i.category === category).map((i) => i.code));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    try {
      const res = await saveStockItem(item?.id ?? null, new FormData(form));
      if (res.error) return void (await toastError(res.error));
      ref.current?.close();
      if (!item) form.reset();
      await toastSuccess("บันทึกแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      ref={ref}
      title={item ? `แก้ไขวัสดุ ${item.name}` : "เพิ่มวัสดุ"}
      lazy
      trigger={
        item ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="btn-label">แก้ไข</span>
          </span>
        ) : (
          <span className="btn-secondary inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            เพิ่มวัสดุ
          </span>
        )
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">ประเภท</label>
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full">
            {!STOCK_CATEGORIES.some((c) => c.name === category) && <option value={category}>{category}</option>}
            {STOCK_CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">รหัส</label>
          <input name="code" defaultValue={item?.code ?? ""} placeholder={suggestedCode} className="input w-full" />
          {!item && <p className="mt-1 text-xs text-slate-500">ไม่กรอก = {suggestedCode}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            ชื่อหรือชนิดวัสดุ <span className="text-red-600">*</span>
          </label>
          <input name="name" defaultValue={item?.name ?? ""} required className="input w-full" />
        </div>
        <div>
          <label className="label">ขนาดหรือลักษณะ</label>
          <input name="size_desc" defaultValue={item?.size_desc ?? ""} className="input w-full" />
        </div>
        <div>
          <label className="label">
            หน่วยนับ <span className="text-red-600">*</span>
          </label>
          <input name="unit" defaultValue={item?.unit ?? ""} required placeholder="เช่น รีม" className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ที่เก็บ</label>
          <input name="location" defaultValue={item?.location ?? ""} placeholder="เช่น ห้องพัสดุ ชั้น 1" className="input w-full" />
        </div>
        <div>
          <label className="label">จำนวนอย่างสูง</label>
          <input name="max_qty" type="number" min="0" step="any" defaultValue={item?.max_qty ?? ""} className="input w-full" />
        </div>
        <div>
          <label className="label">จำนวนอย่างต่ำ</label>
          <input name="min_qty" type="number" min="0" step="any" defaultValue={item?.min_qty ?? ""} className="input w-full" />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
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

function ReceiptModal({ item, onSaved }: { item: StockItem; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("opening", opening ? "1" : "");
    setSaving(true);
    try {
      const res = await addStockReceipt(item.id, fd);
      if (res.error) return void (await toastError(res.error));
      ref.current?.close();
      form.reset();
      await toastSuccess("บันทึกรับเข้าแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      ref={ref}
      title={`รับเข้า — ${item.name}`}
      lazy
      trigger={
        <span title="รับเข้า (ยอดยกมา/รับอื่นๆ)" className="btn-secondary btn-sm">
          <PlusIcon className="h-3.5 w-3.5" />
          <span className="btn-label">รับเข้า</span>
        </span>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={opening} onChange={(e) => setOpening(e.target.checked)} />
          ยอดยกมา (ต้นปีงบประมาณ)
        </label>
        <div>
          <label className="label">
            วันที่ <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker name="move_date" defaultValue={today()} />
        </div>
        <div>
          <label className="label">เลขที่เอกสาร</label>
          <input name="doc_no" className="input w-full" />
        </div>
        {!opening && (
          <div className="sm:col-span-2">
            <label className="label">รับจาก</label>
            <input name="party" placeholder="เช่น ร้านค้า / หน่วยงานที่บริจาค" className="input w-full" />
          </div>
        )}
        <div>
          <label className="label">
            จำนวน ({item.unit}) <span className="text-red-600">*</span>
          </label>
          <input name="qty" type="number" min="0" step="any" required className="input w-full text-right" />
        </div>
        <div>
          <label className="label">ราคาต่อหน่วย (บาท)</label>
          <input name="unit_price" type="number" min="0" step="0.01" className="input w-full text-right" />
        </div>
        {!opening && (
          <div className="sm:col-span-2">
            <label className="label">หมายเหตุ</label>
            <input name="note" className="input w-full" />
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
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

function LedgerModal({ item, moves, canEdit, onChanged }: { item: StockItem; moves: StockMove[]; canEdit: boolean; onChanged: () => void }) {
  const rows = ledgerRows(moves);
  async function remove(m: StockMove) {
    const ok = await confirmDelete({ title: "ลบรายการนี้?", text: `${formatThaiDate(m.move_date)} · ${m.kind === "in" ? "รับ" : "จ่าย"} ${qtyText(m.qty)} ${item.unit}` });
    if (!ok) return;
    const res = await deleteStockMove(m.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    onChanged();
  }
  return (
    <Modal
      title={`บัญชีวัสดุ — ${item.name}`}
      wide
      lazy
      trigger={
        <span title="ดูบัญชี" className="btn-secondary btn-sm">
          <FileTextIcon className="h-3.5 w-3.5" />
          <span className="btn-label">บัญชี</span>
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {item.code ?? "-"} · {item.category} · หน่วยนับ {item.unit}
          {item.location ? ` · ที่เก็บ ${item.location}` : ""}
        </span>
        <a href={`/supplies/stock/pdf?id=${item.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์บัญชีวัสดุ
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>รับจาก / จ่ายให้</th>
              <th>เลขที่เอกสาร</th>
              <th className="text-right">ราคา/หน่วย</th>
              <th className="text-center">รับ</th>
              <th className="text-center">จ่าย</th>
              <th className="text-center">คงเหลือ</th>
              <th className="text-right">ราคารวม</th>
              <th>หมายเหตุ</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ move: m, balance, value }) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{formatThaiDate(m.move_date)}</td>
                <td>{m.party === "ยอดยกมา" ? "ยอดยกมา" : `${m.kind === "in" ? "รับจาก" : "จ่ายให้"} ${m.party ?? "-"}`}</td>
                <td className="whitespace-nowrap">{m.doc_no ?? ""}</td>
                <td className="text-right tabular-nums">{baht(m.unit_price)}</td>
                <td className="text-center">{m.kind === "in" ? qtyText(m.qty) : ""}</td>
                <td className="text-center">{m.kind === "out" ? qtyText(m.qty) : ""}</td>
                <td className="text-center font-medium">{qtyText(balance)}</td>
                <td className="text-right tabular-nums">{baht(value)}</td>
                <td>{m.note ?? ""}</td>
                {canEdit && (
                  <td className="text-right">
                    {!m.requisition_id && (
                      <button type="button" onClick={() => remove(m)} title="ลบรายการ" className="btn-danger btn-sm">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="table-empty">
                  ยังไม่มีรายการรับ-จ่าย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">รายการจ่ายตามใบเบิก ลบ/แก้ที่เมนู &quot;ใบเบิกพัสดุ&quot; · ราคาจ่ายตัดตามล็อตที่รับเข้าก่อน (FIFO)</p>
    </Modal>
  );
}

function ImportModal({ sources, onDone }: { sources: Source[]; onDone: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [autoIssue, setAutoIssue] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const list = sources.filter((s) => !q.trim() || [s.doc_no, s.title, s.requester].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));
  async function run(s: Source) {
    setBusy(s.id);
    try {
      const res = await importFromProcurement(s.type, s.id, autoIssue);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess(res.message ?? "ดึงแล้ว");
      onDone();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Modal
      ref={ref}
      title="ดึงวัสดุจากรายการจัดซื้อ"
      wide
      lazy
      trigger={
        <span className="btn-gold inline-flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          ดึงจากรายการจัดซื้อ
        </span>
      }
    >
      <p className="mb-2 text-sm text-slate-600">แสดงเฉพาะเอกสารที่มีรายการติ๊กเป็น &quot;วัสดุ&quot; — วัสดุชื่อและหน่วยนับเดียวกันจะลงบัญชีเดิม ไม่มีจะสร้างบัญชีใหม่ให้</p>
      <label className="mb-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={autoIssue} onChange={(e) => setAutoIssue(e.target.checked)} className="mt-1" />
        <span>ออกใบเบิกให้ผู้ตรวจรับ/ผู้รับผิดชอบทั้งหมดทันที (ตรงกับใบเบิกพัสดุแผ่นสุดท้ายของชุดจัดซื้อ)</span>
      </label>
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่ รายการ ผู้รับผิดชอบ" className="input w-full pl-9" />
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {list.map((s) => {
          const all = s.imported >= s.materials;
          return (
            <div key={`${s.type}-${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-slate !text-sm">{SOURCE_LABEL[s.type]}</span>
                  <span className="font-medium text-slate-900">{s.doc_no || "(ไม่มีเลขที่)"}</span>
                  <span className="text-sm text-slate-500">{formatThaiDate(s.date)}</span>
                </div>
                <p className="text-sm text-slate-700">{s.title}</p>
                <p className="text-xs text-slate-500">
                  วัสดุ {s.materials} รายการ{s.imported ? ` · ดึงแล้ว ${s.imported}` : ""}
                  {s.requester ? ` · ${s.requester}` : ""}
                </p>
              </div>
              {all ? (
                <span className="badge-emerald !text-sm">ดึงครบแล้ว</span>
              ) : (
                <button type="button" onClick={() => run(s)} disabled={busy !== null} className="btn-primary btn-sm">
                  {busy === s.id ? "กำลังดึง..." : "ดึงเข้าบัญชี"}
                </button>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="table-empty">ไม่มีรายการจัดซื้อที่มีวัสดุในปีงบประมาณนี้</p>}
      </div>
    </Modal>
  );
}

type Line = { item_id: string; requested: string; issued: string; note: string };
const EMPTY_LINE: Line = { item_id: "", requested: "", issued: "", note: "" };

function RequisitionModal({ items, balances, onSaved }: { items: StockItem[]; balances: Map<string, number>; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const available = items.filter((i) => (balances.get(i.id) ?? 0) > 0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("lines_json", JSON.stringify(lines.filter((l) => l.item_id).map((l) => ({ ...l, requested: Number(l.requested) || Number(l.issued), issued: Number(l.issued) }))));
    setSaving(true);
    try {
      const res = await createRequisition(fd);
      if (res.error) return void (await toastError(res.error));
      ref.current?.close();
      form.reset();
      setLines([{ ...EMPTY_LINE }]);
      await toastSuccess(res.message ?? "บันทึกแล้ว");
      onSaved();
      if (res.id) window.open(`/supplies/requisitions/${res.id}/pdf`, "_blank");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      ref={ref}
      title="เบิกวัสดุ (ออกใบเบิกพัสดุ)"
      wide
      lazy
      trigger={
        <span className="btn-primary inline-flex items-center gap-2">
          <FileTextIcon className="h-4 w-4" />
          เบิกวัสดุ
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">
              วันที่เบิก <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="req_date" defaultValue={today()} />
          </div>
          <div>
            <label className="label">เลขที่ (เว้นว่าง = ออกอัตโนมัติ)</label>
            <input name="doc_no" placeholder="เฉพาะผู้ดูแลระบบกำหนดเองได้" className="input w-full" />
          </div>
          <div>
            <label className="label">
              ผู้เบิก <span className="text-red-600">*</span>
            </label>
            <input name="requester_name" required className="input w-full" />
          </div>
          <div>
            <label className="label">ตำแหน่ง</label>
            <input name="requester_position" className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">เพื่อ</label>
            <input name="purpose" placeholder="เช่น ใช้จัดทำเอกสารประกอบการสอน" className="input w-full" />
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">รายการที่เบิก</legend>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const bal = balances.get(l.item_id) ?? 0;
              const unit = items.find((x) => x.id === l.item_id)?.unit ?? "";
              const over = Number(l.issued) > bal + 1e-9;
              return (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[1fr_6rem_6rem_10rem_auto] sm:items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">วัสดุ</label>
                    <select value={l.item_id} onChange={(e) => setLine(i, { item_id: e.target.value })} className="input w-full">
                      <option value="">-- เลือกวัสดุ --</option>
                      {available.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} (คงเหลือ {qtyText(balances.get(it.id) ?? 0)} {it.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">ขอเบิก</label>
                    <input type="number" min="0" step="any" value={l.requested} onChange={(e) => setLine(i, { requested: e.target.value, issued: l.issued || e.target.value })} className="input w-full text-center" />
                  </div>
                  <div>
                    <label className="label">เบิกได้ {unit && `(${unit})`}</label>
                    <input type="number" min="0" step="any" value={l.issued} onChange={(e) => setLine(i, { issued: e.target.value })} className={`input w-full text-center ${over ? "border-red-400" : ""}`} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">หมายเหตุ</label>
                    <input value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} className="input w-full" />
                  </div>
                  <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : [{ ...EMPTY_LINE }]))} className="btn-danger btn-sm justify-self-start" title="ลบรายการ">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                  {over && <p className="col-span-2 text-xs text-red-600 sm:col-span-5">เบิกได้เกินคงเหลือ ({qtyText(bal)} {unit})</p>}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setLines((ls) => [...ls, { ...EMPTY_LINE }])} className="btn-secondary btn-sm mt-2">
            <PlusIcon className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </button>
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก..." : "บันทึกและพิมพ์ใบเบิก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function StockPage() {
  const { isProcStaff } = useAuth();
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [moves, setMoves] = useState<StockMove[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [autoReqs, setAutoReqs] = useState<AutoReq[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("year, is_open").order("year", { ascending: false });
    const current = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const ce = current ? current.year - 543 : null;
    const from = ce ? `${ce - 1}-10-01` : "1900-01-01";
    const to = ce ? `${ce}-09-30` : "2999-12-31";
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: its, error: e1 }, { data: mv }, { data: pr }, { data: w }, { data: u }, { data: auto }] = await Promise.all([
      supabase.from("proc_stock_items").select("id, code, category, name, size_desc, unit, location, max_qty, min_qty, note").order("category").order("code"),
      supabase.from("proc_stock_moves").select("*"),
      supabase.from("proc_purchase_requests").select("id, doc_no, doc_type, record_date, inspected_date, delivered_date, item_name, inspector_name, proc_purchase_items(item_class)").gte("record_date", from).lte("record_date", to),
      supabase.from("proc_w119_reports").select("id, doc_no, purchase_date, purpose, responsible_name, proc_w119_items(name, item_class)").gte("record_date", from).lte("record_date", to),
      supabase.from("proc_urgent_reports").select("id, doc_no, purchase_date, subject, responsible_name, proc_urgent_items(item_class)").gte("record_date", from).lte("record_date", to),
      supabase
        .from("proc_stock_requisitions")
        .select("id, doc_no, req_date, requester_name, note, created_at, proc_stock_moves(qty, proc_stock_items(name, unit))")
        .like("note", "นำเข้าอัตโนมัติ%")
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
    ]);
    setAutoReqs(
      (auto ?? []).map((r) => {
        const sum = new Map<string, { name: string; unit: string; qty: number }>();
        (r.proc_stock_moves as unknown as { qty: number; proc_stock_items: { name: string; unit: string } | null }[]).forEach((m) => {
          const name = m.proc_stock_items?.name ?? "-";
          const unit = m.proc_stock_items?.unit ?? "";
          const cur = sum.get(`${name}|${unit}`) ?? { name, unit, qty: 0 };
          cur.qty += Number(m.qty);
          sum.set(`${name}|${unit}`, cur);
        });
        return { id: r.id, doc_no: r.doc_no, req_date: r.req_date, requester_name: r.requester_name, note: r.note, created_at: r.created_at, lines: [...sum.values()].map((x) => `${x.name} ${qtyText(x.qty)} ${x.unit}`) };
      }),
    );
    setError(e1?.message ?? null);
    const allMoves = ((mv ?? []) as unknown as StockMove[]).map((m) => ({ ...m, qty: Number(m.qty), unit_price: Number(m.unit_price) }));
    setItems(((its ?? []) as StockItem[]).map((i) => ({ ...i, max_qty: i.max_qty != null ? Number(i.max_qty) : null, min_qty: i.min_qty != null ? Number(i.min_qty) : null })));
    setMoves(allMoves);
    const imported = (type: string, id: string) => new Set(allMoves.filter((m) => m.kind === "in" && m.source_type === type && m.source_id === id).map((m) => (m as unknown as { source_seq: number }).source_seq)).size;
    const count = (arr: { item_class: string | null }[] | null) => (arr ?? []).filter((i) => i.item_class === "material").length;
    const list: Source[] = [
      ...(pr ?? []).map((r) => ({
        type: "purchase" as const,
        id: r.id,
        doc_no: r.doc_no,
        date: r.inspected_date ?? r.delivered_date ?? r.record_date,
        title: `${r.doc_type} ${r.item_name ?? ""}`,
        requester: r.inspector_name,
        materials: count(r.proc_purchase_items as unknown as { item_class: string | null }[]),
        imported: imported("purchase", r.id),
      })),
      ...(w ?? []).map((r) => {
        const its2 = (r.proc_w119_items as unknown as { name: string; item_class: string | null }[]) ?? [];
        return { type: "w119" as const, id: r.id, doc_no: r.doc_no, date: r.purchase_date, title: its2.map((i) => i.name).join(", ") || (r.purpose ?? ""), requester: r.responsible_name, materials: count(its2), imported: imported("w119", r.id) };
      }),
      ...(u ?? []).map((r) => ({
        type: "urgent" as const,
        id: r.id,
        doc_no: r.doc_no ?? "",
        date: r.purchase_date,
        title: r.subject,
        requester: r.responsible_name,
        materials: count(r.proc_urgent_items as unknown as { item_class: string | null }[]),
        imported: imported("urgent", r.id),
      })),
    ]
      .filter((s) => s.materials > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    setSources(list);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const movesByItem = useMemo(() => {
    const m = new Map<string, StockMove[]>();
    moves.forEach((x) => m.set(x.item_id, [...(m.get(x.item_id) ?? []), x]));
    return m;
  }, [moves]);
  const balances = useMemo(() => new Map((items ?? []).map((i) => [i.id, stockBalance(movesByItem.get(i.id) ?? []).qty])), [items, movesByItem]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((i) => (!category || i.category === category) && (!q || [i.code, i.name, i.location].some((v) => v?.toLowerCase().includes(q))));
  }, [items, query, category]);
  const totalValue = filtered.reduce((s, i) => s + stockBalance(movesByItem.get(i.id) ?? []).value, 0);

  async function remove(i: StockItem) {
    const ok = await confirmDelete({ title: `ลบวัสดุ ${i.name}?`, text: "ลบได้เฉพาะวัสดุที่ยังไม่มีรายการรับ-จ่าย" });
    if (!ok) return;
    const res = await deleteStockItem(i.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }

  function actions(i: StockItem) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        <LedgerModal item={i} moves={movesByItem.get(i.id) ?? []} canEdit={isProcStaff} onChanged={reload} />
        {isProcStaff && <ReceiptModal item={i} onSaved={reload} />}
        {isProcStaff && <ItemModal item={i} items={items ?? []} onSaved={reload} />}
        {isProcStaff && !(movesByItem.get(i.id)?.length) && (
          <button type="button" onClick={() => remove(i)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  const pendingSources = sources.filter((s) => s.imported < s.materials).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">บัญชีวัสดุ</h1>
          <p className="page-subtitle">บัญชีรับ-จ่ายวัสดุ 1 วัสดุ = 1 บัญชี · ราคาจ่ายตัดตามล็อตที่รับเข้าก่อน (FIFO)</p>
        </div>
        {isProcStaff && (
          <div className="flex flex-wrap gap-2">
            <ImportModal sources={sources} onDone={reload} />
            <RequisitionModal items={items ?? []} balances={balances} onSaved={reload} />
            <ItemModal item={null} items={items ?? []} onSaved={reload} />
          </div>
        )}
      </div>

      <AutoImportNotice reqs={autoReqs} />

      {isProcStaff && pendingSources > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          มีรายการจัดซื้อที่มีวัสดุยังไม่ได้ดึงเข้าบัญชี {pendingSources} เอกสาร — กด &quot;ดึงจากรายการจัดซื้อ&quot;
        </div>
      )}

      {items === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <div className="relative col-span-2 sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหารหัส ชื่อวัสดุ ที่เก็บ" className="input w-full pl-9" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input col-span-2 sm:col-span-1">
              <option value="">ทุกประเภท</option>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <a href={`/supplies/stock/pdf${category ? `?category=${encodeURIComponent(category)}` : ""}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm col-span-2 justify-center sm:col-span-1">
              <PrinterIcon className="h-3.5 w-3.5" />
              พิมพ์บัญชีวัสดุ{category ? "ประเภทนี้" : "ทั้งหมด"}
            </a>
            <Link href="/supplies/requisitions" className="btn-secondary btn-sm col-span-2 justify-center sm:col-span-1">
              <FileTextIcon className="h-3.5 w-3.5" />
              ใบเบิกพัสดุ
            </Link>
          </div>
          <p className="mb-2 text-sm text-slate-500">
            {filtered.length} รายการ · มูลค่าคงเหลือรวม <span className="font-semibold text-slate-800">{baht(totalValue)}</span> บาท
          </p>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[52rem]:hidden">
              {filtered.map((i) => {
                const b = stockBalance(movesByItem.get(i.id) ?? []);
                const low = i.min_qty != null && b.qty <= i.min_qty;
                return (
                  <div key={i.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-500">{i.code}</span>
                      <span className="font-medium text-slate-900">{i.name}</span>
                      {low && <span className="badge-red !text-sm">ต่ำกว่าจำนวนอย่างต่ำ</span>}
                    </div>
                    <p className="text-xs text-slate-500">{i.category}</p>
                    <p className="mt-1 text-sm">
                      คงเหลือ <b>{qtyText(b.qty)}</b> {i.unit} · {baht(b.value)} บาท
                    </p>
                    <div className="mt-2">{actions(i)}</div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="table-empty">ยังไม่มีวัสดุ</p>}
            </div>
            <table className="hidden table-base w-full min-w-0 @min-[52rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อหรือชนิดวัสดุ</th>
                  <th>ประเภท</th>
                  <th className="text-center">คงเหลือ</th>
                  <th>หน่วยนับ</th>
                  <th className="text-right">มูลค่าคงเหลือ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const b = stockBalance(movesByItem.get(i.id) ?? []);
                  const low = i.min_qty != null && b.qty <= i.min_qty;
                  return (
                    <tr key={i.id}>
                      <td className="whitespace-nowrap text-slate-600">{i.code}</td>
                      <td>
                        <div className="font-medium text-slate-900">{i.name}</div>
                        {low && <span className="badge-red !text-sm">ต่ำกว่าจำนวนอย่างต่ำ</span>}
                      </td>
                      <td>{i.category}</td>
                      <td className="text-center font-semibold">{qtyText(b.qty)}</td>
                      <td>{i.unit}</td>
                      <td className="text-right tabular-nums">{baht(b.value)}</td>
                      <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(i)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      ยังไม่มีวัสดุ — กด &quot;ดึงจากรายการจัดซื้อ&quot; หรือ &quot;เพิ่มวัสดุ&quot;
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
