import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetTagSheetPdfData, renderAssetTagSheetPdfBuffer } from "@/lib/pdf/build-asset-tag-sheet-pdf";
import { contentDisposition } from "@/lib/http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "กรุณาเลือกรายการอย่างน้อย 1 รายการ" }, { status: 400 });
  }

  const supabase = await createClient();
  const result = await buildAssetTagSheetPdfData(supabase, ids);
  if (!result) {
    return NextResponse.json({ error: "ไม่พบรายการที่เลือก" }, { status: 404 });
  }

  const buffer = await renderAssetTagSheetPdfBuffer(result.items);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", `${result.fileLabel}.pdf`),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
