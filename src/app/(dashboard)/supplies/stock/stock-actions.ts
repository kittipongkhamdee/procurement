"use server";

// บัญชีวัสดุ (/supplies/stock) และใบเบิกพัสดุ (/supplies/requisitions)
// - ดึงรายการที่ติ๊กเป็น "วัสดุ" จากรายการจัดซื้อ (งานซื้อ/จ้าง/ว 804, ว 119, เร่งด่วน) เข้าเป็นรายการรับ
// - เบิก (จ่าย) ตัดตามล็อตที่รับเข้าก่อน (FIFO) — 1 ใบเบิก = หลายรายการจ่าย ราคาจ่ายตามล็อต
// คืน { error } แทนการ throw — production ของ Next ซ่อนข้อความ error ที่ throw จาก server action

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assignDocNumber, docNumberTaken, isAdminUser } from "@/lib/doc-number-server";
import { allocateFifo, guessStockCategory, nextStockCode, type StockMove } from "@/lib/stock";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result = { error?: string; id?: string; message?: string };
const NO_PERMISSION = "ไม่มีสิทธิ์ดำเนินการ (เฉพาะเจ้าหน้าที่พัสดุ/การเงินและผู้ดูแลระบบ)";

export type StockSourceType = "purchase" | "w119" | "urgent";

function done(): void {
  revalidatePath("/supplies/stock");
  revalidatePath("/supplies/requisitions");
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

// ---------- วัสดุ (หัวบัญชี) ----------

export async function saveStockItem(id: string | null, formData: FormData): Promise<Result> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  if (!str("name")) return { error: "กรุณากรอกชื่อวัสดุ" };
  if (!str("unit")) return { error: "กรุณากรอกหน่วยนับ" };
  const supabase = await createClient();
  const fields = {
    code: str("code") || null,
    category: str("category") || "วัสดุสำนักงาน",
    name: str("name"),
    size_desc: str("size_desc") || null,
    unit: str("unit"),
    location: str("location") || null,
    max_qty: num(formData.get("max_qty")),
    min_qty: num(formData.get("min_qty")),
    note: str("note") || null,
  };
  if (!fields.code) {
    const { data: codes } = await supabase.from("proc_stock_items").select("code").eq("category", fields.category);
    fields.code = nextStockCode(fields.category, (codes ?? []).map((c) => c.code));
  }
  const q = id ? supabase.from("proc_stock_items").update(fields).eq("id", id).select("id") : supabase.from("proc_stock_items").insert(fields).select("id");
  const { data, error } = await q;
  if (error) return { error: error.code === "23505" ? `มีวัสดุ "${fields.name}" หน่วย "${fields.unit}" อยู่แล้ว` : error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  done();
  return { id: data[0].id };
}

export async function deleteStockItem(id: string): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from("proc_stock_moves").select("id", { count: "exact", head: true }).eq("item_id", id);
  if (count) return { error: "ลบไม่ได้ — วัสดุนี้มีรายการรับ-จ่ายแล้ว (ลบรายการรับ-จ่ายก่อน)" };
  const { data, error } = await supabase.from("proc_stock_items").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  done();
  return {};
}

// ---------- รับเข้าเอง (ยอดยกมา / รับจากแหล่งอื่น) ----------

export async function addStockReceipt(itemId: string, formData: FormData): Promise<Result> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const qty = num(formData.get("qty"));
  const date = str("move_date");
  if (!date) return { error: "กรุณาเลือกวันที่" };
  if (!(qty && qty > 0)) return { error: "จำนวนต้องมากกว่า 0" };
  const opening = str("opening") === "1";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proc_stock_moves")
    .insert({
      item_id: itemId,
      move_date: date,
      kind: "in",
      qty,
      unit_price: num(formData.get("unit_price")) ?? 0,
      party: opening ? "ยอดยกมา" : str("party") || null,
      doc_no: str("doc_no") || null,
      note: opening ? "ยอดยกมา" : str("note") || null,
      source_type: opening ? "opening" : "manual",
    })
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  done();
  return {};
}

export async function deleteStockMove(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data: move } = await supabase.from("proc_stock_moves").select("kind, requisition_id").eq("id", id).maybeSingle();
  if (!move) return { error: "ไม่พบรายการ" };
  if (move.kind === "out" && move.requisition_id) return { error: "รายการจ่ายนี้อยู่ในใบเบิก — ลบที่เมนูใบเบิกพัสดุแทน" };
  const { count } = await supabase.from("proc_stock_moves").select("id", { count: "exact", head: true }).eq("lot_id", id);
  if (count) return { error: "ลบไม่ได้ — ล็อตนี้มีการเบิกจ่ายไปแล้ว (ลบใบเบิกที่เกี่ยวข้องก่อน)" };
  const { data, error } = await supabase.from("proc_stock_moves").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  done();
  return {};
}

// ---------- ใบเบิก (จ่าย FIFO) ----------

export type RequisitionLine = { item_id: string; requested: number; issued: number; note?: string };

async function issueLines(
  supabase: Supabase,
  req: { id: string; doc_no: string | null; req_date: string; requester_name: string },
  lines: RequisitionLine[],
): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.item_id))];
  const { data: moves } = await supabase.from("proc_stock_moves").select("*").in("item_id", ids);
  const all = (moves ?? []) as unknown as StockMove[];
  const rows: Record<string, unknown>[] = [];
  for (const l of lines) {
    if (!(l.issued > 0)) continue;
    // ล็อตที่รับเข้าไม่หลังวันที่เบิก
    const itemMoves = all.filter((m) => m.item_id === l.item_id && (m.kind === "out" || m.move_date <= req.req_date));
    const parts = allocateFifo(itemMoves, l.issued);
    if (!parts) return `จำนวนเบิกเกินยอดคงเหลือ ณ วันที่เบิก`;
    parts.forEach((p, i) => {
      rows.push({
        item_id: l.item_id,
        move_date: req.req_date,
        kind: "out",
        qty: p.qty,
        requested_qty: i === 0 ? l.requested : null,
        unit_price: p.unitPrice,
        party: req.requester_name,
        doc_no: req.doc_no,
        note: l.note || null,
        lot_id: p.lotId,
        requisition_id: req.id,
      });
      // ล็อตที่ถูกตัดในบรรทัดนี้ — ใส่ลงชุดคำนวณ เผื่อวัสดุเดียวกันซ้ำในใบเดียว
      all.push({ ...(rows[rows.length - 1] as unknown as StockMove), id: `tmp-${rows.length}`, created_at: new Date().toISOString() });
    });
  }
  if (rows.length === 0) return "ไม่มีรายการที่เบิกได้";
  const { error } = await supabase.from("proc_stock_moves").insert(rows as never);
  return error?.message ?? null;
}

export async function createRequisition(formData: FormData): Promise<Result> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const date = str("req_date");
  if (!date) return { error: "กรุณาเลือกวันที่เบิก" };
  if (!str("requester_name")) return { error: "กรุณากรอกชื่อผู้เบิก" };
  let lines: RequisitionLine[] = [];
  try {
    lines = (JSON.parse(str("lines_json") || "[]") as RequisitionLine[]).filter((l) => l.item_id && Number(l.issued) > 0);
  } catch {
    return { error: "รายการไม่ถูกต้อง" };
  }
  if (lines.length === 0) return { error: "กรุณาเลือกวัสดุและจำนวนที่เบิกอย่างน้อย 1 รายการ" };
  const supabase = await createClient();
  const admin = await isAdminUser(supabase);
  const docInput = str("doc_no");
  if (admin && docInput && (await docNumberTaken(supabase, "requisition", docInput))) return { error: `เลขที่ ${docInput} ถูกใช้แล้ว` };
  const docNo = admin && docInput ? docInput : await assignDocNumber(supabase, "requisition", date);
  const { data: req, error } = await supabase
    .from("proc_stock_requisitions")
    .insert({ doc_no: docNo, req_date: date, requester_name: str("requester_name"), requester_position: str("requester_position") || null, purpose: str("purpose") || null })
    .select("id, doc_no, req_date, requester_name")
    .single();
  if (error) return { error: error.message.includes("row-level") ? NO_PERMISSION : error.message };
  const issueError = await issueLines(
    supabase,
    req,
    lines.map((l) => ({ ...l, requested: Number(l.requested) || Number(l.issued), issued: Number(l.issued) })),
  );
  if (issueError) {
    await supabase.from("proc_stock_requisitions").delete().eq("id", req.id);
    return { error: issueError };
  }
  done();
  return { id: req.id, message: req.doc_no ? `บันทึกใบเบิกเลขที่ ${req.doc_no} แล้ว` : "บันทึกใบเบิกแล้ว" };
}

export async function deleteRequisition(id: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proc_stock_requisitions").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: NO_PERMISSION };
  done();
  return {};
}

// ---------- ดึงจากรายการจัดซื้อ ----------

type SourceItem = { seq: number; name: string; qty: number; unit: string; unit_price: number; party: string | null };
type SourceInfo = { doc_no: string; date: string; requester: string | null; requester_position: string | null; purpose: string | null; items: SourceItem[] };

/** รายการวัสดุของเอกสารจัดซื้อ 1 ฉบับ (เฉพาะที่ติ๊กเป็นวัสดุ) */
async function loadSource(supabase: Supabase, type: StockSourceType, id: string): Promise<SourceInfo | null> {
  if (type === "purchase") {
    const { data: r } = await supabase
      .from("proc_purchase_requests")
      .select("doc_no, record_date, delivered_date, inspected_date, inspector_name, inspector_position, reason, proc_vendors(name)")
      .eq("id", id)
      .maybeSingle();
    if (!r) return null;
    const { data: items } = await supabase.from("proc_purchase_items").select("seq, name, qty, unit, unit_price, item_class").eq("purchase_request_id", id).order("seq");
    const vendor = (r.proc_vendors as unknown as { name: string } | null)?.name ?? null;
    return {
      doc_no: r.doc_no,
      date: r.inspected_date ?? r.delivered_date ?? r.record_date,
      requester: r.inspector_name,
      requester_position: r.inspector_position,
      purpose: r.reason,
      items: (items ?? [])
        .filter((i) => i.item_class === "material" && i.name && Number(i.qty) > 0)
        .map((i) => ({ seq: i.seq, name: i.name!.trim(), qty: Number(i.qty), unit: i.unit?.trim() || "หน่วย", unit_price: Number(i.unit_price ?? 0), party: vendor })),
    };
  }
  if (type === "w119") {
    const { data: r } = await supabase.from("proc_w119_reports").select("doc_no, purchase_date, responsible_name, responsible_position, purpose").eq("id", id).maybeSingle();
    if (!r) return null;
    const { data: items } = await supabase.from("proc_w119_items").select("seq, name, qty, unit, amount, vendor, item_class").eq("report_id", id).order("seq");
    return {
      doc_no: r.doc_no,
      date: r.purchase_date,
      requester: r.responsible_name,
      requester_position: r.responsible_position,
      purpose: r.purpose,
      items: (items ?? [])
        .filter((i) => i.item_class === "material")
        .map((i) => {
          const qty = Number(i.qty) || 1;
          return { seq: i.seq, name: i.name.trim(), qty, unit: i.unit?.trim() || "หน่วย", unit_price: Math.round((Number(i.amount) / qty) * 100) / 100, party: i.vendor };
        }),
    };
  }
  const { data: r } = await supabase.from("proc_urgent_reports").select("doc_no, purchase_date, responsible_name, responsible_position, work_text, payee").eq("id", id).maybeSingle();
  if (!r) return null;
  const { data: items } = await supabase.from("proc_urgent_items").select("seq, name, qty, unit, amount, item_class").eq("report_id", id).order("seq");
  return {
    doc_no: r.doc_no ?? "",
    date: r.purchase_date,
    requester: r.responsible_name,
    requester_position: r.responsible_position,
    purpose: r.work_text,
    items: (items ?? [])
      .filter((i) => i.item_class === "material")
      .map((i) => {
        const qty = Number(i.qty) || 1;
        return { seq: i.seq, name: i.name.trim(), qty, unit: i.unit?.trim() || "หน่วย", unit_price: Math.round((Number(i.amount) / qty) * 100) / 100, party: r.payee ?? r.responsible_name };
      }),
  };
}

const SOURCE_LABEL: Record<StockSourceType, string> = { purchase: "จัดซื้อ", w119: "ว 119", urgent: "เร่งด่วน" };

/** รับวัสดุเข้าบัญชีจากเอกสารจัดซื้อ — รายการที่ดึงแล้วข้าม (ไม่ซ้ำ) / autoIssue = ออกใบเบิกให้ผู้ตรวจรับ/ผู้รับผิดชอบทั้งหมดทันที */
export async function importFromProcurement(type: StockSourceType, id: string, autoIssue: boolean): Promise<Result> {
  const supabase = await createClient();
  const src = await loadSource(supabase, type, id);
  if (!src) return { error: "ไม่พบรายการจัดซื้อ" };
  if (src.items.length === 0) return { error: "เอกสารนี้ไม่มีรายการที่ติ๊กเป็นวัสดุ" };
  const { data: existing } = await supabase.from("proc_stock_moves").select("source_seq").eq("source_type", type).eq("source_id", id).eq("kind", "in");
  const done_ = new Set((existing ?? []).map((m) => m.source_seq));
  const todo = src.items.filter((i) => !done_.has(i.seq));
  if (todo.length === 0) return { error: "ดึงรายการของเอกสารนี้เข้าบัญชีวัสดุครบแล้ว" };

  const { data: stockItems } = await supabase.from("proc_stock_items").select("id, name, unit, code, category");
  const items = stockItems ?? [];
  const lines: RequisitionLine[] = [];
  for (const it of todo) {
    let item = items.find((s) => s.name.toLowerCase() === it.name.toLowerCase() && s.unit.toLowerCase() === it.unit.toLowerCase());
    if (!item) {
      const category = guessStockCategory(it.name);
      const code = nextStockCode(category, items.filter((s) => s.category === category).map((s) => s.code));
      const { data: created, error } = await supabase.from("proc_stock_items").insert({ name: it.name, unit: it.unit, category, code }).select("id, name, unit, code, category").single();
      if (error) return { error: error.message.includes("row-level") ? NO_PERMISSION : error.message };
      item = created;
      items.push(created);
    }
    const { error } = await supabase.from("proc_stock_moves").insert({
      item_id: item.id,
      move_date: src.date,
      kind: "in",
      qty: it.qty,
      unit_price: it.unit_price,
      party: it.party,
      doc_no: src.doc_no,
      note: `รับเข้าจาก${SOURCE_LABEL[type]} ${src.doc_no}`,
      source_type: type,
      source_id: id,
      source_seq: it.seq,
    });
    if (error) return { error: error.message.includes("row-level") ? NO_PERMISSION : error.message };
    lines.push({ item_id: item.id, requested: it.qty, issued: it.qty });
  }

  let message = `รับวัสดุเข้าบัญชี ${todo.length} รายการแล้ว`;
  if (autoIssue && src.requester) {
    const docNo = await assignDocNumber(supabase, "requisition", src.date);
    const { data: req, error } = await supabase
      .from("proc_stock_requisitions")
      .insert({ doc_no: docNo, req_date: src.date, requester_name: src.requester, requester_position: src.requester_position, purpose: src.purpose, source_type: type, source_id: id })
      .select("id, doc_no, req_date, requester_name")
      .single();
    if (error) return { error: `รับเข้าแล้ว แต่ออกใบเบิกไม่สำเร็จ: ${error.message}` };
    const issueError = await issueLines(supabase, req, lines);
    if (issueError) {
      await supabase.from("proc_stock_requisitions").delete().eq("id", req.id);
      return { error: `รับเข้าแล้ว แต่ออกใบเบิกไม่สำเร็จ: ${issueError}` };
    }
    message += ` และออกใบเบิก${req.doc_no ? `เลขที่ ${req.doc_no}` : ""} ให้ ${src.requester}`;
  }
  done();
  return { message };
}
