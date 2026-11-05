import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDeliveryPdfData, renderDeliveryPdfBuffer } from "@/lib/pdf/build-delivery-pdf";
import { buildServiceDeliveryData, renderServiceDeliveryPdfBuffer } from "@/lib/pdf/build-service-delivery-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // สัญญาที่สร้างจากฟอร์มสัญญาจ้างเหมาบริการ (ธุรการ/นักการภารโรง) ใช้แบบใบส่งมอบ/ใบตรวจรับของงานบริการ ที่เหลือใช้ชุดเดิม ๔ หน้า
  const service = await buildServiceDeliveryData(supabase, id);
  if (service) {
    const buffer = await renderServiceDeliveryPdfBuffer(service);
    const label = `ส่งมอบงาน-${service.contract_no.replace(/\//g, "-")}-${service.month_name}`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${label}.pdf`) },
    });
  }
  const data = await buildDeliveryPdfData(supabase, id);
  if (!data) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  const buffer = await renderDeliveryPdfBuffer(data);
  const label = `ส่งมอบงาน-${data.contract_no.replace(/\//g, "-")}-${data.period_month?.slice(0, 7) ?? data.delivery_date}`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${label}.pdf`) },
  });
}
