"use client";

// ว.119 ค่าใช้จ่ายบริหารงาน — รายงานขอความเห็นชอบการจัดซื้อจัดจ้างและขออนุมัติเบิกจ่ายเงิน (ครั้งละไม่เกิน 10,000 บาท)
// ตามหนังสือ กค (กวจ) 0405.2/ว 119 ลว. 7 มี.ค. 2561 — ผู้ได้รับมอบหมายซื้อ/จ้างไปก่อน แล้วรายงานภายใน 5 วันทำการ
// แต่ละรายการมีผู้ขาย/ผู้รับจ้างและหลักฐาน (ใบเสร็จ/บิลเงินสด/ใบสำคัญรับเงิน) ของตัวเอง

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { addWorkingDays, evidenceRule, W119_LIMIT, W119_TABLE1, W119_TABLE2_EXAMPLES } from "@/lib/w119";
import { DOC_NUMBER_KINDS, docNumberTemplate, nextDocNumber } from "@/lib/doc-numbers";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { FileTextIcon, PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { ProcurementPhotosButton } from "../procurement-photos";
import { createW119, deleteW119, updateW119, type W119ItemInput } from "./w119-actions";

type Item = { name: string; vendor: string | null; evidence: string | null; receipt_book: string | null; receipt_no: string | null; receipt_date: string | null; amount: number };
type Report = {
  id: string;
  doc_no: string;
  record_date: string;
  purchase_date: string;
  admin_group: string | null;
  project_id: string | null;
  activity_id: string | null;
  purpose: string | null;
  expense_category: string;
  table_ref: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  payment_method: string;
  fund_source: string | null;
  amount: number;
  plan_projects: { name: string } | null;
  proc_w119_items: Item[];
  proc_w119_photos: { id: string }[];
};
type Option = { id: string; name: string };
type Activity = { id: string; name: string | null; project_id: string };
type Lookups = { projects: Option[]; activities: Activity[]; groups: Option[]; teachers: string[]; positions: Record<string, string>; vendors: string[] };

const EVIDENCES = ["ใบเสร็จรับเงิน", "บิลเงินสด", "ใบกำกับภาษี/ใบเสร็จรับเงิน", "ใบสำคัญรับเงิน", "ใบรับรองแทนใบเสร็จรับเงิน"];
const FUNDS = ["เงินอุดหนุน", "เงินรายได้สถานศึกษา"];
const POSITIONS = ["ครูผู้ช่วย", "ครู", "ครู วิทยฐานะครูชำนาญการ", "ครู วิทยฐานะครูชำนาญการพิเศษ", "ครู วิทยฐานะครูเชี่ยวชาญ", "เจ้าหน้าที่พัสดุ"];
const PAGE_SIZE = 20;
const EMPTY_ITEM: W119ItemInput = { name: "", vendor: "", evidence: "ใบเสร็จรับเงิน", receipt_book: "", receipt_no: "", receipt_date: "", amount: "" };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** รายงานช้ากว่า 5 วันทำการนับถัดจากวันที่จัดซื้อจัดจ้าง */
function isLate(r: { purchase_date: string; record_date: string }) {
  return r.record_date > addWorkingDays(r.purchase_date, 5);
}

function W119Modal({ report, lookups, suggestedNo, onSaved }: { report: Report | null; lookups: Lookups; suggestedNo: string; onSaved: () => void }) {
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState(report?.project_id ?? "");
  const [activityId, setActivityId] = useState(report?.activity_id ?? "");
  const [purchaseDate, setPurchaseDate] = useState<string | null>(report?.purchase_date ?? null);
  const [recordDate, setRecordDate] = useState<string | null>(report?.record_date ?? null);
  const [responsible, setResponsible] = useState(report?.responsible_name ?? "");
  const [position, setPosition] = useState(report?.responsible_position ?? "");
  const [items, setItems] = useState<W119ItemInput[]>(
    report?.proc_w119_items.length
      ? report.proc_w119_items.map((i) => ({
          name: i.name,
          vendor: i.vendor ?? "",
          evidence: i.evidence ?? "",
          receipt_book: i.receipt_book ?? "",
          receipt_no: i.receipt_no ?? "",
          receipt_date: i.receipt_date ?? "",
          amount: String(i.amount),
        }))
      : [{ ...EMPTY_ITEM }],
  );
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const due = purchaseDate ? addWorkingDays(purchaseDate, 5) : null;
  const late = !!(due && recordDate && recordDate > due);
  const overVendors = useMemo(() => {
    const m = new Map<string, number>();
    items.filter((i) => i.name.trim()).forEach((i) => {
      const k = i.vendor.trim() || i.name.trim();
      m.set(k, (m.get(k) ?? 0) + (Number(i.amount) || 0));
    });
    return [...m].filter(([, s]) => s > W119_LIMIT).map(([v]) => v);
  }, [items]);

  const setItem = (idx: number, patch: Partial<W119ItemInput>) => setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (overVendors.length) {
      await toastError(`จัดซื้อจัดจ้างจาก "${overVendors[0]}" เกินวงเงิน ว.119 (ครั้งละไม่เกิน 10,000 บาท)`);
      return;
    }
    const formData = new FormData(form);
    formData.set("items_json", JSON.stringify(items.filter((i) => i.name.trim())));
    setSaving(true);
    try {
      const res = report ? await updateW119(report.id, formData) : await createW119(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!report) {
        form.reset();
        setItems([{ ...EMPTY_ITEM }]);
        setPurchaseDate(null);
        setRecordDate(null);
      }
      await toastSuccess(report ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกเรียบร้อยแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const projectOptions = lookups.projects;
  const activityOptions = lookups.activities.filter((a) => a.project_id === projectId);

  return (
    <Modal
      ref={modalRef}
      title={report ? `แก้ไขรายงาน ว.119 ${report.doc_no}` : "บันทึกรายงาน ว.119 ใหม่"}
      wide
      lazy
      trigger={
        report ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="btn-label">แก้ไข</span>
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกรายงาน ว.119
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">บันทึกข้อความ</legend>
          <div>
            <label className="label">
              เลขที่ <span className="text-red-600">*</span>
            </label>
            <input name="doc_no" key={report?.id ?? suggestedNo} defaultValue={report?.doc_no ?? suggestedNo} required className="input w-full" />
          </div>
          <div>
            <label className="label">กลุ่มสาระ/ฝ่าย</label>
            <select name="admin_group" defaultValue={report?.admin_group ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {report?.admin_group && !lookups.groups.some((g) => g.name === report.admin_group) && <option value={report.admin_group}>{report.admin_group}</option>}
              {lookups.groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              วันที่จัดซื้อจัดจ้าง <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="purchase_date" value={purchaseDate} onChange={setPurchaseDate} />
          </div>
          <div>
            <label className="label">
              วันที่รายงาน (บันทึกข้อความ) <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="record_date" value={recordDate} onChange={setRecordDate} />
            {due && (
              <p className={`mt-1 text-xs ${late ? "text-red-600" : "text-slate-500"}`}>
                ต้องรายงานภายใน 5 วันทำการ (ไม่เกิน {formatThaiDate(due)}){late ? " — เกินกำหนดแล้ว" : ""}
              </p>
            )}
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
              {projectOptions.map((p) => (
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
          <div className="sm:col-span-2">
            <label className="label">
              ประเภทค่าใช้จ่าย (ตาราง 1 แนบท้ายหนังสือ ว 119) <span className="text-red-600">*</span>
            </label>
            <select name="expense_category" defaultValue={report?.expense_category ?? ""} required className="input w-full">
              <option value="">-- เลือกรายการ --</option>
              {report?.expense_category && !W119_TABLE1.includes(report.expense_category) && (
                <option value={report.expense_category}>{report.expense_category} (ข้อมูลเดิม)</option>
              )}
              {W119_TABLE1.map((c, i) => (
                <option key={c} value={c}>
                  {i + 1}. {c}
                </option>
              ))}
            </select>
            {report?.expense_category && !W119_TABLE1.includes(report.expense_category) && <input type="hidden" name="table_ref" value={report.table_ref ?? ""} />}
            <p className="mt-1 text-xs text-amber-700">
              รายการตาราง 2 ไม่ใช่การจัดซื้อจัดจ้าง ไม่ต้องทำรายงานนี้ (เบิกจ่ายตามระเบียบการเงิน) เช่น {W119_TABLE2_EXAMPLES}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">เพื่อ (ใช้สำหรับ)</label>
            <input name="purpose" defaultValue={report?.purpose ?? ""} placeholder="เช่น ประชุมคณะกรรมการสถานศึกษา ครั้งที่ 1/2570" className="input w-full" />
          </div>
          <div>
            <label className="label">ผู้ได้รับมอบหมาย (ผู้จัดซื้อจัดจ้าง)</label>
            <input
              name="responsible_name"
              list="w119-teachers"
              value={responsible}
              onChange={(e) => {
                setResponsible(e.target.value);
                const p = lookups.positions[e.target.value];
                if (p) setPosition(p);
              }}
              className="input w-full"
            />
            <datalist id="w119-teachers">
              {lookups.teachers.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ตำแหน่ง</label>
            <input name="responsible_position" list="w119-positions" value={position} onChange={(e) => setPosition(e.target.value)} className="input w-full" />
            <datalist id="w119-positions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">เบิกจ่ายจากเงิน</label>
            <input name="fund_source" list="w119-funds" defaultValue={report?.fund_source ?? ""} placeholder="เช่น เงินอุดหนุน" className="input w-full" />
            <datalist id="w119-funds">
              {FUNDS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">วิธีจ่ายเงิน</label>
            <select name="payment_method" defaultValue={report?.payment_method ?? "cash"} className="input w-full">
              <option value="cash">เงินสด</option>
              <option value="transfer">โอนเงิน</option>
            </select>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">รายการที่จัดซื้อจัดจ้าง (แต่ละผู้ขายรวมไม่เกิน 10,000 บาท)</legend>
          <datalist id="w119-vendors">
            {lookups.vendors.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
                <div className="col-span-2 sm:col-span-4">
                  <label className="label">รายการ {idx + 1}</label>
                  <input value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} placeholder="เช่น ค่าป้ายไวนิลประชุมผู้ปกครอง" className="input w-full" />
                </div>
                <div className="col-span-2">
                  <label className="label">จำนวนเงิน (บาท)</label>
                  <input type="number" min="0" step="0.01" value={it.amount} onChange={(e) => setItem(idx, { amount: e.target.value })} className="input w-full text-right" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="label">ผู้ขาย/ผู้รับจ้าง</label>
                  <input list="w119-vendors" value={it.vendor} onChange={(e) => setItem(idx, { vendor: e.target.value })} className="input w-full" />
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
                <p className="col-span-2 text-xs text-slate-500 sm:col-span-6">
                  {evidenceRule(it.evidence).mode === "paste" ? "ติดในใบติดหลักฐาน: " : "แนบต่อท้ายใบติดหลักฐาน: "}
                  {evidenceRule(it.evidence).attach.join(" + ")}
                </p>
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
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM, vendor: rows[rows.length - 1]?.vendor ?? "" }])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </button>
            <p className="text-sm text-slate-700">
              รวม <span className="font-semibold">{formatBaht(total)}</span> บาท
            </p>
          </div>
          {overVendors.length > 0 && <p className="mt-2 text-sm text-red-600">เกินวงเงิน ว.119 (ครั้งละไม่เกิน 10,000 บาท): {overVendors.join(", ")} — ต้องจัดซื้อจัดจ้างตามวิธีปกติ</p>}
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

export default function W119Page() {
  const { isAdmin, isProcStaff } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [allDocNos, setAllDocNos] = useState<string[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, string>>({});
  const [lookups, setLookups] = useState<Lookups>({ projects: [], activities: [], groups: [], teachers: [], positions: {}, vendors: [] });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    setFiscalYear(currentYear?.year ?? null);
    let listQuery = supabase
      .from("proc_w119_reports")
      .select(
        "id, doc_no, record_date, purchase_date, admin_group, project_id, activity_id, purpose, expense_category, table_ref, responsible_name, responsible_position, payment_method, fund_source, amount, plan_projects(name), proc_w119_items(name, vendor, evidence, receipt_book, receipt_no, receipt_date, amount, seq), proc_w119_photos(id)",
      );
    if (currentYear) {
      const ce = currentYear.year - 543;
      listQuery = listQuery.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
    }
    const [{ data, error }, { data: nos }, { data: projects }, { data: activities }, { data: groups }, { data: teachers }, { data: positions }, { data: vendors }] =
      await Promise.all([
        listQuery.order("record_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("proc_w119_reports").select("doc_no"),
        currentYear ? supabase.from("plan_projects").select("id, name").eq("budget_year_id", currentYear.id).order("sort_order") : Promise.resolve({ data: [] as Option[] }),
        supabase.from("plan_activities").select("id, name, project_id").order("sort_order"),
        supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
        supabase.from("proc_teacher_positions").select("teacher_name, position"),
        supabase.from("proc_vendors").select("name").order("name"),
      ]);
    setError(error?.message ?? null);
    setReports(
      ((data as unknown as (Report & { proc_w119_items: (Item & { seq: number })[] })[]) ?? []).map((r) => ({
        ...r,
        amount: Number(r.amount),
        proc_w119_items: [...r.proc_w119_items].sort((a, b) => a.seq - b.seq).map((i) => ({ ...i, amount: Number(i.amount) })),
      })),
    );
    setAllDocNos((nos ?? []).map((r) => r.doc_no));
    const { data: formats } = await supabase.from("proc_app_settings").select("key, value").in("key", DOC_NUMBER_KINDS.map((k) => k.key));
    setNumberFormats(Object.fromEntries((formats ?? []).map((f) => [f.key, f.value ?? ""])));
    setLookups({
      projects: projects ?? [],
      activities: (activities as Activity[]) ?? [],
      groups: groups ?? [],
      teachers: (teachers ?? []).map((x) => x.name),
      positions: Object.fromEntries((positions ?? []).map((p) => [p.teacher_name, p.position])),
      vendors: (vendors ?? []).map((v) => v.name),
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // เลขที่ถัดไป <ลำดับที่>/<ปีงบประมาณ> — ว.119 นับลำดับของตัวเอง (แก้เองได้)
  const nextDocNo = useMemo(() => nextDocNumber(docNumberTemplate("w119", numberFormats), fiscalYear, allDocNos), [allDocNos, fiscalYear, numberFormats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!reports || !q) return reports ?? [];
    return reports.filter((r) =>
      [r.doc_no, r.expense_category, r.purpose, r.responsible_name, r.plan_projects?.name, ...r.proc_w119_items.flatMap((i) => [i.name, i.vendor])].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [reports, query]);
  const visible = filtered.slice(0, shown);
  const total = filtered.reduce((s, r) => s + r.amount, 0);

  async function handleDelete(r: Report) {
    const ok = await confirmDelete({ title: `ลบรายงาน ว.119 ${r.doc_no}?`, text: r.proc_w119_items.map((i) => i.name).join(", ") });
    if (!ok) return;
    const res = await deleteW119(r.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  function actions(r: Report) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        <a href={`/supplies/w119/${r.id}/pdf`} target="_blank" rel="noreferrer" title="พิมพ์บันทึกรายงาน" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          <span className="btn-label">พิมพ์บันทึก</span>
        </a>
        <ProcurementPhotosButton kind="w119" requestId={r.id} count={r.proc_w119_photos?.length ?? 0} canEdit={isProcStaff} onChanged={reload} />
        <a href={`/supplies/w119/${r.id}/pdf?sheet=evidence`} target="_blank" rel="noreferrer" title="ใบติดหลักฐาน" className="btn-secondary btn-sm">
          <FileTextIcon className="h-3.5 w-3.5" />
          <span className="btn-label">ใบติดหลักฐาน</span>
        </a>
        {isProcStaff && <W119Modal report={r} lookups={lookups} suggestedNo="" onSaved={reload} />}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(r)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  const lateBadge = <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">รายงานเกิน 5 วันทำการ</span>;
  const itemSummary = (r: Report) => r.proc_w119_items.map((i) => i.name).join(", ");
  const vendorSummary = (r: Report) => [...new Set(r.proc_w119_items.map((i) => i.vendor).filter(Boolean))].join(", ") || "-";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ว.119 ค่าใช้จ่ายบริหารงาน</h1>
          <p className="page-subtitle">
            จัดซื้อจัดจ้างค่าใช้จ่ายบริหารงาน/ฝึกอบรม/จัดงาน/ประชุม ครั้งละไม่เกิน 10,000 บาท ซื้อไปก่อนแล้วรายงานภายใน 5 วันทำการ
            {fiscalYear ? ` · ปีงบประมาณ ${fiscalYear}` : ""}
          </p>
        </div>
        {isProcStaff && <W119Modal report={null} lookups={lookups} suggestedNo={nextDocNo} onSaved={reload} />}
      </div>

      {reports === null ? (
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
                placeholder="ค้นหาเลขที่ รายการ ผู้ขาย ผู้รับผิดชอบ"
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
              {visible.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.doc_no}</span>
                    <span className="text-sm text-slate-700">{itemSummary(r)}</span>
                    {isLate(r) && lateBadge}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{vendorSummary(r)}</p>
                  <p className="text-xs text-slate-500">
                    {r.expense_category} · {r.responsible_name ?? "ไม่ระบุผู้รับผิดชอบ"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    ซื้อ/จ้าง {formatThaiDate(r.purchase_date)} · รายงาน {formatThaiDate(r.record_date)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatBaht(r.amount)} บาท</p>
                  <div className="mt-2">{actions(r)}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}</p>}
            </div>

            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่ซื้อ/จ้าง</th>
                  <th>วันที่รายงาน</th>
                  <th>รายการ</th>
                  <th>ผู้ขาย/ผู้รับจ้าง</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.doc_no}</td>
                    <td>{formatThaiDate(r.purchase_date)}</td>
                    <td>
                      <div>{formatThaiDate(r.record_date)}</div>
                      {isLate(r) && <div className="mt-1 [&>span]:text-sm">{lateBadge}</div>}
                    </td>
                    <td>
                      <div>{itemSummary(r)}</div>
                      <div className="text-sm text-slate-500">{r.expense_category}</div>
                    </td>
                    <td>{vendorSummary(r)}</td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(r.amount)}</td>
                    <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(r)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > shown && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="btn-secondary">
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
