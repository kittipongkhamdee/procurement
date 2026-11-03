import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadServiceHire, renderServiceHirePdfBuffer } from "@/lib/pdf/build-service-hire-pdf";
import { serviceHireFileLabel } from "@/lib/service-hire-contract";
import { contentDisposition } from "@/lib/http";

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const loaded = await loadServiceHire(supabase, id);
  if (!loaded) return NextResponse.json({ error: "ไม่พบรายการ (หรือไม่มีสิทธิ์ดู)" }, { status: 404 });
  const buffer = await renderServiceHirePdfBuffer(loaded.contract, loaded.ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${serviceHireFileLabel(loaded.contract)}.pdf`) },
  });
}
