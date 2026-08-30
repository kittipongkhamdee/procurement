import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPurchaseRequestPdfData, renderPurchaseRequestPdfBuffer } from "@/lib/pdf/build-purchase-request-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await buildPurchaseRequestPdfData(supabase, id);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  const buffer = await renderPurchaseRequestPdfBuffer(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `${result.fileLabel}.pdf`),
    },
  });
}
