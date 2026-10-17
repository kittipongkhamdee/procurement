"use client";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) — ผู้ได้รับมอบหมายซื้อ/จ้างไปก่อนเพราะเหตุจำเป็นเร่งด่วน แล้วรายงานขอความเห็นชอบ
// ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 79 วรรคสอง ประกอบหนังสือ กค (กวจ) 0405.2/ว 119 — แบบบันทึก "รายงานขอซื้อ/จ้าง"
// ครูทุกคนเพิ่มบันทึกได้ แก้ไขได้เฉพาะรายการของตัวเอง (เจ้าหน้าที่แก้ได้ทุกรายการ) ลบได้เฉพาะแอดมิน

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ApprovalRefField, approvalRemaining, loadApprovalRefs, type ApprovalRefOption } from "@/components/approval-ref-field";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { DOC_NUMBER_KINDS, docNumberTemplate, nextDocNumber } from "@/lib/doc-numbers";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { DocNoField } from "@/components/doc-no-field";
import { ReceiptTypeSelect } from "@/components/receipt-type-select";
import { PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { urgentKindLabel } from "@/lib/pdf/urgent-document";
import { createUrgent, deleteUrgent, updateUrgent, type UrgentItemInput } from "./urgent-actions";

type Report = {
  id: string;
  created_by: string | null;
  approval_id: string | null;
  doc_no: string | null;
  doc_type: string;
  record_date: string;
  purchase_date: string;
  subject: string;
  reason: string | null;
  work_text: string;
  amount: number;
  payee: string | null;
  receipt_type: string | null;
  receipt_book: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  admin_group: string | null;
  project_id: string | null;
  activity_id: string | null;
  proc_urgent_items: { kind: string; name: string; amount: number; seq: number }[];
};
type Option = { id: string; name: string };
type Activity = { id: string; name: string | null; project_id: string };
type Lookups = {
  projects: Option[];
  activities: Activity[];
  groups: Option[];
  teachers: string[];
  positions: Record<string, string>;
  vendors: string[];
  approvals: ApprovalRefOption[];
};

const PAGE_SIZE = 20;

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EMPTY_ITEM: UrgentItemInput = { kind: "ซื้อ", name: "", amount: "" };
const kindOf = (r: Report) => urgentKindLabel(r.proc_urgent_items);

function UrgentModal({ report, lookups, suggestedNo, onSaved }: { report: Report | null; lookups: Lookups; suggestedNo: string; onSaved: () => void }) {
  const { isAdmin } = useAuth();
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  const [approvalId, setApprovalId] = useState(report?.approval_id ?? "");
  const [projectId, setProjectId] = useState(report?.project_id ?? "");
  const [activityId, setActivityId] = useState(report?.activity_id ?? "");
  const [purchaseDate, setPurchaseDate] = useState<string | null>(report?.purchase_date ?? null);
  const [recordDate, setRecordDate] = useState<string | null>(report?.record_date ?? null);
  const [responsible, setResponsible] = useState(report?.responsible_name ?? "");
  const [position, setPosition] = useState(report?.responsible_position ?? "");
  const [items, setItems] = useState<UrgentItemInput[]>(
    report?.proc_urgent_items.length ? report.proc_urgent_items.map((i) => ({ kind: i.kind, name: i.name, amount: String(i.amount) })) : [{ ...EMPTY_ITEM }],
  );
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const kindLabel = urgentKindLabel(items.filter((i) => i.name.trim()).map((i) => ({ ...i, amount: 0 })));
  const setItem = (idx: number, patch: Partial<UrgentItemInput>) => setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const remaining = approvalRemaining(lookups.approvals.find((a) => a.id === approvalId) ?? null, report ? { approvalId: report.approval_id, amount: report.amount } : undefined);
    if (remaining != null && total > remaining + 0.005) return void (await toastError(`ยอดเงินเกินวงเงินคงเหลือของบันทึกขออนุมัติ (${formatBaht(remaining)} บาท)`));
    const formData = new FormData(form);
    formData.set("items_json", JSON.stringify(items.filter((i) => i.name.trim())));
    setSaving(true);
    try {
      const res = report ? await updateUrgent(report.id, formData) : await createUrgent(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!report) {
        form.reset();
        setApprovalId("");
        setPurchaseDate(null);
        setRecordDate(null);
        setItems([{ ...EMPTY_ITEM }]);
      }
      await toastSuccess(report ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : res.docNo ? `บันทึกเรียบร้อยแล้ว — เลขที่ ${res.docNo}` : "บันทึกเรียบร้อยแล้ว");
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
      title={report ? `แก้ไขรายงานขอ${kindOf(report)} (เร่งด่วน) ${report.doc_no ?? ""}` : "บันทึกจัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน)"}
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
            บันทึกจัดซื้อ/จัดจ้าง
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
            own={report ? { approvalId: report.approval_id, amount: report.amount } : undefined}
            onChange={(a, id) => {
              setApprovalId(id);
              // ดึงโครงการ/กิจกรรมจากบันทึกขออนุมัติมาเป็นค่าเริ่มต้น (แก้ได้)
              if (a?.project_id) {
                setProjectId(a.project_id);
                setActivityId(lookups.activities.find((x) => x.project_id === a.project_id && x.name === a.activity_name)?.id ?? "");
              }
            }}
          />
          <DocNoField current={report ? report.doc_no : undefined} suggested={suggestedNo} isAdmin={isAdmin} />
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
          <div className="sm:col-span-2">
            <label className="label">
              เรื่อง: รายงานขอ{kindLabel} … กรณีมีความจำเป็นเร่งด่วน <span className="text-red-600">*</span>
            </label>
            <input name="subject" defaultValue={report?.subject ?? ""} required placeholder="เช่น วัสดุ และจ้างจัดทำป้ายไวนิล" className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ด้วย (ที่มา/เหตุผลความจำเป็นเร่งด่วน)</label>
            <textarea
              name="reason"
              defaultValue={report?.reason ?? ""}
              rows={3}
              placeholder="เช่น สำนักงานเขตพื้นที่การศึกษาฯ ได้แจ้งขอความร่วมมือโรงเรียนดำเนินการรณรงค์การเลือกตั้ง"
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">
              ข้าพเจ้า (ผู้ดำเนินการ) <span className="text-red-600">*</span>
            </label>
            <input
              name="responsible_name"
              list="urgent-teachers"
              value={responsible}
              required
              onChange={(e) => {
                setResponsible(e.target.value);
                const p = lookups.positions[e.target.value];
                if (p) setPosition(p);
              }}
              className="input w-full"
            />
            <datalist id="urgent-teachers">
              {lookups.teachers.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ตำแหน่ง</label>
            <input name="responsible_position" value={position} onChange={(e) => setPosition(e.target.value)} className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ได้ดำเนินการ (ภาพรวม)</label>
            <input name="work_text" defaultValue={report?.work_text ?? ""} placeholder="ไม่กรอก = ใช้ชื่อรายการด้านล่าง เช่น จัดซื้อวัสดุ และจ้างจัดทำป้ายไวนิล" className="input w-full" />
          </div>
          <div>
            <label className="label">
              วันที่ดำเนินการ (ซื้อ/จ้าง) <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="purchase_date" value={purchaseDate} onChange={setPurchaseDate} />
          </div>
          <div>
            <label className="label">
              วันที่รายงาน (บันทึกข้อความ) <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="record_date" value={recordDate} onChange={setRecordDate} />
          </div>
          <div>
            <label className="label">เบิกจ่ายให้แก่</label>
            <input name="payee" list="urgent-vendors" defaultValue={report?.payee ?? ""} placeholder="ชื่อผู้ขาย/ผู้รับจ้าง หรือผู้รับเงิน" className="input w-full" />
            <p className="mt-1 text-xs text-slate-500">ถ้าเว้นว่าง ระบบจะใช้ชื่อผู้ดำเนินการ (ข้าพเจ้า) เป็นผู้รับเงิน</p>
            <datalist id="urgent-vendors">
              {lookups.vendors.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="label">หลักฐานการรับเงิน</label>
              <ReceiptTypeSelect defaultValue={report?.receipt_type} />
            </div>
            <div>
              <label className="label">เล่มที่</label>
              <input name="receipt_book" defaultValue={report?.receipt_book ?? ""} className="input w-full" />
            </div>
            <div>
              <label className="label">เลขที่</label>
              <input name="receipt_no" defaultValue={report?.receipt_no ?? ""} className="input w-full" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">ลงวันที่</label>
              <ThaiDatePicker name="receipt_date" defaultValue={report?.receipt_date ?? null} />
            </div>
            <p className="col-span-2 -mt-1 text-xs text-slate-500 sm:col-span-3">เล่มที่/เลขที่/ลงวันที่ ไม่บังคับ — ถ้าไม่กรอก ในบันทึกจะเขียนว่า &quot;รายละเอียดตามเอกสาร(หลักฐานที่เลือก)ที่แนบมาพร้อมนี้&quot; · งานจ้างบุคคลทั่วไปที่ไม่มีใบเสร็จ ใช้ใบสำคัญรับเงิน (แนบสำเนาบัตรประชาชนผู้รับเงิน)</p>
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
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">จึงได้ดำเนินการดังนี้</legend>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_7rem_1fr_9rem_auto] sm:items-center">
                <span className="pt-2 text-sm text-slate-500 sm:pt-0">{idx + 1}.</span>
                <select value={it.kind} onChange={(e) => setItem(idx, { kind: e.target.value })} className="input w-full" aria-label="ประเภท">
                  <option value="ซื้อ">ซื้อ</option>
                  <option value="จ้าง">จ้าง</option>
                </select>
                <input
                  value={it.name}
                  onChange={(e) => setItem(idx, { name: e.target.value })}
                  placeholder={it.kind === "จ้าง" ? "เช่น จัดทำป้ายไวนิล" : "เช่น วัสดุ"}
                  className="input w-full max-sm:col-start-2"
                  aria-label="รายการ"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => setItem(idx, { amount: e.target.value })}
                  placeholder="จำนวนเงิน"
                  className="input w-full text-right max-sm:col-start-2"
                  aria-label="จำนวนเงิน"
                />
                <button
                  type="button"
                  onClick={() => setItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : [{ ...EMPTY_ITEM }]))}
                  className="btn-danger btn-sm max-sm:col-start-2 max-sm:justify-self-start"
                  title="ลบรายการ"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </button>
            <p className="text-sm text-slate-600">
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

function DetailModal({ report: r, approvals }: { report: Report; approvals: ApprovalRefOption[] }) {
  const ap = approvals.find((a) => a.id === r.approval_id);
  const rows: [string, string][] = [
    ["เลขที่", r.doc_no ?? "-"],
    ["อ้างอิงบันทึกขออนุมัติ", ap ? `${ap.doc_number ?? "(ไม่มีเลขที่)"} · ${ap.activity_name || ap.subject} (${ap.status})` : "-"],
    ["เรื่อง", `รายงานขอ${kindOf(r)}${r.subject} กรณีมีความจำเป็นเร่งด่วน`],
    ["เหตุผลความจำเป็นเร่งด่วน", r.reason ?? "-"],
    ["ได้ดำเนินการ", r.work_text],
    ["รายการ", r.proc_urgent_items.map((i, n) => `${n + 1}. ${i.kind}${i.name} ${formatBaht(i.amount)} บาท`).join("\n") || "-"],
    ["วันที่ดำเนินการ", formatThaiDate(r.purchase_date)],
    ["วันที่รายงาน", formatThaiDate(r.record_date)],
    ["ผู้ดำเนินการ", [r.responsible_name, r.responsible_position].filter(Boolean).join(" · ") || "-"],
    ["เบิกจ่ายให้แก่", r.payee ?? `${r.responsible_name ?? "-"} (ผู้ดำเนินการ)`],
    ["หลักฐานการรับเงิน", [r.receipt_type || "ใบเสร็จรับเงิน", r.receipt_book && `เล่มที่ ${r.receipt_book}`, r.receipt_no && `เลขที่ ${r.receipt_no}`, r.receipt_date && `ลว. ${formatThaiDate(r.receipt_date)}`].filter(Boolean).join(" ") || "-"],
    ["กลุ่มสาระ/ฝ่าย", r.admin_group ?? "-"],
    ["จำนวนเงิน", `${formatBaht(r.amount)} บาท`],
  ];
  return (
    <Modal
      title={`รายงานขอ${kindOf(r)} (เร่งด่วน) ${r.doc_no ?? ""}`}
      wide
      lazy
      trigger={
        <span title="รายละเอียด" className="btn-secondary btn-sm">
          <SearchIcon className="h-3.5 w-3.5" />
          <span className="btn-label">รายละเอียด</span>
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
    </Modal>
  );
}

export default function UrgentPage() {
  const { user, isAdmin, isProcStaff } = useAuth();
  // ครูทุกคนเพิ่มบันทึกได้ และแก้ไขได้เฉพาะรายการที่ตัวเองสร้าง (เจ้าหน้าที่พัสดุ/การเงินแก้ได้ทุกรายการ)
  const canEdit = (x: { created_by: string | null }) => isProcStaff || (!!user && x.created_by === user.userId);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [allDocNos, setAllDocNos] = useState<string[]>([]);
  const [numberFormats, setNumberFormats] = useState<Record<string, string>>({});
  const [lookups, setLookups] = useState<Lookups>({ projects: [], activities: [], groups: [], teachers: [], positions: {}, vendors: [], approvals: [] });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    setFiscalYear(currentYear?.year ?? null);
    let listQuery = supabase
      .from("proc_urgent_reports")
      .select(
        "id, created_by, approval_id, doc_no, doc_type, record_date, purchase_date, subject, reason, work_text, amount, payee, receipt_type, receipt_book, receipt_no, receipt_date, responsible_name, responsible_position, admin_group, project_id, activity_id, proc_urgent_items(kind, name, amount, seq)",
      );
    if (currentYear) {
      const ce = currentYear.year - 543;
      listQuery = listQuery.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
    }
    const [{ data, error }, { data: nos }, { data: projects }, { data: activities }, { data: groups }, { data: teachers }, { data: positions }, { data: vendors }, { data: formats }, approvalRefs] =
      await Promise.all([
        listQuery.order("record_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("proc_urgent_reports").select("doc_no"),
        currentYear ? supabase.from("plan_projects").select("id, name").eq("budget_year_id", currentYear.id).order("sort_order") : Promise.resolve({ data: [] as Option[] }),
        supabase.from("plan_activities").select("id, name, project_id").order("sort_order"),
        supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
        supabase.from("proc_teacher_positions").select("teacher_name, position"),
        supabase.from("proc_vendors").select("name").order("name"),
        supabase.from("proc_app_settings").select("key, value").in("key", DOC_NUMBER_KINDS.map((k) => k.key)),
        loadApprovalRefs(supabase, currentYear?.year ?? null),
      ]);
    setError(error?.message ?? null);
    setReports(
      (data ?? []).map((r) => ({
        ...r,
        amount: Number(r.amount),
        proc_urgent_items: [...r.proc_urgent_items].sort((a, b) => a.seq - b.seq).map((i) => ({ ...i, amount: Number(i.amount) })),
      })),
    );
    setAllDocNos((nos ?? []).map((r) => r.doc_no ?? "").filter(Boolean));
    setNumberFormats(Object.fromEntries((formats ?? []).map((f) => [f.key, f.value ?? ""])));
    setLookups({
      approvals: approvalRefs,
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

  const nextDocNo = useMemo(() => nextDocNumber(docNumberTemplate("urgent", numberFormats), fiscalYear, allDocNos), [allDocNos, fiscalYear, numberFormats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!reports || !q) return reports ?? [];
    return reports.filter((r) => [r.doc_no, r.subject, r.work_text, r.reason, r.payee, r.responsible_name].some((v) => v?.toLowerCase().includes(q)));
  }, [reports, query]);
  const visible = filtered.slice(0, shown);
  const total = filtered.reduce((s, r) => s + r.amount, 0);

  async function handleDelete(r: Report) {
    const ok = await confirmDelete({ title: `ลบรายงานขอ${kindOf(r)} ${r.doc_no ?? ""}?`, text: r.subject });
    if (!ok) return;
    const res = await deleteUrgent(r.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  // อ้างอิงบันทึกขออนุมัติที่ยังไม่อนุมัติ → ยังพิมพ์ไม่ได้
  const printable = (x: Report) => !x.approval_id || lookups.approvals.find((a) => a.id === x.approval_id)?.status === "อนุมัติ";

  function actions(r: Report) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        <DetailModal report={r} approvals={lookups.approvals} />
        {printable(r) ? (
          <a href={`/supplies/urgent/${r.id}/pdf`} target="_blank" rel="noreferrer" title="พิมพ์บันทึกรายงาน" className="btn-secondary btn-sm">
            <PrinterIcon className="h-3.5 w-3.5" />
            <span className="btn-label">พิมพ์บันทึก</span>
          </a>
        ) : (
          <span className="badge-amber !text-sm whitespace-nowrap">บันทึกขออนุมัติยังไม่อนุมัติ</span>
        )}
        {canEdit(r) && <UrgentModal report={r} lookups={lookups} suggestedNo="" onSaved={reload} />}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(r)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  const typeBadge = (r: Report) => <span className={`${kindOf(r) === "ซื้อ" ? "badge-slate" : "badge-amber"} !text-sm whitespace-nowrap`}>{kindOf(r).replace("ขอ", "")}</span>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน)</h1>
          <p className="page-subtitle">
            ซื้อ/จ้างไปก่อนเพราะเหตุจำเป็นเร่งด่วน แล้วรายงานขอความเห็นชอบ ตามระเบียบฯ พ.ศ. 2560 ข้อ 79 วรรคสอง
            {fiscalYear ? ` · ปีงบประมาณ ${fiscalYear}` : ""}
          </p>
        </div>
        {!!user && <UrgentModal report={null} lookups={lookups} suggestedNo={nextDocNo} onSaved={reload} />}
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
                placeholder="ค้นหาเลขที่ เรื่อง ผู้ขาย ผู้ดำเนินการ"
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
                    <span className="font-medium text-slate-900">{r.doc_no ?? "-"}</span>
                    {typeBadge(r)}
                    <span className="text-sm text-slate-700">{r.subject}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{r.payee ?? "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ดำเนินการ {formatThaiDate(r.purchase_date)} · รายงาน {formatThaiDate(r.record_date)} · {r.responsible_name ?? "-"}
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
                  <th>ประเภท</th>
                  <th>วันที่ดำเนินการ</th>
                  <th>วันที่รายงาน</th>
                  <th>เรื่อง</th>
                  <th>ผู้ขาย/ผู้รับจ้าง</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                    <td>{typeBadge(r)}</td>
                    <td>{formatThaiDate(r.purchase_date)}</td>
                    <td>{formatThaiDate(r.record_date)}</td>
                    <td>
                      <div>{r.subject}</div>
                      <div className="text-sm text-slate-500">{r.responsible_name ?? "-"}</div>
                    </td>
                    <td>{r.payee ?? "-"}</td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(r.amount)}</td>
                    <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(r)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">
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
