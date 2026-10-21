import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { SpeakerReceiptDocument, StudentReceiptDocument, type SpeakerReceipt, type StudentReceipt } from "@/lib/pdf/receipt-forms-document";

// แบบใบสำคัญรับเงิน (เอกสารแนบ ๑ วิทยากร / ๒ นักเรียน) — ฟอร์มหน้าเว็บ POST ข้อมูลมา (รายชื่อนักเรียนยาวเกิน query string)
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
    kind === "speaker"
      ? await renderToBuffer(<SpeakerReceiptDocument data={data as SpeakerReceipt} />)
      : kind === "student"
        ? await renderToBuffer(<StudentReceiptDocument data={data as StudentReceipt} />)
        : null;
  if (!buffer) return NextResponse.json({ error: "ไม่รู้จักแบบฟอร์ม" }, { status: 400 });
  const name = kind === "speaker" ? "ใบสำคัญรับเงิน-วิทยากร.pdf" : "ใบสำคัญรับเงิน-นักเรียน.pdf";
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", name) },
  });
}
