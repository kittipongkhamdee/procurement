import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildLoanContractPdf } from "@/lib/pdf/build-loan-pdf";

// สัญญาการยืมเงิน — ค่าเริ่มต้น: ด้านหน้า + ด้านหลัง (ตารางส่งใช้เปล่า) พิมพ์หน้า-หลังตอนยืม
// ?view=summary: สรุปรายการส่งใช้ตามที่บันทึกในระบบ (ตรวจทาน/แนบเรื่อง)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = new URL(request.url).searchParams.get("view") === "summary" ? "summary" : "contract";
  const pdf = await buildLoanContractPdf(await createClient(), id, view);
  if (pdf.status === 404) return NextResponse.json({ error: "ไม่พบสัญญา" }, { status: 404 });
  if (pdf.status === 403) return NextResponse.json({ error: "พิมพ์ได้เฉพาะสัญญาที่คุณยื่นเอง" }, { status: 403 });
  const name = `${view === "summary" ? "สรุปส่งใช้เงินยืม" : "สัญญายืมเงิน"}-${pdf.docNo ?? ""}.pdf`;
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", name) },
  });
}
