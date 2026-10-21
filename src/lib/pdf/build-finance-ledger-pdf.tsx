import { renderToBuffer } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";
import { DOC_FORMAT_KEYS, docFormatsFrom, balancesByType, fiscalMonths, fiscalRange, fiscalYearOf, registerForMonth, sortTxns, zero, type FinTxn, type MoneyType, type Opening, type VoucherClear } from "@/lib/finance-ledger";
import { FundLoanMemoDocument } from "./fund-loan-document";
import { DailyBalanceDocument, MoneyRegisterDocument, VoucherRegisterDocument, type FinSigners, type RegisterPage } from "./finance-ledger-document";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadCommon(supabase: Supabase, fy: number) {
  const [{ data: types }, { data: openings }, { data: txns }, { data: school }] = await Promise.all([
    supabase.from("fin_money_types").select("id, name, category, account_id, sort_order, is_active").order("sort_order"),
    supabase.from("fin_opening_balances").select("fiscal_year, money_type_id, cash, bank, gov").eq("fiscal_year", fy),
    supabase.from("fin_transactions").select("*").eq("fiscal_year", fy),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);
  return {
    types: (types ?? []) as MoneyType[],
    openings: ((openings ?? []) as Opening[]).map((o) => ({ ...o, cash: Number(o.cash), bank: Number(o.bank), gov: Number(o.gov) })),
    txns: ((txns ?? []) as unknown as FinTxn[]).map((x) => ({ ...x, amount: Number(x.amount) })),
    schoolName: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
  };
}

async function loadSigners(supabase: Supabase, schoolName: string): Promise<FinSigners> {
  const [{ data: fin }, { data: app }] = await Promise.all([
    supabase.from("fin_settings").select("key, value"),
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_finance", "approval_signer_director"]),
  ]);
  const f = new Map((fin ?? []).map((r) => [r.key, r.value ?? ""]));
  const a = new Map((app ?? []).map((r) => [r.key, r.value ?? ""]));
  const s = (key: string, fallbackName = "", fallbackPos = "") => ({ name: f.get(`${key}_name`) || fallbackName, position: f.get(`${key}_position`) || fallbackPos });
  return {
    officer: s("fin_officer", a.get("approval_signer_finance"), "เจ้าหน้าที่การเงิน"),
    committee: [s("fin_committee_1", "", "กรรมการ"), s("fin_committee_2", "", "กรรมการ"), s("fin_committee_3", "", "กรรมการ")],
    head: s("fin_head", a.get("approval_signer_director"), `ผู้อำนวยการ${schoolName}`),
  };
}

export async function buildDailyBalancePdf(supabase: Supabase, date: string) {
  const fy = fiscalYearOf(date);
  const { types, openings, txns, schoolName } = await loadCommon(supabase, fy);
  const signers = await loadSigners(supabase, schoolName);
  return renderToBuffer(<DailyBalanceDocument schoolName={schoolName} date={date} types={types} balances={balancesByType(openings, txns, date)} signers={signers} />);
}

/** month = "YYYY-MM" หรือ "all" (ทุกเดือนตั้งแต่ ต.ค. ถึงเดือนปัจจุบัน/เดือนล่าสุดที่มีรายการ) — typeId ว่าง = ทุกประเภทที่มียอด/รายการ */
export async function buildMoneyRegisterPdf(supabase: Supabase, fy: number, month: string, typeId: string | null) {
  const { types, openings, txns, schoolName } = await loadCommon(supabase, fy);
  const months = fiscalMonths(fy);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7);
  const lastTxn = sortTxns(txns).at(-1)?.txn_date.slice(0, 7) ?? "";
  const until = [today, lastTxn].sort().at(-1)!;
  const selected = month === "all" ? months.filter((m) => m <= until || m === months[0]) : months.filter((m) => m === month);
  // ล้างลูกหนี้ด้วยใบสำคัญ: การส่งใช้เงินยืม (ส่วนใบสำคัญ) ของสัญญาที่บันทึกจ่ายเงินยืมไว้ในประเภทเงินนั้น
  const loanTypeOf = new Map(txns.filter((x) => x.kind === "pay" && x.source_kind === "loan" && x.source_id).map((x) => [x.source_id!, x.money_type_id]));
  const clearsByType = new Map<string, VoucherClear[]>();
  if (loanTypeOf.size) {
    const [from, to] = fiscalRange(fy);
    const { data: reps } = await supabase
      .from("proc_loan_repayments")
      .select("id, loan_id, repay_date, voucher_amount, voucher_count, receipt_no, created_at, proc_loan_contracts(doc_no)")
      .in("loan_id", [...loanTypeOf.keys()])
      .gt("voucher_amount", 0)
      .gte("repay_date", from)
      .lte("repay_date", to);
    for (const r of reps ?? []) {
      const typeId = loanTypeOf.get(r.loan_id);
      if (!typeId) continue;
      const loanNo = (r.proc_loan_contracts as unknown as { doc_no: string | null } | null)?.doc_no ?? "-";
      const list = clearsByType.get(typeId) ?? [];
      list.push({
        id: r.id,
        date: r.repay_date,
        doc: r.receipt_no ?? "",
        description: `ส่งใช้เงินยืมตามสัญญาเลขที่ ${loanNo} เป็นใบสำคัญ${r.voucher_count ? ` ${r.voucher_count} ฉบับ` : ""}`,
        amount: Number(r.voucher_amount),
        created_at: r.created_at,
      });
      clearsByType.set(typeId, list);
    }
  }
  const { data: fmtRows } = await supabase.from("proc_app_settings").select("key, value").in("key", DOC_FORMAT_KEYS);
  const fmt = docFormatsFrom(Object.fromEntries((fmtRows ?? []).map((r) => [r.key, r.value ?? ""])));
  const pages: RegisterPage[] = [];
  const list = typeId ? types.filter((x) => x.id === typeId) : types;
  for (const type of list) {
    const tx = txns.filter((x) => x.money_type_id === type.id);
    const op = openings.find((o) => o.money_type_id === type.id);
    const opening = op ? { cash: op.cash, bank: op.bank, gov: op.gov } : zero();
    if (!typeId && tx.length === 0 && opening.cash + opening.bank + opening.gov === 0) continue;
    for (const m of selected) pages.push({ type, month: m, reg: registerForMonth(opening, tx, m, clearsByType.get(type.id) ?? [], fmt) });
  }
  if (pages.length === 0) return null;
  return renderToBuffer(<MoneyRegisterDocument pages={pages} schoolName={schoolName} fy={fy} />);
}

export async function buildVoucherRegisterPdf(supabase: Supabase, fy: number) {
  const { types, txns, schoolName } = await loadCommon(supabase, fy);
  const vouchers = txns
    .filter((x) => x.kind === "pay" && (x.doc_kind === "บค" || x.doc_kind === "บจ"))
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date) || (a.doc_kind ?? "").localeCompare(b.doc_kind ?? "") || (a.doc_seq ?? 0) - (b.doc_seq ?? 0));
  const projectIds = Array.from(new Set(vouchers.map((x) => x.project_id).filter((x): x is string => !!x)));
  const { data: projects } = projectIds.length ? await supabase.from("plan_projects").select("id, name").in("id", projectIds) : { data: [] };
  return renderToBuffer(
    <VoucherRegisterDocument
      txns={vouchers}
      schoolName={schoolName}
      fy={fy}
      typeName={new Map(types.map((x) => [x.id, x.name]))}
      projectName={new Map((projects ?? []).map((p) => [p.id, p.name]))}
    />,
  );
}

/** บันทึกข้อความขออนุมัติยืมเงินระหว่างประเภทเงิน */
export async function buildFundLoanMemoPdf(supabase: Supabase, id: string) {
  const { data: loan } = await supabase
    .from("fin_fund_loans")
    .select("loan_date, lender_type_id, semester, academic_year, memo_no, memo_date, reason, fin_fund_loan_lines(borrower_type_id, amount, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (!loan) return null;
  const [{ data: types }, { data: school }] = await Promise.all([
    supabase.from("fin_money_types").select("id, name"),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  const name = new Map((types ?? []).map((x) => [x.id, x.name as string]));
  const schoolName = school?.school_name ?? "โรงเรียนตาเบาวิทยา";
  const signers = await loadSigners(supabase, schoolName);
  const lines = [...((loan.fin_fund_loan_lines ?? []) as { borrower_type_id: string; amount: number; sort_order: number }[])].sort((a, b) => a.sort_order - b.sort_order);
  return renderToBuffer(
    <FundLoanMemoDocument
      data={{
        school_name: schoolName,
        education_area: school?.education_area ?? null,
        memo_no: loan.memo_no,
        memo_date: loan.memo_date,
        loan_date: loan.loan_date,
        lender: name.get(loan.lender_type_id) ?? "",
        lines: lines.map((l) => ({ borrower: name.get(l.borrower_type_id) ?? "", amount: Number(l.amount) })),
        semester: loan.semester,
        academic_year: loan.academic_year,
        reason: loan.reason,
        finance_officer: signers.officer,
        director: signers.head,
      }}
    />,
  );
}
