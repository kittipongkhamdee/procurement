import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildDailyBalancePdf } from "@/lib/pdf/build-finance-ledger-pdf";

// รายงานเงินคงเหลือประจำวัน — ?date=YYYY-MM-DD (ยอด ณ สิ้นวัน)
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "กรุณาระบุวันที่" }, { status: 400 });
  const buffer = await buildDailyBalancePdf(await createClient(), date);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `รายงานเงินคงเหลือประจำวัน-${date}.pdf`) },
  });
}
