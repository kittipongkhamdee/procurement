"use client";

// หน้ารวมงานการเงิน (รวมบัญชีรับ-จ่ายเงินไว้ในหน้าเดียวกัน) — "งานที่ต้องทำ" ตามบทบาท + การ์ดบัญชีธนาคาร + การ์ดเมนูทั้งหมด
// เนื้อหาบัญชีรับ-จ่าย (รายการ/ยอดคงเหลือ/งบโครงการ/พิมพ์รายงาน ?view=…) อยู่ใน ledger/ledger-view.tsx — หน้านี้ส่งส่วนเสริม
// (งานที่ต้องทำ + การ์ดธนาคาร + การ์ดเมนูอื่น) เข้าไปแสดงในหน้ารวม ใช้ข้อมูลชุดเดียวกัน ไม่ดึงซ้ำ
// ส่วนที่ดึงเพิ่มในหน้านี้: สัญญายืมเงิน ยืมเงินระหว่างประเภทเงิน และจำนวนแบบฟอร์ม (ตามสิทธิ์อ่านปกติ ครูเห็นเฉพาะสัญญาของตัวเอง)
// ยอดค้างส่งใช้เงินยืมนับทุกปี (เงินยืมค้างข้ามปีได้)

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { HubCard } from "@/components/hub-cards";
import { BankAccountCard } from "@/components/bank-account-card";
import { ChevronRightIcon, CoinsIcon, FileTextIcon, WalletIcon } from "@/components/icons";
import { round2 } from "@/lib/finance-ledger";
import { loanBalance, isOverdue } from "@/lib/loan";
import { todayTh } from "@/lib/thai";
import { loadPendingSources } from "./ledger/pending-sources";
import { LedgerView, type LedgerOverviewCtx } from "./ledger/ledger-view";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("th-TH");

type Summary = {
  loanOpen: number;
  loanOutstanding: number;
  loanOverdue: number;
  loanNeedNumber: number; // ยื่นแล้ว รอการเงินตรวจสอบ/ออกเลข
  loanNeedApprove: number; // ออกเลขแล้ว รอ ผอ. อนุมัติ
  loanNeedPay: number; // ผอ. อนุมัติแล้ว รอจ่ายเงิน
  myOutstanding: number; // ของตัวเอง ค้างส่งใช้
  myOverdue: number;
  fundNeedApprove: number;
  receiptForms: number;
  travelForms: number;
};

type Task = { key: string; label: string; count: number; hint: string; href: string; tone: "red" | "amber" | "navy" };

export default function FinancePage() {
  const { role, user, loading: authLoading } = useAuth();
  const userId = user?.userId ?? null;
  const [s, setS] = useState<Summary | null>(null);

  // ผู้อำนวยการ/รองผู้อำนวยการ/เจ้าหน้าที่การเงิน/แอดมิน เห็นงานที่ต้องทำทุกรายการ — บทบาทอื่น (ครูทั่วไป ฯลฯ) เห็นเฉพาะเงินยืมของตัวเองที่ค้างส่งใช้/เกินกำหนด
  const isManager = role === "admin" || role === "finance_officer" || role === "director" || role === "deputy_director";

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const today = todayTh();
      const [loans, fund, rf, tf] = await Promise.all([
        supabase.from("proc_loan_contracts").select("id, doc_no, amount, received_date, due_date, director_approved_at, created_by, proc_loan_repayments(cash_amount, voucher_amount)"),
        supabase.from("fin_fund_loans").select("id, director_approved_at"),
        supabase.from("fin_receipt_forms").select("id", { count: "exact", head: true }),
        supabase.from("fin_travel_forms").select("id", { count: "exact", head: true }),
      ]);
      const loanRows = (loans.data ?? []).map((l) => {
        const b = loanBalance(Number(l.amount), l.proc_loan_repayments ?? []);
        return { ...l, ...b, overdue: isOverdue(l.due_date, b.cleared, today) };
      });
      const received = loanRows.filter((l) => l.received_date);
      const mine = received.filter((l) => !l.cleared && l.created_by === userId);
      const next: Summary = {
        loanOpen: received.filter((l) => !l.cleared).length,
        loanOutstanding: round2(received.reduce((a, l) => a + l.outstanding, 0)),
        loanOverdue: received.filter((l) => l.overdue).length,
        loanNeedNumber: loanRows.filter((l) => !l.doc_no && !l.received_date).length,
        loanNeedApprove: loanRows.filter((l) => l.doc_no && !l.director_approved_at && !l.received_date).length,
        loanNeedPay: loanRows.filter((l) => l.director_approved_at && !l.received_date).length,
        myOutstanding: round2(mine.reduce((a, l) => a + l.outstanding, 0)),
        myOverdue: mine.filter((l) => l.overdue).length,
        fundNeedApprove: (fund.data ?? []).filter((f) => !f.director_approved_at).length,
        receiptForms: rf.count ?? 0,
        travelForms: tf.count ?? 0,
      };
      if (!cancelled) setS(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  // การ์ดเมนูการเงินอื่นต่อท้ายการ์ดของบัญชีรับ-จ่าย
  const extraCards: HubCard[] = useMemo(
    () => [
      {
        key: "loans",
        title: "สัญญายืมเงิน",
        description: "ทำสัญญายืมเงิน ติดตามการอนุมัติ ส่งใช้เงินยืม และเชื่อมกับรายงานการเดินทางไปราชการ (แบบ 8708)",
        href: "/finance/loans",
        icon: <WalletIcon className="h-6 w-6" />,
        ...(s ? { value: `${num(s.loanOpen)} สัญญา`, sub: `ค้างส่งใช้ ${baht(s.loanOutstanding)} บาท${s.loanOverdue ? ` · เกินกำหนด ${num(s.loanOverdue)} สัญญา` : ""}` } : {}),
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
        ...(s ? { value: `${num(s.receiptForms + s.travelForms)} ฉบับ`, sub: `ใบสำคัญรับเงิน ${num(s.receiptForms)} · แบบ 8708 ${num(s.travelForms)}` } : {}),
      },
      {
        key: "salary-slip",
        title: "สลิปเงินเดือน",
        description: "เปิดดูสลิปเงินเดือนจากระบบของสำนักงานเขตพื้นที่การศึกษา ด้วยเลขบัตรประชาชนและเดือน/ปี",
        href: "/finance/salary-slip",
        icon: <CoinsIcon className="h-6 w-6" />,
      },
    ],
    [s],
  );

  return <LedgerView extraCards={extraCards} topSlot={(ctx) => <FinanceTop ctx={ctx} s={s} isManager={isManager} role={role} />} />;
}

function FinanceTop({ ctx, s, isManager, role }: { ctx: LedgerOverviewCtx; s: Summary | null; isManager: boolean; role: string }) {
  // รายการรอบันทึก: ผู้บันทึก (การเงิน/แอดมิน) ledger โหลดให้แล้ว — ผู้อำนวยการ/รองฯ ไม่มีสิทธิ์บันทึกจึงโหลดเองเฉพาะตัวนับ
  const [ownPending, setOwnPending] = useState<number | null>(null);
  const needOwn = isManager && ctx.pendingCount === null;
  useEffect(() => {
    if (!needOwn) return;
    let cancelled = false;
    loadPendingSources(createClient(), ctx.fy)
      .then((rows) => {
        if (!cancelled) setOwnPending(rows.filter((p) => !p.skipped && !p.warn).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needOwn, ctx.fy]);
  const pendingCount = ctx.pendingCount ?? ownPending ?? 0;

  // ยอดเงินฝากธนาคารของแต่ละบัญชี = ช่อง "เงินฝากธนาคาร" ของทุกประเภทเงินที่ผูกกับบัญชีนั้น ณ วันนี้
  const accounts = ctx.accounts
    .filter((a) => a.is_active)
    .map((a) => ({
      ...a,
      balance: round2(ctx.types.filter((t) => t.account_id === a.id).reduce((sum, t) => sum + (ctx.balancesToday.get(t.id)?.bank ?? 0), 0)),
    }));

  const tasks: Task[] = [];
  if (isManager && pendingCount > 0)
    tasks.push({ key: "pending", label: "รายการรอบันทึกในบัญชีรับ-จ่าย", count: pendingCount, hint: "จากงานซื้อ/จ้าง ว 119 กรณีเร่งด่วน เบิกค่าใช้จ่ายโครงการ ฯลฯ", href: "/finance?view=pending", tone: "amber" });
  if (s) {
    if (isManager && s.loanNeedNumber > 0)
      tasks.push({ key: "loan-number", label: "สัญญายืมเงินรอตรวจสอบ/ออกเลขที่", count: s.loanNeedNumber, hint: "ครูยื่นแล้ว รอการเงินตรวจสอบ", href: "/finance/loans", tone: "amber" });
    if (isManager && s.loanNeedApprove > 0)
      tasks.push({ key: "loan-approve", label: "สัญญายืมเงินรอผู้อำนวยการอนุมัติ", count: s.loanNeedApprove, hint: "ออกเลขที่แล้ว รออนุมัติ", href: "/finance/loans", tone: "red" });
    if (isManager && s.loanNeedPay > 0)
      tasks.push({ key: "loan-pay", label: "สัญญายืมเงินที่อนุมัติแล้ว รอจ่ายเงิน", count: s.loanNeedPay, hint: "บันทึกวันที่จ่ายเงินให้ผู้ยืม", href: "/finance/loans", tone: "navy" });
    if (isManager && s.fundNeedApprove > 0)
      tasks.push({ key: "fund-approve", label: "ยืมเงินระหว่างประเภทเงินรอผู้อำนวยการอนุมัติ", count: s.fundNeedApprove, hint: "ต้องอนุมัติก่อนส่งใช้คืน", href: "/finance/ledger/fund-loans", tone: "red" });
    if (isManager && s.loanOverdue > 0)
      tasks.push({ key: "loan-overdue", label: "เงินยืมเกินกำหนดส่งใช้", count: s.loanOverdue, hint: "ติดตามผู้ยืมให้ส่งใช้", href: "/finance/loans", tone: "red" });
    // ผู้จัดการเห็นเกินกำหนดทุกสัญญาแล้ว (รวมของตัวเอง) จึงไม่ซ้ำ — เฉพาะบทบาทอื่นเห็นของตัวเอง
    if (!isManager && s.myOverdue > 0)
      tasks.push({ key: "my-overdue", label: "เงินยืมของท่านเกินกำหนดส่งใช้", count: s.myOverdue, hint: "กรุณาส่งใช้เงินยืม", href: "/finance/loans", tone: "red" });
    if (s.myOutstanding > 0)
      tasks.push({ key: "my-outstanding", label: "เงินยืมของท่านที่ยังค้างส่งใช้", count: 1, hint: `คงค้าง ${baht(s.myOutstanding)} บาท`, href: "/finance/loans", tone: "amber" });
  }

  const toneCls = { red: "badge-red", amber: "badge-amber", navy: "badge-navy" } as const;

  return (
    <>
      <div className="card mb-6">
        <h2 className="mb-2 font-semibold text-slate-900">งานที่ต้องทำ</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">{s ? "ไม่มีงานค้าง" : "กำลังโหลด…"}</p>
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

      {accounts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-900">บัญชีเงินฝากธนาคาร</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {accounts.map((a) => (
              <BankAccountCard
                key={a.id}
                name={a.name}
                bankName={a.bank_name}
                accountNo={a.account_no}
                balance={a.balance}
                settingsHref={role === "admin" || role === "finance_officer" ? "/finance/ledger/settings" : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
