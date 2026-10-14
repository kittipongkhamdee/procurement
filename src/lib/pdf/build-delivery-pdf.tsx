import { renderToBuffer } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";
import { DeliveryDocument, type DeliveryPdfData } from "./delivery-document";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const SIGNER_KEYS = ["approval_signer_finance", "approval_signer_director", "doc_signer_procurement_officer", "doc_signer_procurement_head"];

export async function buildDeliveryPdfData(supabase: Supabase, id: string): Promise<DeliveryPdfData | null> {
  const { data: d } = await supabase
    .from("proc_deliveries")
    .select(
      "delivery_date, period_month, amount, late_days, penalty_amount, withholding_tax, inspector_name, proc_contracts(contract_type, contract_no, contract_date, detail, end_date, vendor_name, id_card, house_no, moo, tambon, amphoe, province, zipcode, phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const c = d.proc_contracts as unknown as Omit<DeliveryPdfData, "delivery_date"> | null;
  if (!c) return null;

  const [{ data: signers }, { data: school }] = await Promise.all([
    supabase.from("proc_app_settings").select("key, value").in("key", SIGNER_KEYS),
    supabase.from("proc_school_settings").select("school_name, school_address, education_area").eq("id", true).maybeSingle(),
  ]);
  const s = new Map((signers ?? []).map((r) => [r.key, r.value]));

  return {
    ...c,
    delivery_date: d.delivery_date,
    period_month: d.period_month,
    amount: Number(d.amount),
    late_days: d.late_days,
    penalty_amount: d.penalty_amount != null ? Number(d.penalty_amount) : null,
    withholding_tax: d.withholding_tax != null ? Number(d.withholding_tax) : null,
    inspector_name: d.inspector_name,
    school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
    school_address: school?.school_address ?? null,
    education_area: school?.education_area ?? null,
    procurement_officer: s.get("doc_signer_procurement_officer") ?? "นางสาวโสรดา  ศรีสุข",
    procurement_head: s.get("doc_signer_procurement_head") ?? "นายกิตติพงษ์   คำดี",
    finance_officer: s.get("approval_signer_finance") ?? null,
    director: s.get("approval_signer_director") ?? null,
  };
}

export function renderDeliveryPdfBuffer(data: DeliveryPdfData) {
  return renderToBuffer(<DeliveryDocument data={data} />);
}
