"use server";

// สัญญาการยืมเงิน (/finance/loans) — บันทึกสัญญา/การส่งใช้ ตามระเบียบกระทรวงการคลังฯ พ.ศ. 2562 หมวด 5 (ดู src/lib/loan.ts)
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignDocNumber, docNumberTaken, isAdminUser } from "@/lib/doc-number-server";
import { LOAN_DUE_DAYS, loanBalance, loanDueDate, parseLoanType, type LoanItem } from "@/lib/loan";

type Result = { error?: string; id?: string; docNo?: string | null };
const PATH = "/finance/loans";

function rlsMessage(msg: string) {
  return msg.includes("row-level") ? "ไม่มีสิทธิ์ — ครูแก้ไขได้เฉพาะสัญญาของตัวเองที่ยังไม่ได้รับเงิน" : msg;
}

const STAFF_ROLES = ["admin", "supply_officer", "finance_officer"];

/** ผู้ใช้ปัจจุบัน — เจ้าหน้าที่ (admin/พัสดุ/การเงิน) จัดการได้ทุกสัญญา; คนอื่น (ครู) ยื่นสัญญาในชื่อตัวเองเท่านั้น */
async function currentUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("proc_profiles").select("role, full_name").eq("user_id", user?.id ?? "").maybeSingle();
  return { staff: STAFF_ROLES.includes(profile?.role ?? ""), fullName: profile?.full_name?.trim() ?? "" };
}

export async function saveLoan(id: string | null, formData: FormData): Promise<Result> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const requestDate = str("request_date");
  const supabase = await createClient();
  const me = await currentUser(supabase);
  // ครูยื่นได้เฉพาะในชื่อตัวเอง (ชื่อจากโปรไฟล์) — ส่วนวันรับเงิน/ผู้ตรวจสอบ/ผู้อนุมัติ/เลขที่ เจ้าหน้าที่การเงินเป็นผู้กรอก
  const borrower = me.staff ? str("borrower_name") : me.fullName;
  const purpose = str("purpose");
  if (!requestDate) return { error: "กรุณาระบุวันที่ยื่นสัญญา" };
  // ผู้ยืมลงวันที่ย้อนหลังไม่ได้ (แก้สัญญาเดิมที่ยื่นไว้แล้วคงวันที่เดิมได้)
  if (!me.staff && requestDate < new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)) {
    const { data: cur } = id ? await supabase.from("proc_loan_contracts").select("request_date").eq("id", id).maybeSingle() : { data: null };
    if (cur?.request_date !== requestDate) return { error: "วันที่ยื่นสัญญาต้องไม่ก่อนวันนี้" };
  }
  if (!borrower) return { error: me.staff ? "กรุณาระบุชื่อผู้ยืม" : "ยังไม่ได้ตั้งชื่อ-สกุลในโปรไฟล์ — ตั้งที่เมนูโปรไฟล์ของฉันก่อน" };
  const projectId = str("project_id") || null;
  if (!purpose && !projectId) return { error: "กรุณาระบุว่ายืมเพื่อเป็นค่าใช้จ่ายในการใด หรือเลือกโครงการ" };
  let items: LoanItem[] = [];
  try {
    items = (JSON.parse(str("items_json") || "[]") as { detail: string; amount: string }[])
      .map((i) => ({ detail: String(i.detail ?? "").trim(), amount: Math.round((Number(i.amount) || 0) * 100) / 100 }))
      .filter((i) => i.detail || i.amount);
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (items.some((i) => !i.detail)) return { error: "กรุณากรอกรายละเอียดของทุกรายการ" };
  const amount = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  if (!(amount > 0)) return { error: "จำนวนเงินยืมต้องมากกว่า 0" };

  const loanType = parseLoanType(str("loan_type"));
  const dueDays = Number(str("due_days")) || LOAN_DUE_DAYS[loanType];
  const receivedDate = me.staff ? str("received_date") || null : null;
  const travelReturnDate = loanType === "travel" ? str("travel_return_date") || null : null;
  if (receivedDate && receivedDate < requestDate) return { error: "วันที่ได้รับเงินต้องไม่ก่อนวันที่ยื่นสัญญา" };
  const fields = {
    request_date: requestDate,
    borrower_name: borrower,
    borrower_position: str("borrower_position") || null,
    fund_source: str("fund_source") || null,
    purpose,
    project_id: projectId,
    activity_id: projectId ? str("activity_id") || null : null,
    loan_type: loanType,
    travel_return_date: travelReturnDate,
    items,
    amount,
    due_days: dueDays,
    received_date: receivedDate,
    due_date: loanDueDate(loanType, dueDays, receivedDate, travelReturnDate),
    ...(me.staff ? { checker_name: str("checker_name") || null, approver_name: str("approver_name") || null } : {}),
    note: str("note") || null,
    updated_at: new Date().toISOString(),
  };

  const admin = await isAdminUser(supabase);
  const docNoInput = str("doc_no");
  if (admin && docNoInput && (await docNumberTaken(supabase, "loan", docNoInput, id ?? undefined))) return { error: `เลขที่ ${docNoInput} ถูกใช้แล้ว` };

  if (id) {
    // สัญญาที่ครูยื่นยังไม่มีเลขที่ — เจ้าหน้าที่ออกเลขให้ตอนบันทึก/ตรวจสอบครั้งแรก
    const { data: cur } = await supabase.from("proc_loan_contracts").select("doc_no").eq("id", id).maybeSingle();
    const docNo = admin && docNoInput ? docNoInput : me.staff && !cur?.doc_no ? await assignDocNumber(supabase, "loan", requestDate) : undefined;
    const { data, error } = await supabase
      .from("proc_loan_contracts")
      .update({ ...fields, ...(docNo ? { doc_no: docNo } : {}) })
      .eq("id", id)
      .select("id");
    if (error) return { error: rlsMessage(error.message) };
    if (!data?.length) return { error: "บันทึกไม่สำเร็จ — สัญญาที่การเงินจ่ายเงินแล้ว แก้ไขได้เฉพาะเจ้าหน้าที่" };
    revalidatePath(PATH);
    return { id, docNo: docNo ?? null };
  }

  // ข้อ 59 ห้ามอนุมัติให้ยืมเงินรายใหม่ เมื่อผู้ยืมยังไม่ชำระคืนเงินยืมรายเก่าให้เสร็จสิ้น
  // (นับผ่านฟังก์ชันฝั่งฐานข้อมูล — ครูมองไม่เห็นสัญญาที่เจ้าหน้าที่บันทึกแทน แต่ต้องนับด้วย)
  const { data: pending } = await supabase.rpc("proc_loan_pending", { borrower });
  if (pending && pending.length > 0)
    return {
      error: `${borrower} ยังส่งใช้เงินยืมรายเก่าไม่ครบ (สัญญาเลขที่ ${pending.join(", ")}) — ระเบียบฯ ข้อ 59 ห้ามอนุมัติให้ยืมรายใหม่จนกว่าจะชำระรายเก่าเสร็จสิ้น`,
    };

  // ครูยื่น = ยังไม่ออกเลข (นับเลขต้องเห็นทุกสัญญา) เจ้าหน้าที่การเงินออกเลขตอนตรวจสอบ
  const docNo = admin && docNoInput ? docNoInput : me.staff ? await assignDocNumber(supabase, "loan", requestDate) : null;
  const { data, error } = await supabase.from("proc_loan_contracts").insert({ ...fields, doc_no: docNo }).select("id").single();
  if (error) return { error: rlsMessage(error.message) };
  revalidatePath(PATH);
  return { id: data.id, docNo };
}

export async function deleteLoan(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_loan_contracts").delete().eq("id", id).select("id");
  if (error) return { error: rlsMessage(error.message) };
  if (!data?.length) return { error: "ลบไม่สำเร็จ (ไม่มีสิทธิ์ หรือไม่พบสัญญา)" };
  revalidatePath(PATH);
  return {};
}

/** บันทึกการส่งใช้ (ข้อ 66 — เจ้าหน้าที่ผู้รับคืนบันทึกการรับคืนในสัญญาการยืมเงิน) */
export async function addRepayment(loanId: string, formData: FormData): Promise<Result> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const repayDate = str("repay_date");
  const cash = Math.round((Number(str("cash_amount")) || 0) * 100) / 100;
  const voucher = Math.round((Number(str("voucher_amount")) || 0) * 100) / 100;
  if (!repayDate) return { error: "กรุณาระบุวันที่ส่งใช้" };
  if (cash < 0 || voucher < 0 || cash + voucher <= 0) return { error: "กรุณาระบุจำนวนเงินสดหรือใบสำคัญที่ส่งใช้" };
  const supabase = await createClient();
  const { data: loan } = await supabase.from("proc_loan_contracts").select("amount, request_date, proc_loan_repayments(cash_amount, voucher_amount)").eq("id", loanId).maybeSingle();
  if (!loan) return { error: "ไม่พบสัญญา" };
  if (repayDate < loan.request_date) return { error: "วันที่ส่งใช้ต้องไม่ก่อนวันที่ยื่นสัญญา" };
  const { outstanding } = loanBalance(Number(loan.amount), loan.proc_loan_repayments ?? []);
  if (cash + voucher > outstanding + 0.001) return { error: `ส่งใช้เกินยอดคงค้าง (คงค้าง ${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท)` };
  const { error } = await supabase.from("proc_loan_repayments").insert({
    loan_id: loanId,
    repay_date: repayDate,
    cash_amount: cash,
    voucher_amount: voucher,
    voucher_count: Number(str("voucher_count")) || null,
    receipt_no: str("receipt_no") || null,
    note: str("note") || null,
  });
  if (error) return { error: rlsMessage(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function deleteRepayment(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_loan_repayments").delete().eq("id", id).select("id");
  if (error) return { error: rlsMessage(error.message) };
  if (!data?.length) return { error: "ลบไม่สำเร็จ" };
  revalidatePath(PATH);
  return {};
}
