import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { contentDisposition } from "@/lib/http";
import { StockLedgerDocument } from "@/lib/pdf/stock-ledger-document";
import type { StockMove } from "@/lib/stock";

// บัญชีวัสดุ PDF — ?id=<วัสดุ> พิมพ์บัญชีเดียว, ไม่ส่ง = ทุกวัสดุ (?category= กรองตามประเภท)
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const supabase = await createClient();
  let q = supabase.from("proc_stock_items").select("id, code, category, name, size_desc, unit, location, max_qty, min_qty").order("category").order("code");
  if (sp.get("id")) q = q.eq("id", sp.get("id")!);
  if (sp.get("category")) q = q.eq("category", sp.get("category")!);
  const [{ data: items }, { data: school }] = await Promise.all([
    q,
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
  ]);
  if (!items?.length) return NextResponse.json({ error: "ไม่พบวัสดุ" }, { status: 404 });
  const { data: moves } = await supabase.from("proc_stock_moves").select("*").in("item_id", items.map((i) => i.id));
  const byItem = new Map<string, StockMove[]>();
  ((moves ?? []) as unknown as StockMove[]).forEach((m) => byItem.set(m.item_id, [...(byItem.get(m.item_id) ?? []), { ...m, qty: Number(m.qty), unit_price: Number(m.unit_price) }]));
  const buffer = await renderToBuffer(
    <StockLedgerDocument
      items={items.map((i) => ({ ...i, max_qty: i.max_qty != null ? Number(i.max_qty) : null, min_qty: i.min_qty != null ? Number(i.min_qty) : null, moves: byItem.get(i.id) ?? [] }))}
      agency={school?.education_area ?? "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"}
      unitName={school?.school_name ?? "โรงเรียนตาเบาวิทยา"}
    />,
  );
  const name = items.length === 1 ? `บัญชีวัสดุ-${items[0].code ?? items[0].name}.pdf` : "บัญชีวัสดุ.pdf";
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Cache-Control": "no-store", "Content-Type": "application/pdf", "Content-Disposition": contentDisposition("inline", name) },
  });
}
