import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildFundLoanMemoPdf } from "@/lib/pdf/build-finance-ledger-pdf";

// บันทึกข้อความขออนุมัติยืมเงินระหว่างประเภทเงิน
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const buffer = await buildFundLoanMemoPdf(await createClient(), id);
  if (!buffer) return NextResponse.json({ error: "ไม่พบรายการยืมนี้" }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", "บันทึกขออนุมัติยืมเงิน.pdf") },
  });
}
