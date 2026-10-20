import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildMoneyRegisterPdf } from "@/lib/pdf/build-finance-ledger-pdf";

// ทะเบียนคุมเงินแยกประเภท — ?fy=2570&month=YYYY-MM|all&type=<id> (ไม่ส่ง type = ทุกประเภทที่มียอด/รายการ)
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const fy = Number(sp.get("fy"));
  const month = sp.get("month") ?? "all";
  if (!(fy > 2500) || !(month === "all" || /^\d{4}-\d{2}$/.test(month))) return NextResponse.json({ error: "พารามิเตอร์ไม่ถูกต้อง" }, { status: 400 });
  const buffer = await buildMoneyRegisterPdf(await createClient(), fy, month, sp.get("type"));
  if (!buffer) return NextResponse.json({ error: "ไม่มีข้อมูลของปีงบประมาณนี้" }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `ทะเบียนคุมเงิน-${fy}.pdf`) },
  });
}
