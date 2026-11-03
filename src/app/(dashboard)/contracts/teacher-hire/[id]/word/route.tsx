import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTeacherHire } from "@/lib/pdf/build-teacher-hire-pdf";
import { renderTeacherHireDocxBuffer } from "@/lib/docx/build-teacher-hire-docx";
import { teacherHireFileLabel } from "@/lib/teacher-hire-contract";
import { contentDisposition } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const loaded = await loadTeacherHire(supabase, id);
  if (!loaded) return NextResponse.json({ error: "ไม่พบรายการ (หรือไม่มีสิทธิ์ดู)" }, { status: 404 });
  const buffer = await renderTeacherHireDocxBuffer(loaded.contract, loaded.ctx);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": contentDisposition("attachment", `${teacherHireFileLabel(loaded.contract)}.docx`),
    },
  });
}
