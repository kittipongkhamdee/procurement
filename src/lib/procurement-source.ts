import type { createClient } from "@/lib/supabase/server";
import type { ItemClass } from "@/lib/item-class";

// อ่านรายการจากเอกสารจัดซื้อ 1 ฉบับ (งานซื้อ/จ้าง/ว 804, ว 119, เร่งด่วน) เฉพาะที่ติ๊กเป็นวัสดุ หรือครุภัณฑ์
// ใช้ร่วมกันระหว่างบัญชีวัสดุ (stock-actions) และทะเบียนคุมทรัพย์สิน (asset-register/import-actions)

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type ProcurementSourceType = "purchase" | "w119" | "urgent";
export const PROCUREMENT_SOURCE_LABEL: Record<ProcurementSourceType, string> = { purchase: "จัดซื้อ", w119: "ว 119", urgent: "เร่งด่วน" };

export type SourceItem = { seq: number; name: string; qty: number; unit: string; unit_price: number; party: string | null };
export type SourceInfo = {
  doc_no: string;
  date: string;
  requester: string | null;
  requester_position: string | null;
  purpose: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  fund_source: string | null;
  items: SourceItem[];
};

export async function loadProcurementSource(supabase: Supabase, type: ProcurementSourceType, id: string, cls: ItemClass): Promise<SourceInfo | null> {
  if (type === "purchase") {
    const { data: r } = await supabase
      .from("proc_purchase_requests")
      .select("doc_no, record_date, delivered_date, inspected_date, inspector_name, inspector_position, reason, proc_vendors(name, house_no, moo, tambon, amphoe, province, phone)")
      .eq("id", id)
      .maybeSingle();
    if (!r) return null;
    const { data: items } = await supabase.from("proc_purchase_items").select("seq, name, qty, unit, unit_price, item_class").eq("purchase_request_id", id).order("seq");
    const v = r.proc_vendors as unknown as { name: string; house_no: string | null; moo: string | null; tambon: string | null; amphoe: string | null; province: string | null; phone: string | null } | null;
    const address = v
      ? [v.house_no && `เลขที่ ${v.house_no}`, v.moo && `หมู่ ${v.moo}`, v.tambon && `ต.${v.tambon}`, v.amphoe && `อ.${v.amphoe}`, v.province && `จ.${v.province}`].filter(Boolean).join(" ") || null
      : null;
    return {
      doc_no: r.doc_no,
      date: r.inspected_date ?? r.delivered_date ?? r.record_date,
      requester: r.inspector_name,
      requester_position: r.inspector_position,
      purpose: r.reason,
      vendor_address: address,
      vendor_phone: v?.phone ?? null,
      fund_source: null,
      items: (items ?? [])
        .filter((i) => i.item_class === cls && i.name && Number(i.qty) > 0)
        .map((i) => ({ seq: i.seq, name: i.name!.trim(), qty: Number(i.qty), unit: i.unit?.trim() || "หน่วย", unit_price: Number(i.unit_price ?? 0), party: v?.name ?? null })),
    };
  }
  if (type === "w119") {
    const { data: r } = await supabase.from("proc_w119_reports").select("doc_no, purchase_date, responsible_name, responsible_position, purpose, fund_source").eq("id", id).maybeSingle();
    if (!r) return null;
    const { data: items } = await supabase.from("proc_w119_items").select("seq, name, qty, unit, amount, vendor, item_class").eq("report_id", id).order("seq");
    return {
      doc_no: r.doc_no,
      date: r.purchase_date,
      requester: r.responsible_name,
      requester_position: r.responsible_position,
      purpose: r.purpose,
      vendor_address: null,
      vendor_phone: null,
      fund_source: r.fund_source,
      items: (items ?? [])
        .filter((i) => i.item_class === cls)
        .map((i) => {
          const qty = Number(i.qty) || 1;
          return { seq: i.seq, name: i.name.trim(), qty, unit: i.unit?.trim() || "หน่วย", unit_price: Math.round((Number(i.amount) / qty) * 100) / 100, party: i.vendor };
        }),
    };
  }
  const { data: r } = await supabase.from("proc_urgent_reports").select("doc_no, purchase_date, responsible_name, responsible_position, work_text, payee").eq("id", id).maybeSingle();
  if (!r) return null;
  const { data: items } = await supabase.from("proc_urgent_items").select("seq, name, qty, unit, amount, item_class").eq("report_id", id).order("seq");
  return {
    doc_no: r.doc_no ?? "",
    date: r.purchase_date,
    requester: r.responsible_name,
    requester_position: r.responsible_position,
    purpose: r.work_text,
    vendor_address: null,
    vendor_phone: null,
    fund_source: null,
    items: (items ?? [])
      .filter((i) => i.item_class === cls)
      .map((i) => {
        const qty = Number(i.qty) || 1;
        return { seq: i.seq, name: i.name.trim(), qty, unit: i.unit?.trim() || "หน่วย", unit_price: Math.round((Number(i.amount) / qty) * 100) / 100, party: r.payee ?? r.responsible_name };
      }),
  };
}
