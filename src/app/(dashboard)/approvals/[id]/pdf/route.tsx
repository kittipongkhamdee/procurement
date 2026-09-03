import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildApprovalPdfData, renderApprovalPdfBuffer } from "@/lib/pdf/build-approval-pdf";
import { contentDisposition } from "@/lib/http";

// พิมพ์ PDF ผ่าน headless Chromium จริง (Playwright) ช้ากว่า react-pdf พอสมควร โดยเฉพาะ cold start
// ที่ต้องแตกไฟล์ไบนารี Chromium ครั้งแรก — ขยาย timeout จากค่าเริ่มต้น 10 วินาทีของ Vercel
export const maxDuration = 60;

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
      "Content-Disposition": contentDisposition("inline", `${result.fileLabel}.pdf`),
    },
  });
}
