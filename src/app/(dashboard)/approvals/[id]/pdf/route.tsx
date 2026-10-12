import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildApprovalPdfData,
  renderApprovalDocumentPdfBuffer,
  renderApprovalPdfBuffer,
} from "@/lib/pdf/build-approval-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await buildApprovalPdfData(supabase, id);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  // ?engine=new = เอกสารที่วาดขึ้นใหม่ทั้งหมดด้วย react-pdf (ทดลอง) — ไม่ระบุ = วิธีเดิม (เขียนทับเทมเพลต PDF)
  const useNewEngine = new URL(request.url).searchParams.get("engine") === "new";
  const buffer = useNewEngine
    ? await renderApprovalDocumentPdfBuffer(result.data)
    : await renderApprovalPdfBuffer(supabase, result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `${result.fileLabel}.pdf`),
    },
  });
}
