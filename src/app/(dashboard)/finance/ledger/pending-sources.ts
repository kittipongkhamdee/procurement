// รายการจากงานอื่นที่รอบันทึกในบัญชีรับ-จ่าย (ระยะที่ 2) — ดึงฝั่ง client ตามสิทธิ์อ่านปกติ (ทุกตารางต้นทาง select ได้ทุกคน)
// เงื่อนไข "พร้อมบันทึก":
// - งานซื้อ/จ้าง/ว 804: ทุกรายการของปีงบ (ตามวันที่บันทึก) ที่ไม่ได้ชำระด้วยเงินยืม (จ่ายด้วยเงินยืม = เงินออกตอนจ่ายเงินยืมแล้ว)
//   ยังไม่ตรวจรับ (inspected_date ว่าง) แสดงในรายการแต่บันทึกไม่ได้ — ตามระเบียบจ่ายเงินหลังตรวจรับพัสดุแล้วเท่านั้น (ตรวจซ้ำฝั่ง server)
// - ว 119 / กรณีเร่งด่วน / เบิกค่าใช้จ่ายโครงการ: มีรายงานแล้ว (ซื้อ/จ่ายไปก่อนแล้วรายงาน)
// - สัญญายืมเงิน: การเงินบันทึกจ่ายเงินแล้ว (received_date) → รายการจ่าย
// - ส่งใช้เงินยืม: ส่วนที่คืนเป็นเงินสด (cash_amount > 0) → รายการรับ (ส่วนใบสำคัญไม่มีเงินเคลื่อนไหว)
// ไม่รวมรายการที่ผูกกับ fin_transactions แล้ว หรือที่การเงินกด "ไม่ต้องบันทึก" (fin_source_skips)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { fiscalRange, sourceDoneDate, type DocKind, type MoneyType, type SourceKind, type TxnKind } from "@/lib/finance-ledger";

export type PendingItem = {
  kind: SourceKind;
  id: string;
  date: string;
  ref: string;
  description: string;
  payee: string | null;
  amount: number;
  txnKind: TxnKind;
  docKind: DocKind | "";
  docNo: string | null;
  projectId: string | null;
  activityId: string | null;
  fundHint: string | null;
  note: string;
  href: string;
  skipped: boolean;
  /** วันที่งานต้นทางเสร็จสิ้น — วันที่จ่าย/รับจริงต้องไม่ก่อนวันนี้ (ฟอร์มไม่เติมวันที่ให้ ผู้บันทึกเลือกวันจ่ายจริงเอง) */
  doneDate: string;
  /** คำเตือนสั้นๆ เช่น "ยังไม่ตรวจรับ" — มีค่านี้ = ยังบันทึกไม่ได้ */
  warn?: string;
};

/** เดาประเภทเงินจากชื่อแหล่งเงินของงานต้นทาง — ตรง/อยู่ในชื่อกันได้ประเภทเดียวเท่านั้นจึงเลือกให้ */
export function guessMoneyType(types: MoneyType[], hint: string | null): string {
  const h = (hint ?? "").replace(/\s+/g, "");
  if (!h) return "";
  const active = types.filter((t) => t.is_active);
  const exact = active.filter((t) => t.name.replace(/\s+/g, "") === h);
  if (exact.length === 1) return exact[0].id;
  const loose = active.filter((t) => {
    const n = t.name.replace(/\s+/g, "");
    return n.includes(h) || h.includes(n);
  });
  return loose.length === 1 ? loose[0].id : "";
}

const voucherOf = (receiptType: string | null): DocKind => (receiptType?.includes("ใบสำคัญรับเงิน") ? "บค" : "บจ");

export async function loadPendingSources(supabase: SupabaseClient<Database>, fy: number): Promise<PendingItem[]> {
  const [from, to] = fiscalRange(fy);
  const [linked, skips, pr, w119, urgent, claims, loans, repays] = await Promise.all([
    supabase.from("fin_transactions").select("source_kind, source_id").not("source_id", "is", null),
    supabase.from("fin_source_skips").select("source_kind, source_id"),
    supabase
      .from("proc_purchase_requests")
      .select("id, doc_no, doc_type, method, item_name, amount, inspected_date, record_date, order_date, delivered_date, report_date, funding, receipt_type, receipt_no, project_id, activity_id, proc_vendors(name)")
      .gte("record_date", from)
      .lte("record_date", to),
    supabase.from("proc_w119_reports").select("id, doc_no, record_date, purchase_date, purpose, amount, fund_source, project_id, activity_id, proc_w119_items(vendor, seq)").gte("record_date", from).lte("record_date", to),
    supabase.from("proc_urgent_reports").select("id, doc_no, doc_type, record_date, purchase_date, receipt_date, subject, amount, payee, receipt_type, receipt_no, project_id, activity_id").gte("record_date", from).lte("record_date", to),
    supabase.from("proc_expense_claims").select("id, doc_no, record_date, event_date, event_end_date, event_name, amount, fund_source, responsible_name, project_id, activity_id").gte("record_date", from).lte("record_date", to),
    supabase.from("proc_loan_contracts").select("id, doc_no, borrower_name, purpose, amount, received_date, fund_source, project_id, activity_id").not("received_date", "is", null).gte("received_date", from).lte("received_date", to),
    supabase.from("proc_loan_repayments").select("id, loan_id, repay_date, cash_amount, receipt_no, proc_loan_contracts(doc_no, borrower_name, fund_source, project_id, activity_id)").gt("cash_amount", 0).gte("repay_date", from).lte("repay_date", to),
  ]);
  const key = (k: string | null, id: string | null) => `${k}|${id}`;
  const done = new Set((linked.data ?? []).map((r) => key(r.source_kind, r.source_id)));
  const skipped = new Set((skips.data ?? []).map((r) => key(r.source_kind, r.source_id)));
  const out: PendingItem[] = [];
  const push = (it: Omit<PendingItem, "skipped">) => {
    if (done.has(key(it.kind, it.id))) return;
    out.push({ ...it, skipped: skipped.has(key(it.kind, it.id)) });
  };

  for (const r of pr.data ?? []) {
    if (r.funding === "loan") continue;
    const vendor = (r.proc_vendors as unknown as { name: string } | null)?.name ?? null;
    const label = r.method === "w804" ? "ซื้อ (ว 804)" : r.doc_type;
    push({
      kind: "purchase",
      id: r.id,
      doneDate: sourceDoneDate("purchase", r as unknown as Record<string, unknown>),
      date: r.inspected_date ?? r.record_date,
      warn: r.inspected_date ? undefined : "ยังไม่ตรวจรับ",
      ref: `รายงานขอ${label} ${r.doc_no ?? ""}`.trim(),
      description: `จ่ายเงินค่า${r.doc_type === "จ้าง" ? "จ้าง" : ""}${r.item_name ?? ""}`.trim(),
      payee: vendor,
      amount: Number(r.amount ?? 0),
      txnKind: "pay",
      docKind: voucherOf(r.receipt_type),
      docNo: null,
      projectId: r.project_id,
      activityId: r.activity_id,
      fundHint: null,
      note: `อ้างอิงรายงานขอ${label} เลขที่ ${r.doc_no ?? "-"}${r.receipt_no ? ` · ใบเสร็จ ${r.receipt_no}` : ""}`,
      href: r.method === "w804" ? "/supplies/w804" : r.doc_type === "จ้าง" ? "/supplies/hire" : "/supplies/purchase",
    });
  }
  for (const r of w119.data ?? []) {
    const items = ((r.proc_w119_items as unknown as { vendor: string | null; seq: number }[] | null) ?? []).sort((a, b) => a.seq - b.seq);
    push({
      kind: "w119",
      id: r.id,
      doneDate: sourceDoneDate("w119", r as unknown as Record<string, unknown>),
      date: r.record_date,
      ref: `ว 119 ${r.doc_no ?? ""}`.trim(),
      description: `จ่ายเงินค่า${r.purpose ?? ""}`.trim(),
      payee: items.find((i) => i.vendor)?.vendor ?? null,
      amount: Number(r.amount ?? 0),
      txnKind: "pay",
      docKind: "บจ",
      docNo: null,
      projectId: r.project_id,
      activityId: r.activity_id,
      fundHint: r.fund_source,
      note: `อ้างอิงรายงาน ว 119 เลขที่ ${r.doc_no ?? "-"}`,
      href: "/supplies/w119",
    });
  }
  for (const r of urgent.data ?? []) {
    push({
      kind: "urgent",
      id: r.id,
      doneDate: sourceDoneDate("urgent", r as unknown as Record<string, unknown>),
      date: r.record_date,
      ref: `เร่งด่วน ${r.doc_no ?? ""}`.trim(),
      description: `จ่ายเงินค่า${r.subject ?? ""}`.trim(),
      payee: r.payee,
      amount: Number(r.amount ?? 0),
      txnKind: "pay",
      docKind: voucherOf(r.receipt_type),
      docNo: null,
      projectId: r.project_id,
      activityId: r.activity_id,
      fundHint: null,
      note: `อ้างอิงรายงานกรณีเร่งด่วน เลขที่ ${r.doc_no ?? "-"}${r.receipt_no ? ` · ใบเสร็จ ${r.receipt_no}` : ""}`,
      href: "/supplies/urgent",
    });
  }
  for (const r of claims.data ?? []) {
    push({
      kind: "claim",
      id: r.id,
      doneDate: sourceDoneDate("claim", r as unknown as Record<string, unknown>),
      date: r.record_date,
      ref: `เบิกค่าใช้จ่าย ${r.doc_no ?? ""}`.trim(),
      description: `จ่ายค่าใช้จ่ายในการจัด${r.event_name ?? "กิจกรรม"}`,
      payee: r.responsible_name,
      amount: Number(r.amount ?? 0),
      txnKind: "pay",
      docKind: "บค",
      docNo: null,
      projectId: r.project_id,
      activityId: r.activity_id,
      fundHint: r.fund_source,
      note: `อ้างอิงเบิกค่าใช้จ่ายโครงการ (ตาราง 2) เลขที่ ${r.doc_no ?? "-"}`,
      href: "/supplies/expense-claims",
    });
  }
  for (const r of loans.data ?? []) {
    push({
      kind: "loan",
      id: r.id,
      doneDate: sourceDoneDate("loan", r as unknown as Record<string, unknown>),
      date: r.received_date!,
      ref: `สัญญายืมเงิน ${r.doc_no ?? ""}`.trim(),
      description: `จ่ายเงินยืมตามสัญญาการยืมเงินเลขที่ ${r.doc_no ?? "-"}${r.purpose ? ` — ${r.purpose}` : ""}`,
      payee: r.borrower_name,
      amount: Number(r.amount ?? 0),
      txnKind: "pay",
      docKind: "",
      docNo: r.doc_no ? `สัญญายืม ${r.doc_no}` : null,
      projectId: r.project_id,
      activityId: r.activity_id,
      fundHint: r.fund_source,
      note: "",
      href: "/finance/loans",
    });
  }
  for (const r of repays.data ?? []) {
    const loan = r.proc_loan_contracts as unknown as { doc_no: string | null; borrower_name: string; fund_source: string | null; project_id: string | null; activity_id: string | null } | null;
    push({
      kind: "loan_repay",
      id: r.id,
      doneDate: sourceDoneDate("loan_repay", r as unknown as Record<string, unknown>),
      date: r.repay_date,
      ref: `ส่งใช้เงินยืม ${loan?.doc_no ?? ""}`.trim(),
      description: `รับคืนเงินยืม (เงินสด) ตามสัญญาการยืมเงินเลขที่ ${loan?.doc_no ?? "-"}`,
      payee: loan?.borrower_name ?? null,
      amount: Number(r.cash_amount ?? 0),
      txnKind: "receive",
      docKind: "บร",
      docNo: r.receipt_no,
      projectId: loan?.project_id ?? null,
      activityId: loan?.activity_id ?? null,
      fundHint: loan?.fund_source ?? null,
      note: "",
      href: "/finance/loans",
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
