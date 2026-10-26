import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildBlankApprovalPdfData, renderApprovalPdfBuffer } from "@/lib/pdf/build-approval-pdf";
import { contentDisposition } from "@/lib/http";

// แบบฟอร์มบันทึกข้อความขออนุมัติเปล่า — พิมพ์ให้เขียนด้วยมือ (หน้า ๑ บันทึกข้อความ + กรอบความเห็น, หน้า ๒ ตารางรายการวัสดุ)
export async function GET() {
  const supabase = await createClient();
  const data = await buildBlankApprovalPdfData(supabase);
  const buffer = await renderApprovalPdfBuffer(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", "บันทึกขออนุมัติ-แบบฟอร์มเปล่า.pdf"),
    },
  });
}
