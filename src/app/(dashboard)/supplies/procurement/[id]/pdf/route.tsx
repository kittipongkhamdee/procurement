import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildProcurementSetData, renderProcurementSetPdf } from "@/lib/pdf/build-procurement-set-pdf";

// ชุดเอกสารงานซื้อ/งานจ้าง — ?sheets=1,3 พิมพ์เฉพาะแผ่นที่เลือก (ไม่ส่ง = ทั้งชุด ๘ แผ่น)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await buildProcurementSetData(supabase, id);
  if (!data) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  const sheets = (new URL(request.url).searchParams.get("sheets") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8);
  const buffer = await renderProcurementSetPdf(data, sheets);
  const name = `${data.doc_no.replace(/\s+/g, "-")}${sheets.length === 1 ? `-แผ่น${sheets[0]}` : ""}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", name) },
  });
}
