import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { parseLoanType, type LoanItem } from "@/lib/loan";
import { LoanContractDocument } from "@/lib/pdf/loan-contract-document";

// สัญญาการยืมเงิน — หน้า 1 สัญญา/อนุมัติ/ใบรับเงิน, หน้า 2 รายการส่งใช้
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("proc_loan_contracts").select("*, proc_loan_repayments(*)").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ error: "ไม่พบสัญญา" }, { status: 404 });
  const names = [r.checker_name, r.approver_name, r.borrower_name].filter((n): n is string => !!n);
  const [{ data: settings }, { data: school }, { data: positions }] = await Promise.all([
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_director", "approval_signer_finance"]),
    supabase.from("proc_school_settings").select("school_name, school_address").eq("id", true).maybeSingle(),
    supabase.from("proc_teacher_positions").select("teacher_name, position").in("teacher_name", names),
  ]);
  const s = new Map((settings ?? []).map((x) => [x.key, x.value]));
  const pos = new Map((positions ?? []).map((p) => [p.teacher_name, p.position]));
  const schoolName = school?.school_name ?? "โรงเรียนตาเบาวิทยา";
  const province = /จังหวัด\s*(\S+)/.exec(school?.school_address ?? "")?.[1] ?? "สุรินทร์";
  const approver = r.approver_name ?? s.get("approval_signer_director") ?? null;
  const travel = parseLoanType(r.loan_type) === "travel";
  const repayments = [...(r.proc_loan_repayments ?? [])].sort((a, b) => a.repay_date.localeCompare(b.repay_date) || a.created_at.localeCompare(b.created_at));
  const buffer = await renderToBuffer(
    <LoanContractDocument
      data={{
        doc_no: r.doc_no,
        request_date: r.request_date,
        due_date: r.due_date,
        school_name: schoolName,
        submit_to: `ผู้อำนวยการ${schoolName}`,
        borrower_name: r.borrower_name,
        borrower_position: r.borrower_position ?? pos.get(r.borrower_name) ?? null,
        affiliation: schoolName,
        province,
        fund_source: r.fund_source,
        purpose: r.purpose,
        items: (r.items as unknown as LoanItem[]) ?? [],
        amount: Number(r.amount),
        due_days: r.due_days,
        due_basis: travel ? "นับแต่วันกลับมาถึง" : "นับแต่วันได้รับเงินยืมนี้",
        received_date: r.received_date,
        checker_name: r.checker_name ?? s.get("approval_signer_finance") ?? null,
        checker_position: (r.checker_name && pos.get(r.checker_name)) || "เจ้าหน้าที่การเงิน",
        approver_name: approver,
        approver_position: `ผู้อำนวยการ${schoolName}`,
        repayments: repayments.map((x) => ({ ...x, cash_amount: Number(x.cash_amount), voucher_amount: Number(x.voucher_amount) })),
      }}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `สัญญายืมเงิน-${r.doc_no ?? ""}.pdf`) },
  });
}
