import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth-actions";
import { buildAssetRegisterBatchPdfData, renderAssetRegisterBatchPdfBuffer } from "@/lib/pdf/build-asset-register-pdf";
import type { AssetRegisterPagesChoice } from "@/lib/pdf/asset-register-document";
import { contentDisposition } from "@/lib/http";

// พิมพ์ทะเบียนคุมทรัพย์สิน "ทุกรายการที่ตรงตัวกรอง" ต่อกันเป็นไฟล์เดียว — เลือกหน้าที่จะพิมพ์ได้ (?pages=front|history|both)
// ตัวกรองเหมือนหน้าจอ: location / category / condition / q และสวิตช์รูปภาพ/QR (?photo=0 / ?qr=0)
export const maxDuration = 60;

export async function GET(request: Request) {
  // ครูทั่วไปดูทะเบียนได้อย่างเดียว ไม่มีสิทธิ์ส่งออก/พิมพ์
  const me = await getCurrentUser();
  if (!me || me.role === "teacher") return new NextResponse("ไม่มีสิทธิ์พิมพ์ข้อมูลนี้", { status: 403 });

  const url = new URL(request.url);
  const supabase = await createClient();
  const pagesParam = url.searchParams.get("pages");
  const pages: AssetRegisterPagesChoice = pagesParam === "front" || pagesParam === "history" ? pagesParam : "both";

  const result = await buildAssetRegisterBatchPdfData(
    supabase,
    {
      categoryId: url.searchParams.get("category") ?? undefined,
      conditionId: url.searchParams.get("condition") ?? undefined,
      location: url.searchParams.get("location") ?? undefined,
      search: url.searchParams.get("q") ?? undefined,
    },
    { showPhoto: url.searchParams.get("photo") !== "0", showQr: url.searchParams.get("qr") !== "0" },
  );
  if ("error" in result) return new NextResponse(result.error, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const buffer = await renderAssetRegisterBatchPdfBuffer(result.items, pages);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `ทะเบียนคุมทรัพย์สิน-${result.items.length}รายการ.pdf`),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
