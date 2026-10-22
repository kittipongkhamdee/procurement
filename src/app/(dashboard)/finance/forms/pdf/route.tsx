import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { TravelClaimDocument, type TravelClaim } from "@/lib/pdf/travel-claim-document";
import { StudentReceiptDocument, type StudentReceipt } from "@/lib/pdf/receipt-forms-document";

// แบบใบสำคัญรับเงิน (เอกสารแนบ ๒ นักเรียน) / แบบ 8708 — ฟอร์มหน้าเว็บ POST ข้อมูลมา (รายชื่อนักเรียนยาวเกิน query string)
// ไม่บันทึกลงฐานข้อมูล พิมพ์อย่างเดียว
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const fd = await request.formData();
  const kind = String(fd.get("kind") ?? "");
  let data: unknown;
  try {
    data = JSON.parse(String(fd.get("data") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const buffer =
    kind === "student"
      ? await renderToBuffer(<StudentReceiptDocument data={data as StudentReceipt} />)
      : kind === "travel"
        ? await renderToBuffer(<TravelClaimDocument data={await withLoanNumber(supabase, data as TravelClaim)} />)
        : null;
  if (!buffer) return NextResponse.json({ error: "ไม่รู้จักแบบฟอร์ม" }, { status: 400 });
  const name = kind === "student" ? "ใบสำคัญรับเงิน-นักเรียน.pdf" : "ใบเบิกค่าใช้จ่ายเดินทางไปราชการ-8708.pdf";
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", name) },
  });
}

/** แบบ 8708 ที่ผูกสัญญายืมเงิน: ใช้เลขที่/วันที่รับเงินล่าสุดของสัญญา (สัญญาที่ครูยื่นอาจออกเลขภายหลัง) */
async function withLoanNumber(supabase: Awaited<ReturnType<typeof createClient>>, d: TravelClaim): Promise<TravelClaim> {
  if (!d.loan_id) return d;
  const { data: l } = await supabase.from("proc_loan_contracts").select("doc_no, received_date").eq("id", d.loan_id).maybeSingle();
  if (!l) return d;
  return { ...d, loan_no: l.doc_no ?? d.loan_no, loan_date: l.received_date ?? d.loan_date };
}
