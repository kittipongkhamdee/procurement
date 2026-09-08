import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetSummaryPdfData, renderAssetSummaryPdfBuffer } from "@/lib/pdf/build-asset-summary-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();

  const data = await buildAssetSummaryPdfData(supabase, {
    categoryId: url.searchParams.get("category") ?? undefined,
    condition: url.searchParams.get("condition") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });

  const buffer = await renderAssetSummaryPdfBuffer(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", "สรุปรายการทรัพย์สิน.pdf"),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
