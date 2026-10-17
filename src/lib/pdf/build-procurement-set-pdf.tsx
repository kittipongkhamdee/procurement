import { renderToBuffer } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";
import { ProcurementSetDocument, type ProcurementSetData } from "./procurement-set-document";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SETTING_KEYS = ["approval_signer_director", "doc_signer_procurement_officer", "doc_signer_procurement_head", "school_phone"];

export async function buildProcurementSetData(supabase: Supabase, id: string): Promise<ProcurementSetData | null> {
  const { data: pr } = await supabase
    .from("proc_purchase_requests")
    .select(
      "doc_type, doc_no, record_date, delivery_date, order_date, delivered_date, inspected_date, report_date, work_days, admin_group, item_name, reason, amount, penalty_rate, order_signer, method, receipt_type, receipt_book, receipt_no, receipt_date, funding, loan_contract_no, loan_date, spec_author, inspector_name, inspector_position, plan_projects(name), plan_activities(name), proc_vendors(name, house_no, moo, tambon, amphoe, province, phone, tax_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!pr) return null;

  const [{ data: items }, { data: settings }, { data: school }] = await Promise.all([
    supabase.from("proc_purchase_items").select("name, qty, unit, unit_price, total").eq("purchase_request_id", id).order("seq"),
    supabase.from("proc_app_settings").select("key, value").in("key", SETTING_KEYS),
    supabase.from("proc_school_settings").select("school_name, school_address, education_area").eq("id", true).maybeSingle(),
  ]);
  const s = new Map((settings ?? []).map((r) => [r.key, r.value]));

  return {
    doc_type: pr.doc_type,
    doc_no: pr.doc_no,
    record_date: pr.record_date,
    delivery_date: pr.delivery_date,
    order_date: pr.order_date,
    delivered_date: pr.delivered_date,
    inspected_date: pr.inspected_date,
    report_date: pr.report_date,
    work_days: pr.work_days,
    admin_group: pr.admin_group,
    project_name: (pr.plan_projects as unknown as { name: string } | null)?.name ?? null,
    activity_name: (pr.plan_activities as unknown as { name: string } | null)?.name ?? null,
    item_name: pr.item_name ?? "",
    reason: pr.reason,
    amount: Number(pr.amount),
    penalty_rate: pr.penalty_rate != null ? Number(pr.penalty_rate) : null,
    order_signer: pr.order_signer === "director" ? "director" : "head",
    inspector_name: pr.inspector_name,
    inspector_position: pr.inspector_position,
    vendor: pr.proc_vendors as unknown as ProcurementSetData["vendor"],
    items: (items ?? []).map((i) => ({ ...i, qty: i.qty != null ? Number(i.qty) : null, unit_price: i.unit_price != null ? Number(i.unit_price) : null, total: i.total != null ? Number(i.total) : null })),
    school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
    school_address: school?.school_address ?? null,
    school_phone: s.get("school_phone") ?? "044-069950",
    education_area: school?.education_area ?? null,
    procurement_officer: s.get("doc_signer_procurement_officer") ?? "นางสาวโสรดา  ศรีสุข",
    procurement_head: s.get("doc_signer_procurement_head") ?? "นายกิตติพงษ์   คำดี",
    director: s.get("approval_signer_director") ?? null,
    method: pr.method === "w804" ? "w804" : "specific",
    receipt_type: pr.receipt_type,
    receipt_book: pr.receipt_book,
    receipt_no: pr.receipt_no,
    receipt_date: pr.receipt_date,
    funding: pr.funding === "loan" ? "loan" : pr.funding === "advance" ? "advance" : null,
    loan_contract_no: pr.loan_contract_no,
    loan_date: pr.loan_date,
    spec_author: pr.spec_author,
  };
}

export function renderProcurementSetPdf(data: ProcurementSetData, sheets?: number[]) {
  return renderToBuffer(<ProcurementSetDocument data={data} sheets={sheets} />);
}
