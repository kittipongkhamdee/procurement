import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { ExpenseClaimDocument, type ExpenseClaimData } from "@/lib/pdf/expense-claim-document";
import { W119EvidenceDocument } from "@/lib/pdf/w119-document";

// บันทึกขออนุมัติเบิกค่าใช้จ่ายโครงการ (ตาราง 2 ว 119) — ?sheet=evidence → ใบติดหลักฐาน (พิมพ์แยก)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("proc_expense_claims")
    .select(
      "doc_no, record_date, event_name, event_date, event_end_date, venue, admin_group, approval_ref, approval_ref_date, responsible_name, responsible_position, fund_source, payment_method, amount, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  const [{ data: items }, { data: settings }, { data: school }] = await Promise.all([
    supabase
      .from("proc_expense_claim_items")
      .select("kind, name, rate, units, people, days, amount, payee, evidence, receipt_book, receipt_no, receipt_date")
      .eq("claim_id", id)
      .order("seq"),
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_director"]),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  const num = (x: number | null) => (x == null ? null : Number(x));
  const data: ExpenseClaimData = {
    ...r,
    payment_method: r.payment_method === "transfer" ? "transfer" : "cash",
    amount: Number(r.amount),
    project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? null,
    items: (items ?? []).map((i) => ({ ...i, rate: num(i.rate), units: num(i.units), people: num(i.people), days: num(i.days), amount: Number(i.amount) })),
    school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
    education_area: school?.education_area ?? null,
    director: settings?.find((s) => s.key === "approval_signer_director")?.value ?? null,
  };
  const evidence = new URL(request.url).searchParams.get("sheet") === "evidence";
  const buffer = await renderToBuffer(
    evidence ? (
      <W119EvidenceDocument
        data={{ ...data, items: data.items.map((i) => ({ ...i, vendor: i.payee })) }}
        refLabel="บันทึกขออนุมัติเบิกค่าใช้จ่าย"
        title="ใบติดหลักฐานการจ่ายเงิน"
        partyLabel="ผู้รับเงิน"
      />
    ) : (
      <ExpenseClaimDocument data={data} />
    ),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `เบิกค่าใช้จ่าย-${r.doc_no}${evidence ? "-ใบติดหลักฐาน" : ""}.pdf`),
    },
  });
}
