"use client";

// สัญญาการยืมเงิน — ทะเบียนคุมสัญญายืมเงิน + บันทึกการส่งใช้ ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2562 หมวด 5
// (กำหนดส่งใช้/ข้อห้ามยืมรายใหม่ อยู่ใน src/lib/loan.ts) — งานซื้อ/จ้างที่ชำระด้วยเงินยืมอ้างเลขที่สัญญาจากที่นี่

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { isOverdue, LOAN_DUE_RULE, LOAN_TYPE_LABEL, loanBalance, parseLoanType, type LoanItem, type LoanRepayment, type LoanType } from "@/lib/loan";
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
  project_id: string | null;
  activity_id: string | null;
  plan_projects: { name: string } | null;
  plan_activities: { name: string } | null;
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
  created_by: string | null;
  proc_loan_repayments: LoanRepayment[];
};
type Lookups = {
  teachers: string[];
  positions: Record<string, string>;
  /** โครงการปีงบปัจจุบัน + แหล่งเงิน (plan_budget_sources) ไว้เติม "ขอยืมเงินจาก" อัตโนมัติ */
  projects: { id: string; name: string; fund: string | null }[];
  activities: { id: string; name: string; project_id: string }[];
};

const FUND_SOURCES = ["เงินอุดหนุนรายหัว", "เงินอุดหนุนกิจกรรมพัฒนาผู้เรียน", "เงินรายได้สถานศึกษา", "เงินงบประมาณ", "เงินนอกงบประมาณ"];
/** วันนี้ตามเวลาเครื่อง (ISO) — ไม่ใช้ toISOString() ตรงๆ เพราะเป็นเวลา UTC (ก่อน 7 โมงเช้าจะได้วันก่อนหน้า) */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function LoanForm({ loan, lookups, onSaved }: { loan?: Loan; lookups: Lookups; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const { role, isProcStaff, displayName } = useAuth();
  const [loanType, setLoanType] = useState<LoanType>(parseLoanType(loan?.loan_type));
  const [position, setPosition] = useState(loan?.borrower_position ?? (isProcStaff ? "" : lookups.positions[displayName.trim()] ?? ""));
  const [projectId, setProjectId] = useState(loan?.project_id ?? "");
  const [activityId, setActivityId] = useState(loan?.activity_id ?? "");
  const [fund, setFund] = useState(loan?.fund_source ?? "");
  const projectOptions =
    loan?.project_id && !lookups.projects.some((p) => p.id === loan.project_id)
      ? [{ id: loan.project_id, name: loan.plan_projects?.name ?? "(โครงการปีก่อน)", fund: null }, ...lookups.projects]
      : lookups.projects;
  const activityOptions = lookups.activities.filter((a) => a.project_id === projectId);
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
            <input value={loan?.doc_no ?? (isProcStaff ? "ออกเลขอัตโนมัติตอนบันทึก" : "เจ้าหน้าที่การเงินออกเลขให้ตอนตรวจสอบ")} disabled className="input w-full" />
          )}
        </div>
        <div>
          <label className="label">
            วันที่ยื่นสัญญา <span className="text-red-600">*</span>
          </label>
          {/* ค่าเริ่มต้น = วันนี้; ผู้ยืม (ไม่ใช่เจ้าหน้าที่) เลือกย้อนหลังก่อนวันนี้ไม่ได้ — วันที่นี้พิมพ์เป็นวันที่ลงชื่อผู้ยืม */}
          <ThaiDatePicker
            name="request_date"
            defaultValue={loan?.request_date ?? todayLocal()}
            minDate={isProcStaff ? undefined : [todayLocal(), loan?.request_date ?? todayLocal()].sort()[0]}
            required
          />
        </div>
        <div>
          <label className="label">
            ชื่อผู้ยืม <span className="text-red-600">*</span>
          </label>
          {isProcStaff ? (
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
          ) : (
            // ครูยื่นได้เฉพาะในชื่อตัวเอง (ฝั่ง server ใช้ชื่อจากโปรไฟล์)
            <input value={loan?.borrower_name ?? displayName} disabled className="input w-full" />
          )}
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
        <div>
          <label className="label">โครงการ</label>
          <select
            name="project_id"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setActivityId("");
              const f = projectOptions.find((p) => p.id === e.target.value)?.fund;
              if (f) setFund(f);
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
            {loan?.activity_id && !activityOptions.some((a) => a.id === loan.activity_id) && loan.project_id === projectId && (
              <option value={loan.activity_id}>{loan.plan_activities?.name ?? "(กิจกรรมเดิม)"}</option>
            )}
            {activityOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">ขอยืมเงินจาก (ประเภทเงิน)</label>
          <input name="fund_source" list="loan-funds" value={fund} onChange={(e) => setFund(e.target.value)} placeholder="เลือกโครงการแล้วเติมให้อัตโนมัติ หรือพิมพ์เอง" className="input w-full" />
          <datalist id="loan-funds">
            {FUND_SOURCES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            เพื่อเป็นค่าใช้จ่ายในการ {!projectId && <span className="text-red-600">*</span>}
          </label>
          <input name="purpose" defaultValue={loan?.purpose ?? ""} required={!projectId} placeholder="เช่น จัดซื้อวัสดุ (ระบบต่อท้ายด้วยชื่อโครงการ/กิจกรรมที่เลือกให้)" className="input w-full" />
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
            }}
            className="input w-full"
          >
            {(Object.keys(LOAN_TYPE_LABEL) as LoanType[]).map((k) => (
              <option key={k} value={k}>
                {LOAN_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
          {/* จำนวนวันส่งใช้กำหนดตายตัวตามระเบียบ — ไม่ให้กรอกเอง */}
          <p className="mt-1 text-sm text-slate-600">{LOAN_DUE_RULE[loanType]}</p>
        </div>
        {isProcStaff && (
          <div>
            <label className="label">วันที่ได้รับเงินยืม</label>
            <ThaiDatePicker name="received_date" defaultValue={loan?.received_date ?? null} />
            <p className="mt-1 text-xs text-slate-500">กรอกเมื่อจ่ายเงินแล้ว — ระบบคำนวณวันครบกำหนดให้ (ครูแก้สัญญาไม่ได้หลังจากนี้)</p>
          </div>
        )}
        {loanType === "travel" && (
          <div>
            <label className="label">วันที่กลับมาถึง (เดินทางไปราชการ)</label>
            <ThaiDatePicker name="travel_return_date" defaultValue={loan?.travel_return_date ?? null} />
          </div>
        )}
        {isProcStaff && (
          <>
            <div>
              <label className="label">ผู้ตรวจสอบ (เจ้าหน้าที่การเงิน)</label>
              <input name="checker_name" list="loan-teachers" defaultValue={loan?.checker_name ?? ""} placeholder="ว่างไว้ = ตามค่าตั้งระบบ" className="input w-full" />
            </div>
            <div>
              <label className="label">ผู้อนุมัติ</label>
              <input name="approver_name" list="loan-teachers" defaultValue={loan?.approver_name ?? ""} placeholder="ว่างไว้ = ผู้อำนวยการ (ค่าตั้งระบบ)" className="input w-full" />
            </div>
          </>
        )}
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

function RepayModal({ loan, canEdit, canPrint, onSaved }: { loan: Loan; canEdit: boolean; canPrint: boolean; onSaved: () => void }) {
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
                  {canPrint && (
                    <a href={`/finance/loans/${loan.id}/receipt/${r.id}`} target="_blank" rel="noreferrer" title="พิมพ์ใบรับใบสำคัญ" className="btn-secondary btn-sm">
                      <PrinterIcon className="h-3.5 w-3.5" />
                      ใบรับ
                    </a>
                  )}
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
      {canPrint && reps.length > 0 && (
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

function loanPurpose(r: Pick<Loan, "purpose" | "plan_projects" | "plan_activities">) {
  return [r.purpose, r.plan_projects && `โครงการ${r.plan_projects.name.replace(/^โครงการ\s*/, "")}`, r.plan_activities?.name && `กิจกรรม${r.plan_activities.name.replace(/^กิจกรรม\s*/, "")}`].filter(Boolean).join(" ");
}

export default function LoansPage() {
  const { isProcStaff, user, role } = useAuth();
  // ครูแก้/ลบได้เฉพาะสัญญาที่ตัวเองยื่นและการเงินยังไม่จ่ายเงิน (ตรงกับ RLS)
  const canEditLoan = (r: Loan) => isProcStaff || (r.created_by === user?.userId && !r.received_date);
  // พิมพ์: เจ้าหน้าที่/ผู้บริหารทุกสัญญา ครูเฉพาะของตัวเอง (ตรงกับ build-loan-pdf)
  const canPrint = (r: Loan) => isProcStaff || role === "director" || role === "deputy_director" || r.created_by === user?.userId;
  const [rows, setRows] = useState<Loan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "cleared">("open");
  const [mineOnly, setMineOnly] = useState(false);
  const [lookups, setLookups] = useState<Lookups>({ teachers: [], positions: {}, projects: [], activities: [] });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const [{ data, error }, { data: teachers }, { data: positions }, { data: projects }] = await Promise.all([
      supabase.from("proc_loan_contracts").select("*, proc_loan_repayments(*), plan_projects(name), plan_activities(name)").order("request_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_teacher_positions").select("teacher_name, position"),
      currentYear
        ? supabase.from("plan_projects").select("id, name, plan_budget_sources(name), plan_activities(id, name, sort_order)").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] }),
    ]);
    setError(error?.message ?? null);
    setRows(((data ?? []) as unknown as Loan[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    type P = { id: string; name: string; plan_budget_sources: { name: string } | null; plan_activities: { id: string; name: string | null; sort_order: number }[] };
    const ps = (projects ?? []) as unknown as P[];
    setLookups({
      teachers: (teachers ?? []).map((t) => t.name),
      positions: Object.fromEntries((positions ?? []).map((p) => [p.teacher_name, p.position])),
      projects: ps.map((p) => ({ id: p.id, name: p.name, fund: p.plan_budget_sources?.name ?? null })),
      activities: ps.flatMap((p) => [...p.plan_activities].sort((a, b) => a.sort_order - b.sort_order).filter((a) => a.name).map((a) => ({ id: a.id, name: a.name!, project_id: p.id }))),
    });
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
        (!mineOnly || r.created_by === user?.userId) &&
        (!q || [r.doc_no, r.borrower_name, r.purpose, r.plan_projects?.name].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [withStatus, query, filter, mineOnly, user?.userId]);
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
    if (!r.received_date) return <span className="badge-slate !text-sm">{r.doc_no ? "รอรับเงิน" : "ยื่นแล้ว รอการเงินตรวจสอบ"}</span>;
    return <span className="badge-amber !text-sm">ค้างส่งใช้</span>;
  }

  function actions(r: Loan) {
    return (
      <div className="flex flex-wrap items-center gap-2 [td_&]:flex-nowrap [td_&]:justify-end [td_&]:gap-1">
        {canPrint(r) && (
          <a
            href={`/finance/loans/${r.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            onClick={() => isProcStaff && !r.doc_no && setTimeout(reload, 3000)}
            title={isProcStaff ? "พิมพ์สัญญา (หน้า-หลัง) — ออกเลขที่และวันที่การเงินให้อัตโนมัติ" : "พิมพ์สัญญา (หน้า-หลัง) — เลขที่/วันที่เว้นว่างให้การเงินเขียน"}
            className="btn-secondary btn-sm"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            <span className="btn-label">พิมพ์</span>
          </a>
        )}
        <RepayModal loan={r} canEdit={isProcStaff} canPrint={canPrint(r)} onSaved={reload} />
        {canEditLoan(r) && <LoanForm loan={r} lookups={lookups} onSaved={reload} />}
        {canEditLoan(r) && (
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
          <p className="page-subtitle">
            {isProcStaff
              ? "ทะเบียนคุมเงินยืมและการส่งใช้ ตามระเบียบกระทรวงการคลังว่าด้วยการเบิกเงินจากคลังฯ พ.ศ. 2562 หมวด 5"
              : "ดูสัญญาของทุกคนได้ ยื่น/แก้ไขได้เฉพาะสัญญาในชื่อของคุณที่ยังไม่ได้รับเงิน — เจ้าหน้าที่การเงินออกเลขที่ บันทึกวันรับเงิน และรับส่งใช้"}
          </p>
        </div>
        <LoanForm lookups={lookups} onSaved={reload} />
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
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
              เฉพาะที่ฉันยื่น
            </label>
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
                  <p className="text-xs text-slate-500">{loanPurpose(r)}</p>
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
                    <td>{loanPurpose(r)}</td>
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
