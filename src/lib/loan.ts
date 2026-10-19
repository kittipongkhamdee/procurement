// สัญญาการยืมเงิน — กำหนดส่งใช้ตามระเบียบกระทรวงการคลังว่าด้วยการเบิกเงินจากคลัง การรับเงิน การจ่ายเงิน
// การเก็บรักษาเงิน และการนำเงินส่งคลัง พ.ศ. 2562 ข้อ 65:
//  (2) เดินทางไปราชการ → ส่งใช้ภายใน 15 วันนับแต่วันกลับมาถึง
//  (3) ปฏิบัติราชการอื่น (จัดซื้อ/จัดกิจกรรม ฯลฯ) → ภายใน 30 วันนับแต่วันได้รับเงิน
// ข้อ 59 ห้ามอนุมัติให้ยืมรายใหม่ถ้าผู้ยืมยังไม่ชำระคืนรายเก่าให้เสร็จสิ้น

export type LoanType = "travel" | "other";
export const LOAN_TYPE_LABEL: Record<LoanType, string> = {
  other: "ปฏิบัติราชการอื่น (จัดซื้อ/จัดจ้าง/จัดกิจกรรม) — ส่งใช้ภายใน 30 วันนับแต่วันได้รับเงิน",
  travel: "เดินทางไปราชการ — ส่งใช้ภายใน 15 วันนับแต่วันกลับมาถึง",
};
export const LOAN_DUE_DAYS: Record<LoanType, number> = { other: 30, travel: 15 };

export type LoanItem = { detail: string; amount: number };
export type LoanRepayment = { id: string; repay_date: string; cash_amount: number; voucher_amount: number; voucher_count: number | null; receipt_no: string | null; note: string | null };

export function parseLoanType(v: unknown): LoanType {
  return v === "travel" ? "travel" : "other";
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** วันครบกำหนดส่งใช้ — ยังไม่ได้รับเงิน (หรือเดินทางแต่ยังไม่ระบุวันกลับ) = ยังไม่มีกำหนด */
export function loanDueDate(type: LoanType, dueDays: number, receivedDate: string | null, travelReturnDate: string | null): string | null {
  const base = type === "travel" ? travelReturnDate : receivedDate;
  return base ? addDays(base, dueDays) : null;
}

/** ยอดส่งใช้แล้ว / คงค้าง / สถานะ */
export function loanBalance(amount: number, repayments: Pick<LoanRepayment, "cash_amount" | "voucher_amount">[]) {
  const repaid = Math.round(repayments.reduce((s, r) => s + Number(r.cash_amount) + Number(r.voucher_amount), 0) * 100) / 100;
  const outstanding = Math.round((Number(amount) - repaid) * 100) / 100;
  return { repaid, outstanding: Math.max(outstanding, 0), cleared: outstanding <= 0 };
}

export function isOverdue(dueDate: string | null, cleared: boolean, today = new Date().toISOString().slice(0, 10)) {
  return !cleared && !!dueDate && dueDate < today;
}
