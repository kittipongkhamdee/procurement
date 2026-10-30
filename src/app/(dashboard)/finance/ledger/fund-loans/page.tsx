"use client";

// ยืมเงินระหว่างประเภทเงิน — เงินประเภทหนึ่งไม่พอจ่าย (เช่น ค่าเครื่องแบบ/ค่าอุปกรณ์การเรียน ได้รับจัดสรรยังไม่ครบ)
// ยืมจากอีกประเภท (เช่น กิจกรรมพัฒนาคุณภาพผู้เรียน) โดยไม่ต้องทำสัญญายืมเงิน แล้วส่งใช้คืนเมื่อได้รับจัดสรรเพิ่ม
// บันทึกที่นี่ระบบลงรายการรับ-จ่ายทั้งสองฝั่งให้เอง (ทะเบียนคุมผู้ให้ยืม: จ่าย/ลูกหนี้ · ผู้ยืม: รับ) — เลขที่ บง n/ปีงบ

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { AdminProxyPanel } from "@/components/admin-proxy-panel";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ChevronLeftIcon, PencilIcon, PlusIcon, PrinterIcon, TrashIcon } from "@/components/icons";
import { DEFAULT_DOC_FORMATS, DOC_FORMAT_KEYS, docFormatsFrom, type DocFormats, balancesByType, fiscalYearOf, fundRef, POCKET_LABEL, POCKETS, round2, type FinTxn, type MoneyType, type Opening, type Pocket } from "@/lib/finance-ledger";
import { adminApproveFundLoanOnBehalf, approveFundLoan, deleteFundLoan, deleteFundRepay, saveFundLoan, saveFundRepay, updateFundLoanMemo } from "./actions";

type Repay = { id: string; repay_date: string; amount: number; pocket: Pocket; doc_seq: number; fiscal_year: number; note: string | null };
type Line = { id: string; borrower_type_id: string; amount: number; sort_order: number; repays: Repay[] };
type Loan = {
  id: string;
  fiscal_year: number;
  doc_seq: number;
  loan_date: string;
  lender_type_id: string;
  pocket: Pocket;
  semester: string | null;
  academic_year: string | null;
  memo_no: string | null;
  memo_date: string | null;
  reason: string | null;
  director_approved_at: string | null;
  director_approved_by_name: string | null;
  lines: Line[];
};

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const repaidOf = (l: Line) => round2(l.repays.reduce((s, r) => s + r.amount, 0));
const outstandingOf = (l: Line) => round2(l.amount - repaidOf(l));

export default function FundLoansPage() {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "finance_officer";
  const canApprove = role === "director" || role === "admin";
  const [types, setTypes] = useState<MoneyType[]>([]);
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [show, setShow] = useState<"open" | "all">("open");
  const [fmt, setFmt] = useState<DocFormats>(DEFAULT_DOC_FORMATS);
  const [ledger, setLedger] = useState<{ openings: Opening[]; txns: FinTxn[] }>({ openings: [], txns: [] });

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: mt }, { data: ln }, { data: op }, { data: tx }, { data: fm }] = await Promise.all([
      supabase.from("fin_money_types").select("id, name, category, account_id, sort_order, is_active").order("sort_order"),
      supabase
        .from("fin_fund_loans")
        .select("*, fin_fund_loan_lines(id, borrower_type_id, amount, sort_order, fin_fund_loan_repays(id, repay_date, amount, pocket, doc_seq, fiscal_year, note))")
        .order("loan_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("fin_opening_balances").select("fiscal_year, money_type_id, cash, bank, gov"),
      supabase.from("fin_transactions").select("fiscal_year, txn_date, kind, from_pocket, to_pocket, amount, money_type_id"),
      supabase.from("proc_app_settings").select("key, value").in("key", DOC_FORMAT_KEYS),
    ]);
    setFmt(docFormatsFrom(Object.fromEntries((fm ?? []).map((r) => [r.key, r.value ?? ""]))));
    // ยอดคงเหลือของผู้ให้ยืม (แสดงในฟอร์ม) — คำนวณตามปีงบของวันที่ยืม
    setLedger({
      openings: ((op ?? []) as Opening[]).map((o) => ({ ...o, cash: Number(o.cash), bank: Number(o.bank), gov: Number(o.gov) })),
      txns: ((tx ?? []) as unknown as FinTxn[]).map((x) => ({ ...x, amount: Number(x.amount) })),
    });
    setTypes((mt ?? []) as MoneyType[]);
    type Raw = Omit<Loan, "lines"> & { fin_fund_loan_lines: (Omit<Line, "repays"> & { fin_fund_loan_repays: Repay[] })[] };
    setLoans(
      ((ln ?? []) as unknown as Raw[]).map(({ fin_fund_loan_lines, ...l }) => ({
        ...l,
        lines: [...(fin_fund_loan_lines ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(({ fin_fund_loan_repays, ...x }) => ({
            ...x,
            amount: Number(x.amount),
            repays: [...(fin_fund_loan_repays ?? [])].map((r) => ({ ...r, amount: Number(r.amount) })).sort((a, b) => a.repay_date.localeCompare(b.repay_date)),
          })),
      })),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const typeName = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  // ยอดค้างรวม แยกคู่ ผู้ให้ยืม → ผู้ยืม
  const pairs = useMemo(() => {
    const m = new Map<string, { lender: string; borrower: string; amount: number }>();
    for (const l of loans ?? [])
      for (const x of l.lines) {
        const o = outstandingOf(x);
        if (o <= 0) continue;
        const k = `${l.lender_type_id}|${x.borrower_type_id}`;
        const cur = m.get(k) ?? { lender: l.lender_type_id, borrower: x.borrower_type_id, amount: 0 };
        cur.amount = round2(cur.amount + o);
        m.set(k, cur);
      }
    return [...m.values()];
  }, [loans]);

  if (loans === null) return <PageLoadingSkeleton />;
  const list = show === "open" ? loans.filter((l) => l.lines.some((x) => outstandingOf(x) > 0)) : loans;

  async function removeLoan(l: Loan) {
    if (!(await confirmDelete({ title: `ลบการยืม ${fundRef(l.doc_seq, l.fiscal_year, fmt)}?`, text: "รายการรับ-จ่ายที่ระบบสร้างไว้ทั้งสองฝั่งจะถูกลบด้วย" }))) return;
    const res = await deleteFundLoan(l.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }
  async function approve(l: Loan, ok: boolean) {
    const doc = fundRef(l.doc_seq, l.fiscal_year, fmt);
    const yes = ok
      ? await confirmWarning({ title: `อนุมัติการยืม ${doc}?`, text: `ยืมจาก${typeName.get(l.lender_type_id)} รวม ${baht(l.lines.reduce((s, x) => s + x.amount, 0))} บาท`, confirmButtonText: "อนุมัติ" })
      : await confirmWarning({ title: `ยกเลิกการอนุมัติ ${doc}?`, confirmButtonText: "ยกเลิกอนุมัติ" });
    if (!yes) return;
    const res = await approveFundLoan(l.id, ok);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess(ok ? "อนุมัติแล้ว" : "ยกเลิกอนุมัติแล้ว");
    reload();
  }
  async function removeRepay(r: Repay) {
    if (!(await confirmDelete({ title: `ลบการส่งใช้คืน ${fundRef(r.doc_seq, r.fiscal_year, fmt)}?`, text: "รายการรับ-จ่ายที่ระบบสร้างไว้ทั้งสองฝั่งจะถูกลบด้วย" }))) return;
    const res = await deleteFundRepay(r.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/finance" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            การเงิน
          </Link>
          <h1 className="page-title">ยืมเงินระหว่างประเภทเงิน</h1>
          <p className="page-subtitle">
            เงินประเภทหนึ่งไม่พอจ่าย ยืมจากประเภทอื่น (เช่น กิจกรรมพัฒนาคุณภาพผู้เรียน) โดยไม่ต้องทำสัญญายืมเงิน — ระบบลงทะเบียนคุมทั้งสองประเภทให้เอง
            {canWrite ? "" : " — ดูได้อย่างเดียว"}
          </p>
        </div>
        {canWrite && <LoanForm types={types} ledger={ledger} onSaved={reload} />}
      </div>

      <div className="card mb-4">
        <h2 className="mb-2 font-semibold text-slate-900">ยอดเงินยืมระหว่างประเภทที่ยังค้าง</h2>
        {pairs.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มียอดค้าง</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {pairs.map((p) => (
              <li key={`${p.lender}|${p.borrower}`} className="flex flex-wrap justify-between gap-2">
                <span>
                  <b>{typeName.get(p.borrower)}</b> ยืม <b>{typeName.get(p.lender)}</b>
                </span>
                <span className="font-semibold tabular-nums text-amber-700">{baht(p.amount)} บาท</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-3 flex gap-2">
        {(["open", "all"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setShow(k)} className={`btn-sm ${show === k ? "btn-primary" : "btn-secondary"}`}>
            {k === "open" ? "ยังค้างส่งใช้" : "ทั้งหมด"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card table-empty">{show === "open" ? "ไม่มีรายการที่ยังค้างส่งใช้" : "ยังไม่มีการยืมเงินระหว่างประเภทเงิน"}</div>
      ) : (
        <div className="space-y-3">
          {list.map((l) => {
            const sum = round2(l.lines.reduce((s, x) => s + x.amount, 0));
            const hasRepay = l.lines.some((x) => x.repays.length > 0);
            const approved = !!l.director_approved_at;
            return (
              <div key={l.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {fundRef(l.doc_seq, l.fiscal_year, fmt)} · ยืมจาก{typeName.get(l.lender_type_id)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatThaiDate(l.loan_date)} · {POCKET_LABEL[l.pocket]} · รวม {baht(sum)} บาท
                      {l.semester || l.academic_year ? ` · ภาคเรียนที่ ${l.semester ?? "-"}/${l.academic_year ?? "-"}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      {approved ? (
                        <span className="badge-emerald !text-sm">
                          ผู้อำนวยการอนุมัติแล้ว {new Date(l.director_approved_at!).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}
                          {l.director_approved_by_name ? ` · ${l.director_approved_by_name}` : ""}
                        </span>
                      ) : (
                        <span className="badge-amber !text-sm">รอผู้อำนวยการอนุมัติ</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <a href={`/finance/ledger/fund-loans/${l.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm" title="พิมพ์บันทึกข้อความขออนุมัติยืมเงิน">
                      <PrinterIcon className="h-3.5 w-3.5" />
                      บันทึกขออนุมัติ
                    </a>
                    {canApprove && !approved && (
                      <button type="button" onClick={() => approve(l, true)} className="btn-primary btn-sm">
                        อนุมัติ
                      </button>
                    )}
                    {canApprove && approved && !hasRepay && (
                      <button type="button" onClick={() => approve(l, false)} className="btn-secondary btn-sm">
                        ยกเลิกอนุมัติ
                      </button>
                    )}
                    {canWrite && <MemoForm loan={l} fmt={fmt} onSaved={reload} />}
                    {canWrite && !hasRepay && (!approved || role === "admin") && (
                      <button type="button" onClick={() => removeLoan(l)} title="ลบ" className="btn-danger btn-sm">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {role === "admin" && !approved && (
                    <div className="w-full">
                      <AdminProxyPanel
                        steps={[{ key: "director", label: "บันทึกอนุมัติแทนผู้อำนวยการ", options: [{ value: "approve", label: "อนุมัติการยืม" }] }]}
                        onSubmit={async (_step, _value, _note, reason) => {
                          const ok = await confirmWarning({ title: `บันทึกอนุมัติ ${fundRef(l.doc_seq, l.fiscal_year, fmt)} แทนผู้อำนวยการ?`, text: "ระบบจะบันทึกว่าแอดมินเป็นผู้บันทึกแทน", confirmButtonText: "บันทึกแทน" });
                          if (!ok) throw new Error("ยกเลิก");
                          const res = await adminApproveFundLoanOnBehalf(l.id, reason);
                          if (res.error) {
                            await toastError(res.error);
                            throw new Error(res.error);
                          }
                          await toastSuccess("บันทึกอนุมัติแทนผู้อำนวยการแล้ว");
                          reload();
                        }}
                      />
                    </div>
                  )}
                  {/* บอกเหตุที่ยังไม่มีปุ่มลบ — ต้องลบตามลำดับย้อนกลับ */}
                  {canWrite && (hasRepay || (approved && role !== "admin")) && (
                    <p className="w-full text-xs text-slate-500">
                      ลบการยืมนี้ได้เมื่อ{hasRepay ? "ลบการส่งใช้คืนทุกรายการแล้ว (ปุ่มลบอยู่ในตารางด้านล่าง)" : ""}
                      {hasRepay && approved && role !== "admin" ? " และ" : ""}
                      {approved && role !== "admin" ? "ผู้อำนวยการกดยกเลิกอนุมัติแล้ว" : ""}
                    </p>
                  )}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="table-base w-full">
                    <thead>
                      <tr>
                        <th>ประเภทเงินที่ยืม</th>
                        <th className="text-right">ยืม</th>
                        <th className="text-right">ส่งใช้แล้ว</th>
                        <th className="text-right">ค้าง</th>
                        {canWrite && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {l.lines.map((x) => {
                        const o = outstandingOf(x);
                        return (
                          <tr key={x.id}>
                            <td>
                              <div className="text-slate-900">{typeName.get(x.borrower_type_id)}</div>
                              {x.repays.map((r) => (
                                <div key={r.id} className="flex flex-wrap items-center gap-2 text-slate-500">
                                  <span>
                                    ส่งใช้ {formatThaiDate(r.repay_date)} · {fundRef(r.doc_seq, r.fiscal_year, fmt)} · {baht(r.amount)} บาท
                                  </span>
                                  {canWrite && (
                                    <button type="button" onClick={() => removeRepay(r)} title="ลบการส่งใช้คืน" className="btn-danger btn-sm">
                                      <TrashIcon className="h-3.5 w-3.5" />
                                      ลบ
                                    </button>
                                  )}
                                </div>
                              ))}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums">{baht(x.amount)}</td>
                            <td className="whitespace-nowrap text-right tabular-nums text-emerald-700">{baht(repaidOf(x))}</td>
                            <td className={`whitespace-nowrap text-right font-semibold tabular-nums ${o > 0 ? "text-amber-700" : "text-slate-400"}`}>{o > 0 ? baht(o) : "ครบแล้ว"}</td>
                            {canWrite && (
                              <td className="whitespace-nowrap text-right">
                                {o > 0 && !approved && <span className="text-sm text-slate-400">รอ ผอ. อนุมัติ</span>}
                                {o > 0 && approved && <RepayForm fmt={fmt} loan={l} line={x} outstanding={o} typeName={typeName} onSaved={reload} />}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemoFields({ loan }: { loan?: Loan }) {
  return (
    <>
      <div>
        <label className="label">ภาคเรียนที่</label>
        <input name="semester" defaultValue={loan?.semester ?? ""} placeholder="เช่น 2" className="input w-full" />
      </div>
      <div>
        <label className="label">ปีการศึกษา</label>
        <input name="academic_year" defaultValue={loan?.academic_year ?? ""} placeholder="เช่น 2569" className="input w-full" />
      </div>
      <div>
        <label className="label">ที่ (เลขที่บันทึกข้อความ)</label>
        <input name="memo_no" defaultValue={loan?.memo_no ?? ""} placeholder="เว้นว่างได้" className="input w-full" />
      </div>
      <div>
        <label className="label">วันที่บันทึกข้อความ</label>
        <ThaiDatePicker name="memo_date" defaultValue={loan?.memo_date ?? null} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">เหตุผลที่ยืม (ไม่บังคับ)</label>
        <textarea
          name="reason"
          rows={2}
          defaultValue={loan?.reason ?? ""}
          placeholder="ว่างไว้ = ใช้ข้อความมาตรฐาน: ได้รับจัดสรรเงินอุดหนุนยังไม่ครบถ้วน ไม่เพียงพอต่อการจ่ายให้นักเรียนตามสิทธิ"
          className="input w-full"
        />
      </div>
    </>
  );
}

function LoanForm({ types, ledger, onSaved }: { types: MoneyType[]; ledger: { openings: Opening[]; txns: FinTxn[] }; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const active = types.filter((t) => t.is_active);
  const [lender, setLender] = useState(() => active.find((t) => t.name.includes("กิจกรรมพัฒนาคุณภาพผู้เรียน"))?.id ?? "");
  const [lines, setLines] = useState<{ borrower_type_id: string; amount: string }[]>([{ borrower_type_id: "", amount: "" }]);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const sum = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const [date, setDate] = useState<string | null>(todayLocal());
  const [pocket, setPocket] = useState<Pocket>("bank");
  const lenderBal = useMemo(() => {
    if (!lender || !date) return null;
    const fy = fiscalYearOf(date);
    return balancesByType(
      ledger.openings.filter((o) => o.fiscal_year === fy),
      ledger.txns.filter((x) => x.fiscal_year === fy),
      date,
    ).get(lender) ?? { cash: 0, bank: 0, gov: 0 };
  }, [lender, date, ledger]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("lender_type_id", lender);
    fd.set("lines", JSON.stringify(lines.map((l) => ({ borrower_type_id: l.borrower_type_id, amount: Number(l.amount) || 0 }))));
    setSaving(true);
    try {
      const res = await saveFundLoan(fd);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("บันทึกการยืมแล้ว — ลงรายการรับ-จ่ายทั้งสองประเภทให้แล้ว");
      setLines([{ borrower_type_id: "", amount: "" }]);
      setDate(todayLocal());
      setFormKey((k) => k + 1);
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
      title="บันทึกการยืมเงินระหว่างประเภทเงิน"
      wide
      lazy
      trigger={
        <span className="btn-primary inline-flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          บันทึกการยืม
        </span>
      }
    >
      <form key={formKey} onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">
            วันที่ยืม (วันที่โอนเงินจริง) <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker name="loan_date" value={date} onChange={setDate} maxDate={todayLocal()} required />
        </div>
        <div>
          <label className="label">ช่องเงิน</label>
          <select name="pocket" value={pocket} onChange={(e) => setPocket(e.target.value as Pocket)} className="input w-full">
            {POCKETS.map((p) => (
              <option key={p} value={p}>
                {POCKET_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            ยืมจากประเภทเงิน (ผู้ให้ยืม) <span className="text-red-600">*</span>
          </label>
          <select value={lender} onChange={(e) => setLender(e.target.value)} required className="input w-full">
            <option value="">— เลือกประเภทเงิน —</option>
            {active.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {lenderBal && (
            <p className={`mt-1 text-sm ${lenderBal[pocket] < sum ? "text-red-600" : "text-slate-600"}`}>
              ยอดคงเหลือ ณ วันที่ยืม — {POCKET_LABEL[pocket]} <b className="tabular-nums">{baht(lenderBal[pocket])}</b> บาท
              {POCKETS.filter((p) => p !== pocket && lenderBal[p] !== 0).map((p) => ` · ${POCKET_LABEL[p]} ${baht(lenderBal[p])}`)}
              {lenderBal[pocket] < sum && " — ไม่พอให้ยืม"}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">
            ประเภทเงินที่ยืม (ผู้ยืม) และจำนวนเงิน <span className="text-red-600">*</span>
          </label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <select
                  value={l.borrower_type_id}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, borrower_type_id: e.target.value } : x)))}
                  className="input min-w-0 flex-1"
                  aria-label="ประเภทเงินที่ยืม"
                >
                  <option value="">— เลือกประเภทเงิน —</option>
                  {active
                    .filter((t) => t.id !== lender)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.amount}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  placeholder="จำนวนเงิน"
                  className="input w-36"
                  aria-label="จำนวนเงิน"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="btn-danger btn-sm" title="ลบแถว">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setLines([...lines, { borrower_type_id: "", amount: "" }])} className="btn-secondary btn-sm">
              <PlusIcon className="h-3.5 w-3.5" />
              เพิ่มประเภทเงินที่ยืม
            </button>
            <span className="text-sm text-slate-600">
              รวม <b className="tabular-nums">{baht(sum)}</b> บาท
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-700 sm:col-span-2">ข้อมูลสำหรับบันทึกข้อความขออนุมัติยืมเงิน</p>
        <MemoFields />
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MemoForm({ loan, fmt, onSaved }: { loan: Loan; fmt: DocFormats; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateFundLoanMemo(loan.id, new FormData(e.currentTarget));
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("บันทึกแล้ว");
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
      title={`ข้อมูลบันทึกข้อความ ${fundRef(loan.doc_seq, loan.fiscal_year, fmt)}`}
      lazy
      trigger={
        <span title="แก้ข้อมูลบันทึกข้อความ" className="btn-secondary btn-sm">
          <PencilIcon className="h-3.5 w-3.5" />
        </span>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="text-sm text-slate-500 sm:col-span-2">จำนวนเงินและประเภทเงินแก้ไม่ได้ — ถ้าผิด ให้ลบการยืมแล้วบันทึกใหม่</p>
        <MemoFields loan={loan} />
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RepayForm({ loan, line, outstanding, typeName, fmt, onSaved }: { loan: Loan; line: Line; fmt: DocFormats; outstanding: number; typeName: Map<string, string>; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveFundRepay(line.id, new FormData(e.currentTarget));
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("บันทึกการส่งใช้คืนแล้ว");
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
      title="ส่งใช้เงินยืมคืน"
      lazy
      closeOnSubmit={false}
      trigger={<span className="btn-secondary btn-sm">ส่งใช้คืน</span>}
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 sm:col-span-2">
          {typeName.get(line.borrower_type_id)} ส่งใช้คืน {typeName.get(loan.lender_type_id)} ตาม {fundRef(loan.doc_seq, loan.fiscal_year, fmt)} — ยอดค้าง <b>{baht(outstanding)}</b> บาท
        </p>
        <div>
          <label className="label">
            วันที่ส่งใช้คืน <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker name="repay_date" defaultValue={todayLocal()} minDate={loan.loan_date} maxDate={todayLocal()} required />
        </div>
        <div>
          <label className="label">
            จำนวนเงิน (บาท) <span className="text-red-600">*</span>
          </label>
          <input name="amount" type="number" step="0.01" min="0.01" max={outstanding} defaultValue={outstanding} required className="input w-full" />
        </div>
        <div>
          <label className="label">ช่องเงิน</label>
          <select name="pocket" defaultValue={loan.pocket} className="input w-full">
            {POCKETS.map((p) => (
              <option key={p} value={p}>
                {POCKET_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">หมายเหตุ</label>
          <input name="note" className="input w-full" />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
