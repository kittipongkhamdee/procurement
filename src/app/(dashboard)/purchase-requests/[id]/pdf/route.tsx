import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { PurchaseRequestDocument, type PurchaseRequestPdfData } from "@/lib/pdf/purchase-request-document";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pr, error } = await supabase
    .from("proc_purchase_requests")
    .select(
      "doc_type, doc_no, record_date, delivery_date, work_days, inspector_name, inspector_position, admin_group, amount, item_name, reason, detail, supply_officer_name, plan_projects(name), plan_activities(name), proc_vendors(name, phone, house_no, moo, tambon, amphoe, province, zipcode)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !pr) {
    return NextResponse.json({ error: error?.message ?? "ไม่พบรายการ" }, { status: 404 });
  }

  const { data: items } = await supabase
    .from("proc_purchase_items")
    .select("seq, name, qty, unit, unit_price, total")
    .eq("purchase_request_id", id)
    .order("seq");

  const project = pr.plan_projects as unknown as { name: string } | null;
  const activity = pr.plan_activities as unknown as { name: string } | null;
  const vendor = pr.proc_vendors as unknown as {
    name: string;
    phone: string | null;
    house_no: string | null;
    moo: string | null;
    tambon: string | null;
    amphoe: string | null;
    province: string | null;
    zipcode: string | null;
  } | null;

  const vendorAddress = vendor
    ? [vendor.house_no, vendor.moo && `หมู่ ${vendor.moo}`, vendor.tambon, vendor.amphoe, vendor.province, vendor.zipcode]
        .filter(Boolean)
        .join(" ")
    : null;

  const pdfData: PurchaseRequestPdfData = {
    doc_type: pr.doc_type,
    doc_no: pr.doc_no,
    record_date: pr.record_date,
    delivery_date: pr.delivery_date,
    work_days: pr.work_days,
    inspector_name: pr.inspector_name,
    inspector_position: pr.inspector_position,
    admin_group: pr.admin_group,
    amount: Number(pr.amount),
    item_name: pr.item_name,
    reason: pr.reason,
    detail: pr.detail,
    supply_officer_name: pr.supply_officer_name,
    project_name: project?.name ?? null,
    activity_name: activity?.name ?? null,
    vendor_name: vendor?.name ?? null,
    vendor_address: vendorAddress || null,
    vendor_phone: vendor?.phone ?? null,
    items: (items ?? []).map((i) => ({
      seq: i.seq,
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      unit_price: i.unit_price,
      total: i.total,
    })),
  };

  const buffer = await renderToBuffer(<PurchaseRequestDocument data={pdfData} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pr.doc_type}-${pr.doc_no}.pdf"`,
    },
  });
}
