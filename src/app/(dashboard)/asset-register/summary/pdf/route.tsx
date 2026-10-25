import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-actions";
import { buildAssetSummaryPdfData, renderAssetSummaryPdfBuffer } from "@/lib/pdf/build-asset-summary-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request) {
  // ครูทั่วไปดูทะเบียนได้อย่างเดียว ไม่มีสิทธิ์ส่งออก/พิมพ์ (ซ่อนปุ่มที่หน้าจอ + กันตรงนี้ด้วยกันเปิดลิงก์เอง)
  const me = await getCurrentUser();
  if (!me || me.role === "teacher") return new NextResponse("ไม่มีสิทธิ์ส่งออกข้อมูลนี้", { status: 403 });

  const url = new URL(request.url);
  const supabase = await createClient();

  const data = await buildAssetSummaryPdfData(supabase, {
    categoryId: url.searchParams.get("category") ?? undefined,
    conditionId: url.searchParams.get("condition") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });

  const buffer = await renderAssetSummaryPdfBuffer(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", "สรุปรายการทรัพย์สิน.pdf"),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
