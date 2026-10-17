import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { UrgentDocument, type UrgentData } from "@/lib/pdf/urgent-document";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) — บันทึกรายงานขอซื้อ/จ้าง
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("proc_urgent_reports")
    .select("approval_id, doc_no, doc_type, record_date, purchase_date, subject, reason, work_text, amount, payee, receipt_book, receipt_no, receipt_date, responsible_name, responsible_position")
    .eq("id", id)
    .maybeSingle();
  if (!r) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  // อ้างอิงบันทึกขออนุมัติที่ยังไม่อนุมัติ → ยังพิมพ์ไม่ได้
  if (r.approval_id) {
    const { data: ap } = await supabase.from("proc_approvals").select("status").eq("id", r.approval_id).maybeSingle();
    if (ap?.status !== "อนุมัติ") return NextResponse.json({ error: "บันทึกขออนุมัติที่อ้างอิงยังไม่อนุมัติ — พิมพ์ได้เมื่อผู้อำนวยการอนุมัติแล้ว" }, { status: 403 });
  }
  const [{ data: settings }, { data: school }] = await Promise.all([
    supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_director", "doc_signer_procurement_officer", "doc_signer_procurement_head"]),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  const s = new Map((settings ?? []).map((x) => [x.key, x.value]));
  const data: UrgentData = {
    ...r,
    doc_type: r.doc_type === "จ้าง" ? "จ้าง" : "ซื้อ",
    amount: Number(r.amount),
    school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
    education_area: school?.education_area ?? null,
    procurement_officer: s.get("doc_signer_procurement_officer") ?? "นางสาวโสรดา  ศรีสุข",
    procurement_head: s.get("doc_signer_procurement_head") ?? "นายกิตติพงษ์   คำดี",
    director: s.get("approval_signer_director") ?? null,
  };
  const buffer = await renderToBuffer(<UrgentDocument data={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `รายงานขอ${data.doc_type}-เร่งด่วน-${r.doc_no ?? ""}.pdf`) },
  });
}
