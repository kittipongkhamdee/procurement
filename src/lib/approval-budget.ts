import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// ใช้ได้ทั้งฝั่ง server action และฝั่ง client (แสดงวงเงินคงเหลือในฟอร์ม)
type Supabase = SupabaseClient<Database>;
/** ตารางที่ตัดยอดจากบันทึกขออนุมัติ — งานซื้อ/จ้าง/ว 804, รายงาน ว 119, เบิกค่าใช้จ่ายโครงการ (ตาราง 2), จัดซื้อ/จัดจ้างกรณีเร่งด่วน */
export type ApprovalUser = "purchase" | "w119" | "claim" | "urgent";
const TABLES = { purchase: "proc_purchase_requests", w119: "proc_w119_reports", claim: "proc_expense_claims", urgent: "proc_urgent_reports" } as const;

/** ยอดที่ใช้ไปแล้วของบันทึกขออนุมัติแต่ละฉบับ (รวมทุกเมนู) */
export async function approvalUsage(supabase: Supabase, exclude?: { kind: ApprovalUser; id: string }) {
  const used = new Map<string, number>();
  await Promise.all(
    (Object.keys(TABLES) as ApprovalUser[]).map(async (kind) => {
      let q = supabase.from(TABLES[kind]).select("id, approval_id, amount").not("approval_id", "is", null);
      if (exclude?.kind === kind) q = q.neq("id", exclude.id);
      const { data } = await q;
      (data ?? []).forEach((r) => used.set(r.approval_id as string, (used.get(r.approval_id as string) ?? 0) + Number(r.amount)));
    }),
  );
  return used;
}

/** ยอดรวมทุกเมนูที่อ้างอิงบันทึกขออนุมัติเดียวกัน (ไม่นับรายการที่กำลังแก้) + ยอดนี้ ต้องไม่เกินวงเงินที่ขออนุมัติ */
export async function checkApprovalBudget(
  supabase: Supabase,
  approvalId: string,
  amount: number,
  recordDate: string,
  exclude?: { kind: ApprovalUser; id: string },
) {
  const { data: approval } = await supabase.from("proc_approvals").select("requested_amount, status, doc_date").eq("id", approvalId).maybeSingle();
  if (!approval) return "ไม่พบบันทึกขออนุมัติที่อ้างอิง";
  if (approval.status === "ไม่อนุมัติ") return "บันทึกขออนุมัติที่อ้างอิงไม่ได้รับอนุมัติ";
  if (approval.doc_date && recordDate < approval.doc_date) return "วันที่บันทึกต้องไม่ก่อนวันที่บันทึกขออนุมัติที่อ้างอิง";
  const used = (await approvalUsage(supabase, exclude)).get(approvalId) ?? 0;
  const remaining = Math.round((Number(approval.requested_amount) - used) * 100) / 100;
  if (amount > remaining + 0.005) {
    return `ยอดรวมเกินวงเงินคงเหลือของบันทึกขออนุมัติ (คงเหลือ ${remaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท)`;
  }
  return null;
}
