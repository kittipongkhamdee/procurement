import { renderToBuffer } from "@react-pdf/renderer";
import type { createClient } from "@/lib/supabase/server";
import { THAI_MONTHS, thaiBahtText } from "@/lib/thai";
import { dmy } from "@/lib/teacher-hire-contract";
import { ServiceDeliveryDocument, type ServiceDeliveryData } from "./service-delivery-document";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const num = (n: number) => n.toLocaleString("th-TH", Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * ข้อมูลใบส่งมอบ/ใบตรวจรับ "แบบจ้างเหมาบริการ" — ใช้เมื่อสัญญาของใบส่งมอบนี้สร้างจากฟอร์มสัญญาจ้างเหมาบริการ
 * (proc_service_hire_contracts.register_contract_id) ไม่ใช่ก็คืน null ให้ใช้ชุดเดิม (build-delivery-pdf)
 */
export async function buildServiceDeliveryData(supabase: Supabase, id: string): Promise<ServiceDeliveryData | null> {
  const { data: d } = await supabase
    .from("proc_deliveries")
    .select("contract_id, delivery_date, period_month, amount, late_days, penalty_amount, inspector_name, inspector_member1, inspector_member2, proc_contracts(contract_no, contract_date, vendor_name, start_date, end_date)")
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const c = d.proc_contracts as unknown as { contract_no: string; contract_date: string; vendor_name: string; start_date: string | null; end_date: string | null } | null;
  if (!c) return null;
  const { data: svc } = await supabase
    .from("proc_service_hire_contracts")
    .select("job_title, tor_job_role, monthly_rate")
    .eq("register_contract_id", d.contract_id)
    .maybeSingle();
  if (!svc) return null;

  const [{ data: school }, { data: signers }] = await Promise.all([
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
    supabase.from("proc_app_settings").select("key, value").in("key", ["doc_signer_inspect_chair", "doc_signer_inspect_member1", "doc_signer_inspect_member2"]),
  ]);
  const s = new Map((signers ?? []).map((r) => [r.key, r.value?.trim() || null]));

  // ช่วงที่ตรวจรับ = เดือนของงวด (ตัดตามวันเริ่ม/สิ้นสุดสัญญาถ้าเป็นเดือนไม่เต็ม)
  const src = d.period_month ?? d.delivery_date;
  const [py, pm] = src.split("-").map(Number);
  const first = iso(py, pm, 1);
  const last = iso(py, pm, new Date(Date.UTC(py, pm, 0)).getUTCDate());
  const from = c.start_date && c.start_date > first ? c.start_date : first;
  const to = c.end_date && c.end_date < last ? c.end_date : last;
  const thaiYear = (isoDate: string) => `${Number(isoDate.slice(0, 4)) + 543}`;
  const range = (isoDate: string) => `${Number(isoDate.slice(8, 10))} ${THAI_MONTHS[Number(isoDate.slice(5, 7))]} ${thaiYear(isoDate)}`;

  const amount = Number(d.amount);
  const role = svc.tor_job_role?.trim() || svc.job_title;
  return {
    school_name: school?.school_name ?? "โรงเรียน",
    contract_no: c.contract_no,
    contract_date: dmy(c.contract_date),
    vendor_name: c.vendor_name,
    role,
    project: `จ้างผู้ปฏิบัติงานให้ราชการ ตำแหน่ง${role}`,
    monthly: svc.monthly_rate ? num(Number(svc.monthly_rate)) : num(amount),
    delivery_date: dmy(d.delivery_date),
    amount: num(amount),
    amount_text: thaiBahtText(amount),
    month_name: THAI_MONTHS[pm] ?? "",
    period_from: range(from),
    period_to: range(to),
    late_days: d.late_days ?? 0,
    penalty_amount: d.penalty_amount != null ? Number(d.penalty_amount) : 0,
    committee: [
      { role: "ประธานกรรมการ", name: d.inspector_name || s.get("doc_signer_inspect_chair") || null },
      { role: "กรรมการ", name: d.inspector_member1 || s.get("doc_signer_inspect_member1") || null },
      { role: "กรรมการ", name: d.inspector_member2 || s.get("doc_signer_inspect_member2") || null },
    ],
  };
}

export function renderServiceDeliveryPdfBuffer(data: ServiceDeliveryData) {
  return renderToBuffer(<ServiceDeliveryDocument data={data} />);
}
