import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { buildVoucherRegisterPdf } from "@/lib/pdf/build-finance-ledger-pdf";

// ทะเบียนคุมใบสำคัญคู่จ่าย (บค./บจ.) — ?fy=2570
export async function GET(request: Request) {
  const fy = Number(new URL(request.url).searchParams.get("fy"));
  if (!(fy > 2500)) return NextResponse.json({ error: "กรุณาระบุปีงบประมาณ" }, { status: 400 });
  const buffer = await buildVoucherRegisterPdf(await createClient(), fy);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `ทะเบียนคุมใบสำคัญคู่จ่าย-${fy}.pdf`) },
  });
}
