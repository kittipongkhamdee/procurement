import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { describeFilter, fetchContractRegister, filterFromSearchParams } from "@/lib/contract-register";
import { ContractRegisterDocument } from "@/lib/pdf/contract-register-document";

export async function GET(request: Request) {
  const supabase = await createClient();
  const filter = filterFromSearchParams(new URL(request.url).searchParams);
  const [rows, { data: school }] = await Promise.all([
    fetchContractRegister(supabase, filter),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);
  const buffer = await renderToBuffer(
    <ContractRegisterDocument rows={rows} schoolName={school?.school_name ?? "โรงเรียนตาเบาวิทยา"} filterText={describeFilter(filter)} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", "ทะเบียนสัญญา.pdf") },
  });
}
