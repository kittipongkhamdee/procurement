import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildVoucherReceiptPdf } from "@/lib/pdf/build-loan-pdf";

// ใบรับใบสำคัญ ของการส่งใช้ 1 ครั้ง (ข้อ 66) — A4 แบ่งครึ่ง ฉบับผู้ยืม / ฉบับโรงเรียน
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const pdf = await buildVoucherReceiptPdf(await createClient(), id, rid);
  if (!pdf) return NextResponse.json({ error: "ไม่พบรายการส่งใช้" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `ใบรับใบสำคัญ-${pdf.receiptNo ?? ""}.pdf`) },
  });
}
