import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetRegisterPdfData, renderAssetRegisterPdfBuffer } from "@/lib/pdf/build-asset-register-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const result = await buildAssetRegisterPdfData(supabase, id);
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
