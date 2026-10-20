"use client";

// สัญญาการยืมเงิน — ทะเบียนคุมสัญญายืมเงิน + บันทึกการส่งใช้ ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2562 หมวด 5
// (กำหนดส่งใช้/ข้อห้ามยืมรายใหม่ อยู่ใน src/lib/loan.ts) — งานซื้อ/จ้างที่ชำระด้วยเงินยืมอ้างเลขที่สัญญาจากที่นี่

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { isOverdue, LOAN_DUE_DAYS, LOAN_TYPE_LABEL, loanBalance, parseLoanType, type LoanItem, type LoanRepayment, type LoanType } from "@/lib/loan";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { CoinsIcon, PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { addRepayment, deleteLoan, deleteRepayment, saveLoan } from "./actions";

type Loan = {
  id: string;
  doc_no: string | null;
  request_date: string;
  borrower_name: string;
  borrower_position: string | null;
  fund_source: string | null;
  purpose: string;
  loan_type: string;
  travel_return_date: string | null;
  items: LoanItem[];
  amount: number;
  due_days: number;
  received_date: string | null;
  due_date: string | null;
  checker_name: string | null;
  approver_name: string | null;
  note: string | null;
  proc_loan_repayments: LoanRepayment[];
};
type Lookups = { teachers: string[]; positions: Record<string, string> };

const FUND_SOURCES = ["เงินอุดหนุนรายหัว", "เงินอุดหนุนกิจกรรมพัฒนาผู้เรียน", "เงินรายได้สถานศึกษา", "เงินงบประมาณ", "เงินนอกงบประมาณ"];
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LoanForm({ loan, lookups, onSaved }: { loan?: Loan; lookups: Lookups; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const { role } = useAuth();
  const [loanType, setLoanType] = useState<LoanType>(parseLoanType(loan?.loan_type));
  const [dueDays, setDueDays] = useState(String(loan?.due_days ?? LOAN_DUE_DAYS.other));
  const [position, setPosition] = useState(loan?.borrower_position ?? "");
  const [items, setItems] = useState<{ detail: string; amount: string }[]>(
    loan?.items?.length ? loan.items.map((i) => ({ detail: i.detail, amount: String(i.amount) })) : [{ detail: "", amount: "" }],
  );
  const [saving, setSaving] = useState(false);
  const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("items_json", JSON.stringify(items));
    setSaving(true);
    try {
      const res = await saveLoan(loan?.id ?? null, fd);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess(loan ? "บันทึกแล้ว" : `บันทึกสัญญาแล้ว${res.docNo ? ` เลขที่ ${res.docNo}` : ""}`);
      ref.current?.close();
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
      title={loan ? `แก้ไขสัญญาการยืมเงิน ${loan.doc_no ?? ""}` : "ทำสัญญาการยืมเงิน"}
      wide
      lazy
      trigger={
        loan ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            <span className="btn-label">แก้ไข</span>
          </span>
        ) : (
          <span className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            ทำสัญญายืมเงิน
          </span>
        )
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">สัญญาเลขที่</label>
          {role === "admin" ? (
            <input name="doc_no" defaultValue={loan?.doc_no ?? ""} placeholder="ว่างไว้ = ออกเลขอัตโนมัติ" className="input w-full" />
          ) : (
            <input value={loan?.doc_no ?? "ออกเลขอัตโนมัติตอนบันทึก"} disabled className="input w-full" />
          )}
        </div>
        <div>
          <label className="label">
            วันที่ยื่นสัญญา <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker name="request_date" defaultValue={loan?.request_date ?? new Date().toISOString().slice(0, 10)} required />
        </div>
        <div>
          <label className="label">
            ชื่อผู้ยืม <span className="text-red-600">*</span>
          </label>
          <input
            name="borrower_name"
            list="loan-teachers"
            defaultValue={loan?.borrower_name ?? ""}
            onChange={(e) => {
              const p = lookups.positions[e.target.value.trim()];
              if (p) setPosition(p);
            }}
            required
            className="input w-full"
          />
          <datalist id="loan-teachers">
            {lookups.teachers.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">ตำแหน่ง</label>
          <input name="borrower_position" value={position} onChange={(e) => setPosition(e.target.value)} className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">ขอยืมเงินจาก (ประเภทเงิน)</label>
          <input name="fund_source" list="loan-funds" defaultValue={loan?.fund_source ?? ""} placeholder="เช่น เงินอุดหนุนรายหัว" className="input w-full" />
          <datalist id="loan-funds">
            {FUND_SOURCES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            เพื่อเป็นค่าใช้จ่ายในการ <span className="text-red-600">*</span>
          </label>
          <input name="purpose" defaultValue={loan?.purpose ?? ""} required placeholder="เช่น จัดซื้อวัสดุโครงการพัฒนาห้องสมุด" className="input w-full" />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">รายละเอียด</legend>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={it.detail}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))}
                  placeholder={`รายการที่ ${i + 1}`}
                  className="input min-w-0 flex-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.amount}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  placeholder="จำนวนเงิน"
                  className="input w-32 text-right"
                />
                <button type="button" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [{ detail: "", amount: "" }])} title="ลบรายการ" className="btn-danger btn-sm">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" onClick={() => setItems([...items, { detail: "", amount: "" }])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </button>
            <span className="text-sm">
              รวม <b className="tabular-nums">{baht(total)}</b> บาท
            </span>
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <label className="label">ลักษณะการยืม (กำหนดส่งใช้ ตามระเบียบฯ ข้อ 65)</label>
          <select
            name="loan_type"
            value={loanType}
            onChange={(e) => {
              const v = parseLoanType(e.target.value);
              setLoanType(v);
              setDueDays(String(LOAN_DUE_DAYS[v]));
            }}
            className="input w-full"
          >
            {(Object.keys(LOAN_TYPE_LABEL) as LoanType[]).map((k) => (
              <option key={k} value={k}>
                {LOAN_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ส่งใช้ภายใน (วัน)</label>
          <input name="due_days" type="number" min="1" value={dueDays} onChange={(e) => setDueDays(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="label">วันที่ได้รับเงินยืม</label>
          <ThaiDatePicker name="received_date" defaultValue={loan?.received_date ?? null} />
          <p className="mt-1 text-xs text-slate-500">กรอกเมื่อจ่ายเงินแล้ว — ระบบคำนวณวันครบกำหนดให้</p>
        </div>
        {loanType === "travel" && (
          <div>
            <label className="label">วันที่กลับมาถึง (เดินทางไปราชการ)</label>
            <ThaiDatePicker name="travel_return_date" defaultValue={loan?.travel_return_date ?? null} />
          </div>
        )}
        <div>
          <label className="label">ผู้ตรวจสอบ (เจ้าหน้าที่การเงิน)</label>
          <input name="checker_name" list="loan-teachers" defaultValue={loan?.checker_name ?? ""} placeholder="ว่างไว้ = ตามค่าตั้งระบบ" className="input w-full" />
        </div>
        <div>
          <label className="label">ผู้อนุมัติ</label>
          <input name="approver_name" list="loan-teachers" defaultValue={loan?.approver_name ?? ""} placeholder="ว่างไว้ = ผู้อำนวยการ (ค่าตั้งระบบ)" className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">หมายเหตุ</label>
          <input name="note" defaultValue={loan?.note ?? ""} className="input w-full" />
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

function RepayModal({ loan, canEdit, onSaved }: { loan: Loan; canEdit: boolean; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { outstanding } = loanBalance(loan.amount, loan.proc_loan_repayments);
  const reps = [...loan.proc_loan_repayments].sort((a, b) => a.repay_date.localeCompare(b.repay_date));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await addRepayment(loan.id, new FormData(e.currentTarget));
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("บันทึกการส่งใช้แล้ว");
      setFormKey((k) => k + 1);
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  async function remove(r: LoanRepayment) {
    if (!(await confirmDelete({ title: "ลบรายการส่งใช้นี้?" }))) return;
    const res = await deleteRepayment(r.id);
    if (res.error) return void (await toastError(res.error));
    onSaved();
  }

  return (
    <Modal
      title={`ส่งใช้เงินยืม — สัญญาเลขที่ ${loan.doc_no ?? "-"}`}
      lazy
      trigger={
        <span title="ส่งใช้เงินยืม" className="btn-secondary btn-sm">
          <CoinsIcon className="h-3.5 w-3.5" />
          <span className="btn-label">ส่งใช้</span>
        </span>
      }
    >
      <p className="mb-2 text-xs text-slate-500">
        บันทึกที่นี่แล้วเขียนเติมในตารางด้านหลังของสัญญาตัวจริงด้วยมือ (ระเบียบฯ ข้อ 66) — พิมพ์ใบรับใบสำคัญให้ผู้ยืมได้ทีละครั้ง
      </p>
      <p className="mb-3 text-sm text-slate-600">
        ยืม <b>{baht(loan.amount)}</b> บาท · คงค้าง <b className={outstanding > 0 ? "text-red-600" : "text-emerald-700"}>{baht(outstanding)}</b> บาท
        {loan.due_date && <> · ครบกำหนด {formatThaiDate(loan.due_date)}</>}
      </p>
      <table className="table-base mb-4 w-full">
        <thead>
          <tr>
            <th>ครั้งที่</th>
            <th>วันที่</th>
            <th className="text-right">ใบสำคัญ</th>
            <th className="text-right">เงินสด</th>
            <th>ใบรับเลขที่</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reps.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td className="whitespace-nowrap">{formatThaiDate(r.repay_date)}</td>
              <td className="text-right tabular-nums">{baht(Number(r.voucher_amount))}</td>
              <td className="text-right tabular-nums">{baht(Number(r.cash_amount))}</td>
              <td>{r.receipt_no ?? "-"}</td>
              <td className="whitespace-nowrap text-right">
                <div className="flex justify-end gap-1">
                  <a href={`/finance/loans/${loan.id}/receipt/${r.id}`} target="_blank" rel="noreferrer" title="พิมพ์ใบรับใบสำคัญ" className="btn-secondary btn-sm">
                    <PrinterIcon className="h-3.5 w-3.5" />
                    ใบรับ
                  </a>
                  {canEdit && (
                    <button type="button" onClick={() => remove(r)} title="ลบ" className="btn-danger btn-sm">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {reps.length === 0 && (
            <tr>
              <td colSpan={6} className="table-empty">
                ยังไม่มีการส่งใช้
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {reps.length > 0 && (
        <a href={`/finance/loans/${loan.id}/pdf?view=summary`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mb-4">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์สรุปรายการส่งใช้ (ตรวจทาน/แนบเรื่อง)
        </a>
      )}
      {canEdit && outstanding > 0 && (
        <form key={formKey} onSubmit={submit} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <label className="label">
              วันที่ส่งใช้ <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="repay_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <label className="label">ใบรับใบสำคัญ เลขที่</label>
            <input name="receipt_no" className="input w-full" />
          </div>
          <div>
            <label className="label">ใบสำคัญคู่จ่าย (บาท)</label>
            <input name="voucher_amount" type="number" min="0" step="0.01" defaultValue={outstanding} className="input w-full text-right" />
          </div>
          <div>
            <label className="label">จำนวนใบสำคัญ (ฉบับ)</label>
            <input name="voucher_count" type="number" min="0" step="1" className="input w-full text-right" />
          </div>
          <div>
            <label className="label">เงินสดเหลือจ่ายคืน (บาท)</label>
            <input name="cash_amount" type="number" min="0" step="0.01" defaultValue="" className="input w-full text-right" />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input name="note" className="input w-full" />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "กำลังบันทึก..." : "บันทึกการส่งใช้"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function LoansPage() {
  const { isProcStaff } = useAuth();
  const [rows, setRows] = useState<Loan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "cleared">("open");
  const [lookups, setLookups] = useState<Lookups>({ teachers: [], positions: {} });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data, error }, { data: teachers }, { data: positions }] = await Promise.all([
      supabase.from("proc_loan_contracts").select("*, proc_loan_repayments(*)").order("request_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_teacher_positions").select("teacher_name, position"),
    ]);
    setError(error?.message ?? null);
    setRows(((data ?? []) as unknown as Loan[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    setLookups({ teachers: (teachers ?? []).map((t) => t.name), positions: Object.fromEntries((positions ?? []).map((p) => [p.teacher_name, p.position])) });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const withStatus = useMemo(
    () =>
      (rows ?? []).map((r) => {
        const b = loanBalance(r.amount, r.proc_loan_repayments);
        return { ...r, ...b, overdue: isOverdue(r.due_date, b.cleared) };
      }),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStatus.filter(
      (r) =>
        (filter === "all" || (filter === "open" && !r.cleared) || (filter === "overdue" && r.overdue) || (filter === "cleared" && r.cleared)) &&
        (!q || [r.doc_no, r.borrower_name, r.purpose].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [withStatus, query, filter]);
  const totalOutstanding = withStatus.reduce((s, r) => s + r.outstanding, 0);
  const overdueCount = withStatus.filter((r) => r.overdue).length;

  async function remove(r: Loan) {
    if (!(await confirmDelete({ title: `ลบสัญญาเลขที่ ${r.doc_no ?? ""}?`, text: "รายการส่งใช้ของสัญญานี้จะถูกลบด้วย" }))) return;
    const res = await deleteLoan(r.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }

  function statusBadge(r: (typeof withStatus)[number]) {
    if (r.cleared) return <span className="badge-emerald !text-sm">ส่งใช้ครบแล้ว</span>;
    if (r.overdue) return <span className="badge-red !text-sm">เกินกำหนด</span>;
    if (!r.received_date) return <span className="badge-slate !text-sm">รอรับเงิน</span>;
    return <span className="badge-amber !text-sm">ค้างส่งใช้</span>;
  }

  function actions(r: Loan) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        <a href={`/finance/loans/${r.id}/pdf`} target="_blank" rel="noreferrer" title="พิมพ์สัญญา (หน้า-หลัง)" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          <span className="btn-label">พิมพ์</span>
        </a>
        <RepayModal loan={r} canEdit={isProcStaff} onSaved={reload} />
        {isProcStaff && <LoanForm loan={r} lookups={lookups} onSaved={reload} />}
        {isProcStaff && (
          <button type="button" onClick={() => remove(r)} title="ลบ" className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            <span className="btn-label">ลบ</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">สัญญาการยืมเงิน</h1>
          <p className="page-subtitle">ทะเบียนคุมเงินยืมและการส่งใช้ ตามระเบียบกระทรวงการคลังว่าด้วยการเบิกเงินจากคลังฯ พ.ศ. 2562 หมวด 5</p>
        </div>
        {isProcStaff && <LoanForm lookups={lookups} onSaved={reload} />}
      </div>
      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่ ผู้ยืม วัตถุประสงค์" className="input w-full pl-9" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="input w-auto">
              <option value="open">ยังส่งใช้ไม่ครบ</option>
              <option value="overdue">เกินกำหนดส่งใช้</option>
              <option value="cleared">ส่งใช้ครบแล้ว</option>
              <option value="all">ทั้งหมด</option>
            </select>
            <p className="text-sm text-slate-600">
              คงค้างรวม <b className="tabular-nums">{baht(totalOutstanding)}</b> บาท
              {overdueCount > 0 && <span className="ml-2 font-semibold text-red-600">· เกินกำหนด {overdueCount} สัญญา</span>}
            </p>
          </div>
          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.doc_no ?? "-"}</span>
                    <span className="text-sm text-slate-500">{formatThaiDate(r.request_date)}</span>
                    {statusBadge(r)}
                  </div>
                  <p className="text-sm text-slate-700">
                    {r.borrower_name} · {baht(r.amount)} บาท
                  </p>
                  <p className="text-xs text-slate-500">{r.purpose}</p>
                  <p className="text-xs text-slate-500">
                    คงค้าง {baht(r.outstanding)} บาท{r.due_date ? ` · ครบกำหนด ${formatThaiDate(r.due_date)}` : ""}
                  </p>
                  <div className="mt-2">{actions(r)}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">ไม่มีสัญญาการยืมเงิน</p>}
            </div>
            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่</th>
                  <th>ผู้ยืม</th>
                  <th>เพื่อ</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th className="text-right">คงค้าง</th>
                  <th>ครบกำหนด</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                    <td className="whitespace-nowrap">{formatThaiDate(r.request_date)}</td>
                    <td>{r.borrower_name}</td>
                    <td>{r.purpose}</td>
                    <td className="text-right tabular-nums">{baht(r.amount)}</td>
                    <td className="text-right tabular-nums">{baht(r.outstanding)}</td>
                    <td className="whitespace-nowrap">{r.due_date ? formatThaiDate(r.due_date) : "-"}</td>
                    <td className="whitespace-nowrap">{statusBadge(r)}</td>
                    <td className="whitespace-nowrap text-right [&_.btn-label]:sr-only [&_.btn-sm]:px-2">{actions(r)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-empty">
                      ไม่มีสัญญาการยืมเงิน
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
