"use client";

// หน้ารวมงานการเงิน — "งานที่ต้องทำ" (ตามบทบาทผู้ใช้) + การ์ดไปหน้าย่อยพร้อมตัวเลขสรุป
// ข้อมูลดึงฝั่ง client ตามสิทธิ์อ่านปกติ (RLS) ของแต่ละตาราง — ครูเห็นเฉพาะสัญญายืมเงินของตัวเอง
// ตัวเลขทั้งหมดเป็นของปีงบประมาณปัจจุบัน ยกเว้นยอดค้างส่งใช้เงินยืมที่นับทุกปี (เงินยืมค้างข้ามปีได้)

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { HubCardGrid, type HubCard } from "@/components/hub-cards";
import { ChevronRightIcon, CoinsIcon, FileTextIcon, WalletIcon } from "@/components/icons";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { fiscalYearOf, round2 } from "@/lib/finance-ledger";
import { loanBalance, isOverdue } from "@/lib/loan";
import { todayTh } from "@/lib/thai";
import { loadPendingSources } from "./ledger/pending-sources";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("th-TH");

type Summary = {
  fy: number;
  txnCount: number;
  receive: number;
  pay: number;
  pendingSources: number;
  loanOpen: number;
  loanOutstanding: number;
  loanOverdue: number;
  loanNeedNumber: number; // ยื่นแล้ว รอการเงินตรวจสอบ/ออกเลข
  loanNeedApprove: number; // ออกเลขแล้ว รอ ผอ. อนุมัติ
  loanNeedPay: number; // ผอ. อนุมัติแล้ว รอจ่ายเงิน
  myOutstanding: number; // ของตัวเอง ค้างส่งใช้
  myOverdue: number;
  fundNeedApprove: number;
  fundOutstanding: number;
  receiptForms: number;
  travelForms: number;
};

type Task = { key: string; label: string; count: number; hint: string; href: string; tone: "red" | "amber" | "navy" };

export default function FinanceHubPage() {
  const { role, isProcStaff, user, loading: authLoading } = useAuth();
  const userId = user?.userId ?? null;
  const [s, setS] = useState<Summary | null>(null);

  const isFinance = role === "admin" || role === "finance_officer";
  const isDirector = role === "director" || role === "admin";

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const today = todayTh();
      const fy = fiscalYearOf(today);
      const [tx, loans, fund, rf, tf] = await Promise.all([
        supabase.from("fin_transactions").select("kind, amount").eq("fiscal_year", fy),
        supabase.from("proc_loan_contracts").select("id, doc_no, amount, received_date, due_date, director_approved_at, created_by, proc_loan_repayments(cash_amount, voucher_amount)"),
        supabase.from("fin_fund_loans").select("id, director_approved_at, fin_fund_loan_lines(amount, fin_fund_loan_repays(amount))"),
        supabase.from("fin_receipt_forms").select("id", { count: "exact", head: true }),
        supabase.from("fin_travel_forms").select("id", { count: "exact", head: true }),
      ]);
      // รายการรอบันทึกในบัญชี — โหลดเฉพาะผู้มีสิทธิ์บันทึก (ตัวนับเดียวกับแถบ "รอบันทึกจากงานอื่น" ในหน้าบัญชีรับ-จ่าย)
      const pending = isFinance ? await loadPendingSources(supabase, fy).catch(() => []) : [];

      const rows = tx.data ?? [];
      const loanRows = (loans.data ?? []).map((l) => {
        const b = loanBalance(Number(l.amount), l.proc_loan_repayments ?? []);
        return { ...l, ...b, overdue: isOverdue(l.due_date, b.cleared, today) };
      });
      const received = loanRows.filter((l) => l.received_date);
      const mine = received.filter((l) => !l.cleared && l.created_by === userId);
      const fundRows = (fund.data ?? []).map((f) => {
        const lines = f.fin_fund_loan_lines ?? [];
        const lent = lines.reduce((a, l) => a + Number(l.amount), 0);
        const repaid = lines.reduce((a, l) => a + (l.fin_fund_loan_repays ?? []).reduce((b, r) => b + Number(r.amount), 0), 0);
        return { approved: !!f.director_approved_at, outstanding: Math.max(round2(lent - repaid), 0) };
      });

      const next: Summary = {
        fy,
        txnCount: rows.length,
        receive: round2(rows.filter((r) => r.kind === "receive").reduce((a, r) => a + Number(r.amount), 0)),
        pay: round2(rows.filter((r) => r.kind === "pay").reduce((a, r) => a + Number(r.amount), 0)),
        pendingSources: pending.filter((p) => !p.skipped && !p.warn).length,
        loanOpen: received.filter((l) => !l.cleared).length,
        loanOutstanding: round2(received.reduce((a, l) => a + l.outstanding, 0)),
        loanOverdue: received.filter((l) => l.overdue).length,
        loanNeedNumber: loanRows.filter((l) => !l.doc_no && !l.received_date).length,
        loanNeedApprove: loanRows.filter((l) => l.doc_no && !l.director_approved_at && !l.received_date).length,
        loanNeedPay: loanRows.filter((l) => l.director_approved_at && !l.received_date).length,
        myOutstanding: round2(mine.reduce((a, l) => a + l.outstanding, 0)),
        myOverdue: mine.filter((l) => l.overdue).length,
        fundNeedApprove: fundRows.filter((f) => !f.approved).length,
        fundOutstanding: round2(fundRows.reduce((a, f) => a + f.outstanding, 0)),
        receiptForms: rf.count ?? 0,
        travelForms: tf.count ?? 0,
      };
      if (!cancelled) setS(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isFinance, userId]);

  if (authLoading || !s) return <PageLoadingSkeleton />;

  // งานที่ต้องทำ — แสดงเฉพาะที่เกี่ยวกับบทบาท และมีจำนวน > 0
  const tasks: Task[] = [];
  if (isFinance && s.pendingSources > 0)
    tasks.push({ key: "pending", label: "รายการรอบันทึกในบัญชีรับ-จ่าย", count: s.pendingSources, hint: "จากงานซื้อ/จ้าง ว 119 กรณีเร่งด่วน เบิกค่าใช้จ่ายโครงการ ฯลฯ", href: "/finance/ledger", tone: "amber" });
  if (isProcStaff && s.loanNeedNumber > 0)
    tasks.push({ key: "loan-number", label: "สัญญายืมเงินรอตรวจสอบ/ออกเลขที่", count: s.loanNeedNumber, hint: "ครูยื่นแล้ว รอการเงินตรวจสอบ", href: "/finance/loans", tone: "amber" });
  if (isDirector && s.loanNeedApprove > 0)
    tasks.push({ key: "loan-approve", label: "สัญญายืมเงินรอผู้อำนวยการอนุมัติ", count: s.loanNeedApprove, hint: "ออกเลขที่แล้ว รออนุมัติ", href: "/finance/loans", tone: "red" });
  if (isProcStaff && s.loanNeedPay > 0)
    tasks.push({ key: "loan-pay", label: "สัญญายืมเงินที่อนุมัติแล้ว รอจ่ายเงิน", count: s.loanNeedPay, hint: "บันทึกวันที่จ่ายเงินให้ผู้ยืม", href: "/finance/loans", tone: "navy" });
  if (isDirector && s.fundNeedApprove > 0)
    tasks.push({ key: "fund-approve", label: "ยืมเงินระหว่างประเภทเงินรอผู้อำนวยการอนุมัติ", count: s.fundNeedApprove, hint: "ต้องอนุมัติก่อนส่งใช้คืน", href: "/finance/ledger/fund-loans", tone: "red" });
  if (isProcStaff && s.loanOverdue > 0)
    tasks.push({ key: "loan-overdue", label: "เงินยืมเกินกำหนดส่งใช้", count: s.loanOverdue, hint: "ติดตามผู้ยืมให้ส่งใช้", href: "/finance/loans", tone: "red" });
  if (!isProcStaff && s.myOverdue > 0)
    tasks.push({ key: "my-overdue", label: "เงินยืมของท่านเกินกำหนดส่งใช้", count: s.myOverdue, hint: "กรุณาส่งใช้เงินยืม", href: "/finance/loans", tone: "red" });
  if (!isProcStaff && s.myOutstanding > 0)
    tasks.push({ key: "my-outstanding", label: "เงินยืมของท่านที่ยังค้างส่งใช้", count: 1, hint: `คงค้าง ${baht(s.myOutstanding)} บาท`, href: "/finance/loans", tone: "amber" });

  const toneCls = { red: "badge-red", amber: "badge-amber", navy: "badge-navy" } as const;

  const cards: HubCard[] = [
    {
      key: "ledger",
      title: "บัญชีรับ-จ่ายเงิน",
      description: "บันทึกรับ-จ่ายแยกประเภทเงิน · รายงานเงินคงเหลือประจำวัน · ทะเบียนคุมเงิน · ยืมเงินระหว่างประเภทเงิน",
      href: "/finance/ledger",
      icon: <CoinsIcon className="h-6 w-6" />,
      value: `${num(s.txnCount)} รายการ`,
      sub: `ปีงบ ${s.fy} · รับ ${baht(s.receive)} · จ่าย ${baht(s.pay)} บาท${s.fundNeedApprove || s.fundOutstanding ? ` · ยืมข้ามประเภทค้าง ${baht(s.fundOutstanding)} บาท` : ""}`,
    },
    {
      key: "loans",
      title: "สัญญายืมเงิน",
      description: "ทำสัญญายืมเงิน ติดตามการอนุมัติ ส่งใช้เงินยืม และเชื่อมกับรายงานการเดินทางไปราชการ (แบบ 8708)",
      href: "/finance/loans",
      icon: <WalletIcon className="h-6 w-6" />,
      value: `${num(s.loanOpen)} สัญญา`,
      sub: `ค้างส่งใช้ ${baht(s.loanOutstanding)} บาท${s.loanOverdue ? ` · เกินกำหนด ${num(s.loanOverdue)} สัญญา` : ""}`,
    },
    {
      key: "withholding",
      title: "ภาษีหัก ณ ที่จ่าย",
      description: "หนังสือรับรองการหักภาษี ณ ที่จ่าย",
      href: "/supplies/withholding-tax",
      icon: <CoinsIcon className="h-6 w-6" />,
    },
    {
      key: "forms",
      title: "แบบฟอร์มการเงิน",
      description: "ใบสำคัญรับเงินนักเรียน · รายงานการเดินทางไปราชการ (แบบ 8708) · ดาวน์โหลดแบบฟอร์มการเงินของโรงเรียน",
      href: "/finance/forms",
      icon: <FileTextIcon className="h-6 w-6" />,
      value: `${num(s.receiptForms + s.travelForms)} ฉบับ`,
      sub: `ใบสำคัญรับเงิน ${num(s.receiptForms)} · แบบ 8708 ${num(s.travelForms)}`,
    },
    {
      key: "salary-slip",
      title: "สลิปเงินเดือน",
      description: "เปิดดูสลิปเงินเดือนจากระบบของสำนักงานเขตพื้นที่การศึกษา ด้วยเลขบัตรประชาชนและเดือน/ปี",
      href: "/finance/salary-slip",
      icon: <CoinsIcon className="h-6 w-6" />,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">งานการเงิน</h1>
          <p className="page-subtitle">บัญชีรับ-จ่าย สัญญายืมเงิน ภาษีหัก ณ ที่จ่าย แบบฟอร์มการเงิน และสลิปเงินเดือน</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="mb-2 font-semibold text-slate-900">งานที่ต้องทำ</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่มีงานค้าง</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <li key={t.key}>
                <Link href={t.href} className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50">
                  <span className={`${toneCls[t.tone]} !text-sm tabular-nums`}>{num(t.count)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.hint}</span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <HubCardGrid cards={cards} />
    </div>
  );
}
