import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { applyRegisterFilter, fetchProcurementRegister, filterFromSearchParams } from "@/lib/procurement-register";
import { ProcurementRegisterDocument } from "@/lib/pdf/procurement-register-document";

export async function GET(request: Request) {
  const supabase = await createClient();
  const filter = filterFromSearchParams(new URL(request.url).searchParams);
  const [{ year, rows }, { data: school }] = await Promise.all([
    fetchProcurementRegister(supabase),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  const buffer = await renderToBuffer(
    <ProcurementRegisterDocument rows={applyRegisterFilter(rows, filter)} schoolName={school?.school_name ?? "โรงเรียนตาเบาวิทยา"} educationArea={school?.education_area ?? null} year={year} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition("inline", "ทะเบียนคุมจัดซื้อจัดจ้าง.pdf"),
    },
  });
}
