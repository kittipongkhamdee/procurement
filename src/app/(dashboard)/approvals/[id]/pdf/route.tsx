import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildApprovalPdfData, renderApprovalPdfBuffer } from "@/lib/pdf/build-approval-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await buildApprovalPdfData(supabase, id);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  const buffer = await renderApprovalPdfBuffer(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.fileLabel}.pdf"`,
    },
  });
}
