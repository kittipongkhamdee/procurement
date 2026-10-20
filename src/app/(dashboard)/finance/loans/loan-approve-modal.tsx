"use client";

// ผู้อำนวยการพิจารณาอนุมัติสัญญายืมเงิน (หลังการเงินตรวจสอบ/ออกเลขที่ ก่อนจ่ายเงิน) — ใช้ทั้งหน้า /finance/loans
// และแผงรอพิจารณาในหน้าแดชบอร์ด (trigger ส่งเข้ามาได้ ให้แผงใช้ทั้งแถวรายการเป็นปุ่มเปิด)

import { useRef, useState } from "react";
import { confirmWarning, toastError, toastSuccess } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { approveLoan } from "./actions";
import { LoanSummary, type Loan } from "./loan-summary";

export function ApproveLoanModal({
  loan,
  onSaved,
  trigger,
  triggerClassName,
}: {
  loan: Loan;
  onSaved: () => void;
  trigger?: React.ReactNode;
  triggerClassName?: string;
}) {
  const ref = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  // ลำดับวันที่: การเงินตรวจสอบ ≤ วันที่อนุมัติ (วันนี้) — กันกรณีวันที่ตรวจสอบลงล่วงหน้า (ข้อมูลเก่า)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const notYet = !!loan.checked_date && loan.checked_date > today;
  async function approve() {
    setSaving(true);
    try {
      const res = await approveLoan(loan.id, true);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess("อนุมัติแล้ว — การเงินจ่ายเงินยืมได้");
      ref.current?.close();
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      ref={ref}
      title={`พิจารณาอนุมัติสัญญายืมเงิน — สัญญาเลขที่ ${loan.doc_no ?? "-"}`}
      wide
      lazy
      triggerClassName={triggerClassName}
      trigger={
        trigger ?? (
          <span title="ผู้อำนวยการอนุมัติ" className="btn-primary btn-sm">
            <CheckIcon className="h-3.5 w-3.5" />
            <span className="btn-label">อนุมัติ</span>
          </span>
        )
      }
    >
      <LoanSummary loan={loan} />
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
        เมื่ออนุมัติ ระบบบันทึกวันที่และเวลาที่กดอนุมัติ (วันนี้) ไว้ในรายละเอียดสัญญา แล้วการเงินจึงบันทึกจ่ายเงินได้
      </p>
      {notYet && <p className="mt-2 text-sm text-red-600">วันที่การเงินตรวจสอบยังไม่ถึง — อนุมัติได้ตั้งแต่วันที่การเงินตรวจสอบ</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
          ปิด
        </button>
        <button type="button" onClick={approve} disabled={saving || notYet} className="btn-primary">
          {saving ? "กำลังบันทึก..." : "อนุมัติให้ยืม"}
        </button>
      </div>
    </Modal>
  );
}

/** ยกเลิกการอนุมัติ (ทำได้ก่อนการเงินจ่ายเงิน) — เช่น อนุมัติผิดสัญญา หรือต้องให้ผู้ยืมแก้ยอด */
export function CancelLoanApprovalButton({ loan, onSaved }: { loan: Loan; onSaved: () => void }) {
  async function cancel() {
    if (!(await confirmWarning({ title: "ยกเลิกการอนุมัติ?", text: `สัญญาเลขที่ ${loan.doc_no ?? "-"} จะกลับไปรอผู้อำนวยการอนุมัติ`, confirmButtonText: "ยกเลิกอนุมัติ" }))) return;
    const res = await approveLoan(loan.id, false);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ยกเลิกการอนุมัติแล้ว");
    onSaved();
  }
  return (
    <button type="button" onClick={cancel} title="ยกเลิกการอนุมัติ" className="btn-secondary btn-sm">
      <CloseIcon className="h-3.5 w-3.5" />
      <span className="btn-label">ยกเลิกอนุมัติ</span>
    </button>
  );
}
