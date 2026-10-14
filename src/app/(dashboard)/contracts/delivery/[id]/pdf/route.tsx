import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDeliveryPdfData, renderDeliveryPdfBuffer } from "@/lib/pdf/build-delivery-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await buildDeliveryPdfData(supabase, id);
  if (!data) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  const buffer = await renderDeliveryPdfBuffer(data);
  const label = `ส่งมอบงาน-${data.contract_no.replace(/\//g, "-")}-${data.period_month?.slice(0, 7) ?? data.delivery_date}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${label}.pdf`) },
  });
}
