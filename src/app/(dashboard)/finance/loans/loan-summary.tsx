"use client";

// ข้อมูลสัญญายืมเงินที่ใช้ร่วมกัน: หน้า /finance/loans และแผงรอพิจารณาของผู้อำนวยการในหน้าแดชบอร์ด

import { formatThaiDate } from "@/lib/thai";
import { LOAN_DUE_RULE, LOAN_TYPE_LABEL, parseLoanType, type LoanItem, type LoanRepayment } from "@/lib/loan";

export type Loan = {
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
  checked_date: string | null;
  checker_name: string | null;
  approver_name: string | null;
  director_approved_at: string | null;
  director_approved_by_name: string | null;
  note: string | null;
  created_by: string | null;
  proc_loan_repayments: LoanRepayment[];
};

/** select ของ proc_loan_contracts ที่ได้รูปแบบ Loan */
export const LOAN_SELECT = "*, proc_loan_repayments(*), plan_projects(name), plan_activities(name)";

export const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** วันที่ + เวลา (เวลาไทย) เช่น 20 ต.ค. 2569 เวลา 15:42 น. */
export function formatThaiDateTime(iso: string) {
  const d = new Date(iso);
  const ymd = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const hm = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  return `${formatThaiDate(ymd)} เวลา ${hm} น.`;
}

export function loanPurpose(r: Pick<Loan, "purpose" | "plan_projects" | "plan_activities">) {
  return [r.purpose, r.plan_projects && `โครงการ${r.plan_projects.name.replace(/^โครงการ\s*/, "")}`, r.plan_activities?.name && `กิจกรรม${r.plan_activities.name.replace(/^กิจกรรม\s*/, "")}`].filter(Boolean).join(" ");
}

export function LoanSummary({ loan }: { loan: Loan }) {
  const rows: [string, React.ReactNode][] = [
    ["เลขที่สัญญา", loan.doc_no ?? <span className="text-amber-700">ยังไม่ออกเลขที่</span>],
    ["วันที่ยื่น", formatThaiDate(loan.request_date)],
    ["ผู้ยืม", `${loan.borrower_name}${loan.borrower_position ? ` (${loan.borrower_position})` : ""}`],
    ["ขอยืมเงินจาก", loan.fund_source ?? "-"],
    ["เพื่อเป็นค่าใช้จ่ายในการ", loanPurpose(loan) || "-"],
    ["ลักษณะการยืม", `${LOAN_TYPE_LABEL[parseLoanType(loan.loan_type)]} — ${LOAN_DUE_RULE[parseLoanType(loan.loan_type)]}`],
    ["วันที่การเงินตรวจสอบ", loan.checked_date ? formatThaiDate(loan.checked_date) : "-"],
    [
      "ผู้อำนวยการอนุมัติ",
      loan.director_approved_at ? (
        <span className="text-emerald-700">
          อนุมัติแล้ว {formatThaiDateTime(loan.director_approved_at)}
          {loan.director_approved_by_name && <> — {loan.director_approved_by_name}</>}
        </span>
      ) : loan.received_date ? (
        "-"
      ) : (
        <span className="text-amber-700">{loan.doc_no ? "รอผู้อำนวยการอนุมัติ" : "รอการเงินตรวจสอบก่อน"}</span>
      ),
    ],
    ["วันที่ได้รับเงิน", loan.received_date ? formatThaiDate(loan.received_date) : "-"],
    ["วันครบกำหนดส่งใช้", loan.due_date ? formatThaiDate(loan.due_date) : "-"],
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="mb-1 min-w-0 break-words text-slate-900 sm:mb-0">{v}</dd>
          </div>
        ))}
      </dl>
      <table className="table-base w-full">
        <thead>
          <tr>
            <th>รายละเอียด</th>
            <th className="text-right">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          {loan.items.map((it, i) => (
            <tr key={i}>
              <td>{it.detail}</td>
              <td className="text-right tabular-nums">{baht(Number(it.amount))}</td>
            </tr>
          ))}
          <tr>
            <td className="font-semibold">รวม</td>
            <td className="text-right font-semibold tabular-nums">{baht(loan.amount)}</td>
          </tr>
        </tbody>
      </table>
      {loan.note && <p className="text-slate-600">หมายเหตุ: {loan.note}</p>}
    </div>
  );
}
