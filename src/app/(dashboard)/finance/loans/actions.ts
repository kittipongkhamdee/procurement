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

/** วันนี้ตามเวลาไทย (ISO) — วันที่ของขั้นตอนที่เกิดขึ้นแล้ว (ตรวจสอบ/รับเงิน/ส่งใช้) ลงล่วงหน้าไม่ได้ */
function todayTh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
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
  // จำนวนวันส่งใช้ตามระเบียบฯ ข้อ 65 เท่านั้น (30 / 15 วัน) — ไม่รับค่าที่กรอกเอง
  const dueDays = LOAN_DUE_DAYS[loanType];
  const receivedDate = me.staff ? str("received_date") || null : null;
  const travelReturnDate = loanType === "travel" ? str("travel_return_date") || null : null;
  if (receivedDate && receivedDate < requestDate) return { error: "วันที่ได้รับเงินต้องไม่ก่อนวันที่ยื่นสัญญา" };
  if (receivedDate && receivedDate > todayTh()) return { error: "วันที่ได้รับเงินลงล่วงหน้าไม่ได้" };
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
    // ลำดับวันที่: ยื่น ≤ การเงินตรวจสอบ ≤ รับเงิน ≤ ส่งใช้ครั้งแรก
    const { data: cur } = await supabase.from("proc_loan_contracts").select("checked_date, amount, director_approved_at, proc_loan_repayments(repay_date)").eq("id", id).maybeSingle();
    // ผู้อำนวยการอนุมัติแล้ว: ผู้ยืมแก้ไม่ได้ (RLS) / เจ้าหน้าที่แก้รายละเอียดได้ (เช่น วันกลับ) แต่เปลี่ยนยอดเงินไม่ได้ — แอดมินแก้ได้กรณีจำเป็น
    if (cur?.director_approved_at && !admin && (!me.staff || Math.abs(Number(cur.amount) - amount) > 0.001))
      return { error: "ผู้อำนวยการอนุมัติแล้ว แก้ไขยอดเงินไม่ได้ — ให้ผู้อำนวยการยกเลิกอนุมัติก่อน" };
    if (cur?.checked_date && requestDate > cur.checked_date) return { error: "วันที่ยื่นสัญญาต้องไม่หลังวันที่การเงินตรวจสอบ" };
    if (cur?.checked_date && receivedDate && receivedDate < cur.checked_date) return { error: "วันที่ได้รับเงินต้องไม่ก่อนวันที่การเงินตรวจสอบ" };
    const firstRepay = (cur?.proc_loan_repayments ?? []).reduce((m, x) => (!m || x.repay_date < m ? x.repay_date : m), "");
    if (firstRepay && receivedDate && receivedDate > firstRepay) return { error: "วันที่ได้รับเงินต้องไม่หลังวันที่ส่งใช้ครั้งแรก" };
    // แก้ไขไม่ออกเลขให้เอง — สัญญาที่ครูยื่น การเงินออกเลขที่ด้วยปุ่ม "ออกเลขที่" (issueLoanNumber) แอดมินแก้เลขได้ที่นี่
    const docNo = admin && docNoInput ? docNoInput : undefined;
    const { data, error } = await supabase
      .from("proc_loan_contracts")
      .update({ ...fields, ...(docNo ? { doc_no: docNo } : {}) })
      .eq("id", id)
      .select("id");
    if (error) return { error: rlsMessage(error.message) };
    if (!data?.length) return { error: "บันทึกไม่สำเร็จ — สัญญาที่การเงินจ่ายเงินแล้ว แก้ไขได้เฉพาะเจ้าหน้าที่" };
    await rememberPosition(supabase, borrower, fields.borrower_position);
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
  await rememberPosition(supabase, borrower, fields.borrower_position);
  revalidatePath(PATH);
  return { id: data.id, docNo };
}

/** จำตำแหน่งผู้ยืมไว้กับชื่อ ให้ฟอร์มครั้งต่อไป (และฟอร์มจัดซื้อจัดจ้าง) เติมให้อัตโนมัติ — บันทึกไม่สำเร็จก็ไม่กระทบสัญญา */
async function rememberPosition(supabase: Awaited<ReturnType<typeof createClient>>, name: string, position: string | null) {
  if (!name || !position) return;
  await supabase.from("proc_teacher_positions").upsert({ teacher_name: name, position, updated_at: new Date().toISOString() });
}

export async function deleteLoan(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("proc_loan_contracts").select("director_approved_at").eq("id", id).maybeSingle();
  if (cur?.director_approved_at && !(await isAdminUser(supabase))) return { error: "ผู้อำนวยการอนุมัติแล้ว ลบไม่ได้" };
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
  if (repayDate > todayTh()) return { error: "วันที่ส่งใช้ลงล่วงหน้าไม่ได้" };
  if (cash < 0 || voucher < 0 || cash + voucher <= 0) return { error: "กรุณาระบุจำนวนเงินสดหรือใบสำคัญที่ส่งใช้" };
  const supabase = await createClient();
  const { data: loan } = await supabase.from("proc_loan_contracts").select("amount, request_date, received_date, proc_loan_repayments(cash_amount, voucher_amount, repay_date)").eq("id", loanId).maybeSingle();
  if (!loan) return { error: "ไม่พบสัญญา" };
  if (!loan.received_date) return { error: "ยังไม่ได้บันทึกจ่ายเงินยืม — กด \"บันทึกจ่ายเงิน\" ก่อน" };
  // ลำดับวันที่: ยื่น ≤ การเงินตรวจสอบ ≤ รับเงิน ≤ ส่งใช้ (และไม่ก่อนการส่งใช้ครั้งก่อน)
  if (repayDate < loan.received_date) return { error: "วันที่ส่งใช้ต้องไม่ก่อนวันที่ได้รับเงินยืม" };
  const lastRepay = (loan.proc_loan_repayments ?? []).reduce((m, x) => (x.repay_date > m ? x.repay_date : m), "");
  if (lastRepay && repayDate < lastRepay) return { error: "วันที่ส่งใช้ต้องไม่ก่อนการส่งใช้ครั้งก่อน" };
  const { outstanding } = loanBalance(Number(loan.amount), loan.proc_loan_repayments ?? []);
  if (cash + voucher > outstanding + 0.001) return { error: `ส่งใช้เกินยอดคงค้าง (คงค้าง ${outstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท)` };
  const receiptNo = str("receipt_no") || null;
  if (receiptNo && (await receiptNoTaken(supabase, receiptNo))) return { error: `ใบรับใบสำคัญเลขที่ ${receiptNo} ถูกใช้แล้ว` };
  const { data: row, error } = await supabase.from("proc_loan_repayments").insert({
    loan_id: loanId,
    repay_date: repayDate,
    cash_amount: cash,
    voucher_amount: voucher,
    voucher_count: Number(str("voucher_count")) || null,
    receipt_no: receiptNo,
    note: str("note") || null,
  }).select("id").single();
  if (error) return { error: rlsMessage(error.message) };
  revalidatePath(PATH);
  return { id: row.id };
}

async function receiptNoTaken(supabase: Awaited<ReturnType<typeof createClient>>, no: string, exceptId?: string) {
  let q = supabase.from("proc_loan_repayments").select("id").eq("receipt_no", no).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q;
  return !!data?.length;
}

/** เลขที่ใบรับใบสำคัญถัดไป รูปแบบ "บค ลำดับ/ปีงบ พ.ศ." (นับต่อจากเลขสูงสุดของปีงบนั้น) — เติมให้ในฟอร์มส่งใช้ แก้ได้ */
export async function suggestReceiptNo(repayDate: string): Promise<{ receiptNo: string }> {
  const [y, m] = (repayDate || new Date().toISOString()).slice(0, 10).split("-").map(Number);
  const fy = y + 543 + (m >= 10 ? 1 : 0);
  const supabase = await createClient();
  const { data } = await supabase.from("proc_loan_repayments").select("receipt_no").like("receipt_no", `%/${fy}`);
  const max = (data ?? []).reduce((n, r) => {
    const hit = /(\d+)\s*\/\s*\d{4}$/.exec(r.receipt_no ?? "");
    return hit ? Math.max(n, Number(hit[1])) : n;
  }, 0);
  return { receiptNo: `บค ${max + 1}/${fy}` };
}

/** แก้เลขที่ใบรับใบสำคัญของการส่งใช้ที่บันทึกไปแล้ว (เช่น ลืมกรอก) */
export async function updateReceiptNo(id: string, receiptNo: string): Promise<Result> {
  const supabase = await createClient();
  const denied = await requireStaff(supabase);
  if (denied) return { error: denied };
  const no = receiptNo.trim() || null;
  if (no && (await receiptNoTaken(supabase, no, id))) return { error: `ใบรับใบสำคัญเลขที่ ${no} ถูกใช้แล้ว` };
  const { data, error } = await supabase.from("proc_loan_repayments").update({ receipt_no: no }).eq("id", id).select("id");
  if (error) return { error: rlsMessage(error.message) };
  if (!data?.length) return { error: "บันทึกไม่สำเร็จ" };
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

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const me = await currentUser(supabase);
  return me.staff ? null : "เฉพาะเจ้าหน้าที่การเงิน เจ้าหน้าที่พัสดุ หรือผู้ดูแลระบบ";
}

/** เลขที่สัญญาถัดไปตามรูปแบบที่ตั้งไว้ (ยังไม่บันทึก) — ใช้เติมให้ในหน้าต่าง "ออกเลขที่" */
export async function suggestLoanNumber(requestDate: string): Promise<{ docNo: string | null }> {
  const supabase = await createClient();
  return { docNo: await assignDocNumber(supabase, "loan", requestDate) };
}

/** การเงินรับเรื่อง: ออกเลขที่สัญญา + วันที่ตรวจสอบ (ช่อง "เสนอ") — ปุ่ม "ออกเลขที่" */
export async function issueLoanNumber(id: string, docNo: string, checkedDate: string): Promise<Result> {
  const supabase = await createClient();
  const denied = await requireStaff(supabase);
  if (denied) return { error: denied };
  const no = docNo.trim();
  if (!no) return { error: "กรุณาระบุเลขที่สัญญา" };
  if (!checkedDate) return { error: "กรุณาระบุวันที่ตรวจสอบ" };
  if (checkedDate > todayTh()) return { error: "วันที่การเงินตรวจสอบลงล่วงหน้าไม่ได้" };
  if (await docNumberTaken(supabase, "loan", no, id)) return { error: `เลขที่ ${no} ถูกใช้แล้ว` };
  const { data: cur } = await supabase.from("proc_loan_contracts").select("request_date").eq("id", id).maybeSingle();
  if (!cur) return { error: "ไม่พบสัญญา" };
  if (checkedDate < cur.request_date) return { error: "วันที่ตรวจสอบต้องไม่ก่อนวันที่ยื่นสัญญา" };
  const { error } = await supabase.from("proc_loan_contracts").update({ doc_no: no, checked_date: checkedDate, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: rlsMessage(error.message) };
  revalidatePath(PATH);
  return { id, docNo: no };
}

/** การเงินจ่ายเงินยืมแล้ว: บันทึกวันที่ผู้ยืมได้รับเงิน (และวันกลับ กรณีไปราชการ) → คำนวณวันครบกำหนด — ปุ่ม "บันทึกจ่ายเงิน" */
export async function recordLoanPayment(id: string, receivedDate: string, travelReturnDate: string | null): Promise<Result> {
  const supabase = await createClient();
  const denied = await requireStaff(supabase);
  if (denied) return { error: denied };
  if (!receivedDate) return { error: "กรุณาระบุวันที่ได้รับเงินยืม" };
  if (receivedDate > todayTh()) return { error: "วันที่ได้รับเงินลงล่วงหน้าไม่ได้" };
  const { data: cur } = await supabase.from("proc_loan_contracts").select("request_date, checked_date, loan_type, doc_no, director_approved_at").eq("id", id).maybeSingle();
  if (!cur) return { error: "ไม่พบสัญญา" };
  if (!cur.doc_no) return { error: "ยังไม่ได้ออกเลขที่สัญญา — กด \"ออกเลขที่\" ก่อน" };
  if (!cur.director_approved_at) return { error: "ผู้อำนวยการยังไม่อนุมัติ — จ่ายเงินได้หลังอนุมัติแล้ว" };
  const approvedDate = new Date(cur.director_approved_at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  if (receivedDate < approvedDate) return { error: "วันที่ได้รับเงินต้องไม่ก่อนวันที่ผู้อำนวยการอนุมัติ" };
  if (receivedDate < (cur.checked_date ?? cur.request_date)) return { error: cur.checked_date ? "วันที่ได้รับเงินต้องไม่ก่อนวันที่การเงินตรวจสอบ" : "วันที่ได้รับเงินต้องไม่ก่อนวันที่ยื่นสัญญา" };
  const loanType = parseLoanType(cur.loan_type);
  const ret = loanType === "travel" ? travelReturnDate || null : null;
  if (ret && ret < receivedDate) return { error: "วันที่กลับมาถึงต้องไม่ก่อนวันที่ได้รับเงิน" };
  const dueDays = LOAN_DUE_DAYS[loanType];
  const { error } = await supabase
    .from("proc_loan_contracts")
    .update({ received_date: receivedDate, travel_return_date: ret, due_days: dueDays, due_date: loanDueDate(loanType, dueDays, receivedDate, ret), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: rlsMessage(error.message) };
  revalidatePath(PATH);
  return { id };
}

/** ผู้อำนวยการอนุมัติ (approve=true) / ยกเลิกอนุมัติ (false, ก่อนจ่ายเงิน) — บันทึกวันเวลา + ชื่อผู้อนุมัติ
 * ผ่านฟังก์ชันฐานข้อมูล proc_approve_loan (ผอ.ไม่ใช่เจ้าหน้าที่ จึงแก้ตารางตรงไม่ได้) */
export async function approveLoan(id: string, approve: boolean): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("proc_approve_loan", { p_id: id, p_approve: approve });
  if (error) return { error: error.message };
  if (data) return { error: String(data) };
  revalidatePath(PATH);
  revalidatePath("/");
  return { id };
}
