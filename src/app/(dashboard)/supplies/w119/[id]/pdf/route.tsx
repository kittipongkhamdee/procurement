import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { withPrefix } from "@/lib/doc-numbers";
import { W119Document, W119EvidenceDocument, type W119Data } from "@/lib/pdf/w119-document";

// ว.119 — บันทึกรายงานขอความเห็นชอบการจัดซื้อจัดจ้างและขออนุมัติเบิกจ่ายเงิน
// ?sheet=evidence → ใบติดหลักฐาน (พิมพ์แยกจากบันทึก)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("proc_w119_reports")
    .select(
      "doc_no, record_date, purchase_date, admin_group, purpose, expense_category, table_ref, responsible_name, responsible_position, payment_method, fund_source, amount, plan_projects(name), plan_activities(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  const [{ data: items }, { data: settings }, { data: school }] = await Promise.all([
    supabase.from("proc_w119_items").select("name, vendor, evidence, receipt_book, receipt_no, receipt_date, amount").eq("report_id", id).order("seq"),
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_director", "doc_signer_procurement_officer", "doc_signer_procurement_head"]),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  const s = new Map((settings ?? []).map((x) => [x.key, x.value]));
  const data: W119Data = {
    ...r,
    doc_no: withPrefix(r.doc_no, "w119"),
    payment_method: r.payment_method === "transfer" ? "transfer" : "cash",
    amount: Number(r.amount),
    project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? null,
    activity_name: (r.plan_activities as unknown as { name: string } | null)?.name ?? null,
    items: (items ?? []).map((i) => ({ ...i, amount: Number(i.amount) })),
    school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
    education_area: school?.education_area ?? null,
    procurement_officer: s.get("doc_signer_procurement_officer") ?? "นางสาวโสรดา  ศรีสุข",
    procurement_head: s.get("doc_signer_procurement_head") ?? "นายกิตติพงษ์   คำดี",
    director: s.get("approval_signer_director") ?? null,
  };
  const evidence = new URL(request.url).searchParams.get("sheet") === "evidence";
  const buffer = await renderToBuffer(evidence ? <W119EvidenceDocument data={data} /> : <W119Document data={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${withPrefix(r.doc_no, "w119").replace(/\s+/g, "-")}${evidence ? "-ใบติดหลักฐาน" : ""}.pdf`) },
  });
}
