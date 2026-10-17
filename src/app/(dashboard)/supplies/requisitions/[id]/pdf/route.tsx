import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { RequisitionDocument } from "@/lib/pdf/requisition-document";

// ใบเบิกพัสดุ — รวมแถวจ่ายของวัสดุเดียวกัน (FIFO แตกหลายล็อต) เป็นบรรทัดเดียว
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: r } = await supabase.from("proc_stock_requisitions").select("doc_no, req_date, requester_name, requester_position, purpose").eq("id", id).maybeSingle();
  if (!r) return NextResponse.json({ error: "ไม่พบใบเบิก" }, { status: 404 });
  const [{ data: moves }, { data: settings }, { data: school }] = await Promise.all([
    supabase.from("proc_stock_moves").select("item_id, qty, requested_qty, note, created_at, proc_stock_items(name, unit)").eq("requisition_id", id).order("created_at"),
    supabase.from("proc_app_settings").select("key, value").in("key", ["doc_signer_procurement_officer", "doc_signer_procurement_head"]),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);
  const s = new Map((settings ?? []).map((x) => [x.key, x.value]));
  const lines = new Map<string, { name: string; unit: string | null; requested: number; issued: number; note: string | null }>();
  (moves ?? []).forEach((m) => {
    const item = m.proc_stock_items as unknown as { name: string; unit: string } | null;
    const cur = lines.get(m.item_id) ?? { name: item?.name ?? "-", unit: item?.unit ?? null, requested: 0, issued: 0, note: m.note };
    cur.issued += Number(m.qty);
    cur.requested += Number(m.requested_qty ?? 0);
    lines.set(m.item_id, cur);
  });
  const buffer = await renderToBuffer(
    <RequisitionDocument
      data={{
        ...r,
        school_name: school?.school_name ?? "โรงเรียนตาเบาวิทยา",
        items: [...lines.values()].map((l) => ({ ...l, requested: l.requested || l.issued })),
        payer_name: s.get("doc_signer_procurement_officer") ?? "นางสาวโสรดา  ศรีสุข",
        approver_name: s.get("doc_signer_procurement_head") ?? "นายกิตติพงษ์   คำดี",
      }}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", `ใบเบิกพัสดุ-${r.doc_no ?? ""}.pdf`) },
  });
}
