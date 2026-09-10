import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetAuditReportPdfData, renderAssetAuditReportPdfBuffer } from "@/lib/pdf/build-asset-audit-report-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const data = await buildAssetAuditReportPdfData(supabase, id);
  if (!data) {
    return NextResponse.json({ error: "ไม่พบรอบตรวจสอบนี้" }, { status: 404 });
  }

  const buffer = await renderAssetAuditReportPdfBuffer(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `รายงานผลการตรวจสอบพัสดุประจำปี ${data.fiscal_year}.pdf`),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
