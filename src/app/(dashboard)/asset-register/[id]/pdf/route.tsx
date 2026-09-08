import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetRegisterPdfData, renderAssetRegisterPdfBuffer } from "@/lib/pdf/build-asset-register-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // สวิตช์แสดง/ไม่แสดงรูปภาพและ QR Code ใน PDF ส่งมาทาง query string จากหน้าทะเบียนทรัพย์สิน
  // (?photo=0 / ?qr=0) — ไม่ระบุถือว่าแสดงตามค่าเริ่มต้น
  const url = new URL(request.url);
  const showPhoto = url.searchParams.get("photo") !== "0";
  const showQr = url.searchParams.get("qr") !== "0";

  const result = await buildAssetRegisterPdfData(supabase, id, { showPhoto, showQr });
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  const buffer = await renderAssetRegisterPdfBuffer(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `${result.fileLabel}.pdf`),
      // ไม่ให้เบราว์เซอร์แคช PDF ไว้ที่ URL เดิม — มิเช่นนั้นหลังแก้ไขรายการแล้วกด "พิมพ์" ซ้ำ
      // (URL เดิมเพราะอิงตาม id) อาจยังเห็นข้อมูลเก่าจากแคชแทนที่จะดึงข้อมูลใหม่จากฐานข้อมูล
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
