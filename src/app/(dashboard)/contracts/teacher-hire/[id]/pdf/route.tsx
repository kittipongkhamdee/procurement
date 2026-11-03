import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherHire, renderTeacherHirePdfBuffer } from "@/lib/pdf/build-teacher-hire-pdf";
import { teacherHireFileLabel } from "@/lib/teacher-hire-contract";
import { contentDisposition } from "@/lib/http";

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const loaded = await loadTeacherHire(supabase, id);
  if (!loaded) return NextResponse.json({ error: "ไม่พบรายการ (หรือไม่มีสิทธิ์ดู)" }, { status: 404 });
  const buffer = await renderTeacherHirePdfBuffer(loaded.contract, loaded.ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `${teacherHireFileLabel(loaded.contract)}.pdf`) },
  });
}
