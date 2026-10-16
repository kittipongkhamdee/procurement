"use client";

// ช่อง "อ้างอิงบันทึกขออนุมัติ" ใช้ร่วมกันใน ว.119 และเบิกค่าใช้จ่ายโครงการ (ตาราง 2) — ตัดยอดจากวงเงินที่ขออนุมัติ
// รวมกับงานซื้อ/จ้าง (ดู src/lib/approval-budget.ts)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { approvalUsage } from "@/lib/approval-budget";

export type ApprovalRefOption = {
  id: string;
  doc_number: string | null;
  subject: string;
  activity_name: string | null;
  department: string | null;
  project_id: string | null;
  requested_amount: number;
  status: string;
  /** ยอดที่ใช้ไปแล้วจากทุกเมนู */
  used: number;
};

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** บันทึกขออนุมัติในปีงบประมาณ (ไม่รวมที่ไม่อนุมัติ) พร้อมยอดที่ใช้ไปแล้ว */
export async function loadApprovalRefs(supabase: SupabaseClient<Database>, budgetYear: number | null): Promise<ApprovalRefOption[]> {
  let q = supabase
    .from("proc_approvals")
    .select("id, doc_number, subject, activity_name, department, project_id, requested_amount, status")
    .neq("status", "ไม่อนุมัติ");
  if (budgetYear) {
    const ce = budgetYear - 543;
    q = q.gte("doc_date", `${ce - 1}-10-01`).lte("doc_date", `${ce}-09-30`);
  }
  const [{ data }, used] = await Promise.all([q.order("doc_date", { ascending: false }), approvalUsage(supabase)]);
  return (data ?? []).map((a) => ({ ...a, requested_amount: Number(a.requested_amount), used: used.get(a.id) ?? 0 }));
}

/** วงเงินคงเหลือ (บวกยอดเดิมของรายการนี้คืนตอนแก้ไข) */
export function approvalRemaining(a: ApprovalRefOption | null, own?: { approvalId: string | null; amount: number }) {
  if (!a) return null;
  const back = own?.approvalId === a.id ? own.amount : 0;
  return Math.round((a.requested_amount - a.used + back) * 100) / 100;
}

export function ApprovalRefField({
  approvals,
  value,
  onChange,
  total,
  own,
}: {
  approvals: ApprovalRefOption[];
  value: string;
  onChange: (a: ApprovalRefOption | null, id: string) => void;
  total: number;
  own?: { approvalId: string | null; amount: number };
}) {
  const approval = approvals.find((a) => a.id === value) ?? null;
  const remaining = approvalRemaining(approval, own);
  return (
    <div className="sm:col-span-2">
      <label className="label">
        อ้างอิงบันทึกขออนุมัติ <span className="text-red-600">*</span>
      </label>
      <select
        name="approval_id"
        value={value}
        onChange={(e) => onChange(approvals.find((a) => a.id === e.target.value) ?? null, e.target.value)}
        required
        className="input w-full"
      >
        <option value="">-- เลือกบันทึกขออนุมัติ --</option>
        {approvals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.doc_number ?? "(ไม่มีเลขที่)"} · {a.activity_name || a.subject} · {baht(a.requested_amount)} บาท{a.status === "อนุมัติ" ? "" : ` (${a.status})`}
          </option>
        ))}
      </select>
      {approval && remaining != null && (
        <p className={`mt-1 text-xs ${total > remaining + 0.005 ? "text-red-600" : "text-slate-500"}`}>
          วงเงินที่ขออนุมัติ {baht(approval.requested_amount)} บาท · ใช้ไปแล้ว {baht(approval.requested_amount - remaining)} บาท · คงเหลือ {baht(remaining)} บาท
          {total > remaining + 0.005 ? " — ยอดรายการเกินวงเงินคงเหลือ" : ""}
        </p>
      )}
      {approval && approval.status !== "อนุมัติ" && (
        <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
          ⚠ บันทึกขออนุมัตินี้ยัง &quot;{approval.status}&quot; — บันทึกไว้ได้ (วงเงินถูกกันไว้แล้ว) แต่พิมพ์เอกสารได้เมื่อผู้อำนวยการอนุมัติแล้ว
        </p>
      )}
      {approvals.length === 0 && <p className="mt-1 text-xs text-red-600">ยังไม่มีบันทึกขออนุมัติในปีงบประมาณนี้ — ต้องทำบันทึกขออนุมัติก่อน</p>}
    </div>
  );
}
