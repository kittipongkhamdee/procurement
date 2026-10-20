import { renderToBuffer } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";
import { assignDocNumber } from "@/lib/doc-number-server";
import { parseLoanType, type LoanItem } from "@/lib/loan";
import { LoanContractDocument, VoucherReceiptDocument, type LoanContractData } from "./loan-contract-document";

// โหลดข้อมูลสัญญาการยืมเงิน + ค่าตั้งโรงเรียน แล้วเรนเดอร์ PDF — ใช้ทั้งสัญญา (หน้า-หลัง), สรุปรายการส่งใช้ และใบรับใบสำคัญ
type Supabase = Awaited<ReturnType<typeof createClient>>;

type LoanPdfData = LoanContractData & { created_by: string | null };

/** สิทธิ์พิมพ์ — เจ้าหน้าที่ (admin/พัสดุ/การเงิน) และผู้บริหารพิมพ์ได้ทุกสัญญา, ครูพิมพ์ได้เฉพาะสัญญาที่ตัวเองยื่น */
async function printer(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("proc_profiles").select("role").eq("user_id", user?.id ?? "").maybeSingle();
  const role = profile?.role ?? "";
  return { userId: user?.id ?? null, staff: ["admin", "supply_officer", "finance_officer"].includes(role), executive: ["director", "deputy_director"].includes(role) };
}

/** วันที่ปัจจุบันตามเวลาไทย (ISO) */
function todayBangkok() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

async function loadLoan(supabase: Supabase, id: string): Promise<LoanPdfData | null> {
  const { data: r } = await supabase.from("proc_loan_contracts").select("*, proc_loan_repayments(*), plan_projects(name), plan_activities(name)").eq("id", id).maybeSingle();
  if (!r) return null;
  const names = [r.checker_name, r.approver_name, r.borrower_name].filter((n): n is string => !!n);
  const [{ data: settings }, { data: school }, { data: positions }] = await Promise.all([
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_director", "approval_signer_finance"]),
    supabase.from("proc_school_settings").select("school_name, school_address, education_area").eq("id", true).maybeSingle(),
    supabase.from("proc_teacher_positions").select("teacher_name, position").in("teacher_name", names),
  ]);
  const s = new Map((settings ?? []).map((x) => [x.key, x.value]));
  const pos = new Map((positions ?? []).map((p) => [p.teacher_name, p.position]));
  const schoolName = school?.school_name ?? "โรงเรียนตาเบาวิทยา";
  const checker = r.checker_name ?? s.get("approval_signer_finance") ?? null;
  const repayments = [...(r.proc_loan_repayments ?? [])].sort((a, b) => a.repay_date.localeCompare(b.repay_date) || a.created_at.localeCompare(b.created_at));
  return {
    created_by: r.created_by,
    printed_by: "borrower",
    checked_date: r.checked_date,
    doc_no: r.doc_no,
    request_date: r.request_date,
    due_date: r.due_date,
    school_name: schoolName,
    submit_to: `ผู้อำนวยการ${schoolName}`,
    borrower_name: r.borrower_name,
    borrower_position: r.borrower_position ?? pos.get(r.borrower_name) ?? null,
    affiliation: school?.education_area ?? "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาสุรินทร์",
    province: /จังหวัด\s*(\S+)/.exec(school?.school_address ?? "")?.[1] ?? "สุรินทร์",
    fund_source: r.fund_source,
    // เพื่อเป็นค่าใช้จ่ายในการ <ที่กรอก> โครงการ… กิจกรรม…
    purpose: [
      r.purpose,
      r.plan_projects?.name && `โครงการ${r.plan_projects.name.replace(/^โครงการ\s*/, "")}`,
      r.plan_activities?.name && `กิจกรรม${r.plan_activities.name.replace(/^กิจกรรม\s*/, "")}`,
    ]
      .filter(Boolean)
      .join(" "),
    items: (r.items as unknown as LoanItem[]) ?? [],
    amount: Number(r.amount),
    loan_type: parseLoanType(r.loan_type),
    due_days: r.due_days,
    received_date: r.received_date,
    checker_name: checker,
    checker_position: (checker && pos.get(checker)) || "เจ้าหน้าที่การเงิน",
    approver_name: r.approver_name ?? s.get("approval_signer_director") ?? null,
    approver_position: `ผู้อำนวยการ${schoolName}`,
    repayments: repayments.map((x) => ({ ...x, cash_amount: Number(x.cash_amount), voucher_amount: Number(x.voucher_amount) })),
  };
}

export async function buildLoanContractPdf(supabase: Supabase, id: string, view: "contract" | "summary") {
  const data = await loadLoan(supabase, id);
  if (!data) return { status: 404 as const };
  const me = await printer(supabase);
  if (!me.staff && !me.executive && data.created_by !== me.userId) return { status: 403 as const };
  // เจ้าหน้าที่พิมพ์สัญญา: ออกเลขที่ (ถ้ายังไม่มี) และตั้งวันที่การเงินตรวจสอบเป็นวันนี้ (ถ้ายังไม่มี) แล้วพิมพ์ลงเอกสาร
  // ผู้ยืม/ผู้บริหารพิมพ์: เว้นว่างเลขที่และวันที่ทุกช่อง ให้การเงินเขียนมือ
  if (me.staff) {
    data.printed_by = "finance";
    if (view === "contract" && (!data.doc_no || !data.checked_date)) {
      const patch: { doc_no?: string; checked_date?: string } = {};
      if (!data.doc_no) {
        const no = await assignDocNumber(supabase, "loan", data.request_date);
        if (no) patch.doc_no = no;
      }
      if (!data.checked_date) patch.checked_date = todayBangkok();
      const { error } = await supabase.from("proc_loan_contracts").update(patch).eq("id", id);
      if (!error) Object.assign(data, patch);
    }
  }
  return { status: 200 as const, docNo: data.doc_no, buffer: await renderToBuffer(<LoanContractDocument data={data} view={view} />) };
}

export async function buildVoucherReceiptPdf(supabase: Supabase, id: string, repaymentId: string) {
  const data = await loadLoan(supabase, id);
  const rep = data?.repayments.find((r) => r.id === repaymentId);
  if (!data || !rep) return null;
  const me = await printer(supabase);
  if (!me.staff && !me.executive && data.created_by !== me.userId) return null;
  const buffer = await renderToBuffer(
    <VoucherReceiptDocument
      data={{
        receipt_no: rep.receipt_no,
        repay_date: rep.repay_date,
        school_name: data.school_name,
        borrower_name: data.borrower_name,
        borrower_position: data.borrower_position,
        affiliation: data.affiliation,
        doc_no: data.doc_no,
        request_date: data.request_date,
        voucher_count: rep.voucher_count,
        voucher_amount: rep.voucher_amount,
        cash_amount: rep.cash_amount,
        receiver_name: data.checker_name,
        receiver_position: data.checker_position,
      }}
    />,
  );
  return { receiptNo: rep.receipt_no, buffer };
}
