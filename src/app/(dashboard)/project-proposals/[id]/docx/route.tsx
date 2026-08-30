import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildProposalDocxData, renderProposalDocxBuffer } from "@/lib/docx/build-proposal-docx";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await buildProposalDocxData(supabase, id);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  const buffer = await renderProposalDocxBuffer(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition("attachment", `${result.fileLabel}.docx`),
    },
  });
}
