import type { createClient } from "@/lib/supabase/server";

// ทะเบียนคุมจัดซื้อจัดจ้าง — รวมงานซื้อและงานจ้าง (proc_purchase_requests) ของปีงบประมาณปัจจุบันที่ตั้งไว้
// ใช้ร่วมกันระหว่างหน้าเว็บ / พิมพ์ PDF / ส่งออก Excel — ตัวกรองส่งทาง query string: type, q

export type ProcurementRegisterRow = {
  id: string;
  doc_type: "ซื้อ" | "จ้าง";
  doc_no: string;
  record_date: string;
  order_date: string | null;
  inspected_date: string | null;
  item_name: string | null;
  vendor_name: string | null;
  approval_no: string | null;
  project_name: string | null;
  amount: number;
  photo_count: number;
  /** หักภาษี ณ ที่จ่าย 1% (ไม่รวม VAT 7%) เมื่อจ่ายครั้งละตั้งแต่ 10,000 บาท — ต่ำกว่านั้น 0 */
  withholding: number;
  net: number;
  status: string;
  report_date: string | null;
  egp_no: string | null;
};

const SHORT_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-09-17" → "17 ก.ย. 69" */
export function shortThaiDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${SHORT_MONTHS[m]} ${String(y + 543).slice(-2)}`;
}

/** ภาษีหัก ณ ที่จ่าย 1% ของยอดก่อน VAT เมื่อจ่ายตั้งแต่ 10,000 บาทขึ้นไป (ส่วนราชการ) */
export function withholdingTax(amount: number): number {
  return amount >= 10000 ? Math.round((amount / 1.07) * 0.01 * 100) / 100 : 0;
}

/** สถานะตามขั้นตอนล่าสุดที่บันทึกวันไว้ */
function stepStatus(r: { doc_type: string; order_date: string | null; inspected_date: string | null; report_date: string | null }) {
  if (r.report_date) return "ขอเบิกจ่ายแล้ว";
  if (r.inspected_date) return "ตรวจรับแล้ว";
  if (r.order_date) return `สั่ง${r.doc_type}แล้ว`;
  return `รายงานขอ${r.doc_type}`;
}

export type ProcurementRegisterFilter = { type?: string; q?: string };

export function filterFromSearchParams(sp: URLSearchParams): ProcurementRegisterFilter {
  return { type: sp.get("type") || undefined, q: sp.get("q") || undefined };
}

/** เลขลำดับในเลขที่ "<ลำดับ>/<ปี>" สำหรับเรียงตามเลขที่ */
function docSeq(no: string) {
  const n = Number(no.split("/")[0]);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export function applyRegisterFilter(rows: ProcurementRegisterRow[], f: ProcurementRegisterFilter) {
  const q = f.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!f.type || r.doc_type === f.type) &&
      (!q || [r.doc_no, r.item_name, r.vendor_name, r.project_name, r.approval_no].some((v) => v?.toLowerCase().includes(q))),
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof import("@/lib/supabase/client").createClient>;

/** ดึงทะเบียนของปีงบประมาณปัจจุบัน (ปีที่เปิดอยู่ หรือปีล่าสุด) — เรียงตามประเภท แล้วตามเลขที่ */
export async function fetchProcurementRegister(supabase: Supabase): Promise<{ year: number | null; rows: ProcurementRegisterRow[] }> {
  const { data: years } = await supabase.from("plan_budget_years").select("year, is_open").order("year", { ascending: false });
  const current = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
  let query = supabase
    .from("proc_purchase_requests")
    .select(
      "id, doc_type, doc_no, record_date, order_date, inspected_date, report_date, egp_no, item_name, amount, proc_vendors(name), proc_approvals(doc_number), plan_projects(name), proc_purchase_photos(id)",
    );
  if (current) {
    const ce = current.year - 543;
    query = query.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    doc_type: r.doc_type,
    doc_no: r.doc_no,
    record_date: r.record_date,
    order_date: r.order_date,
    inspected_date: r.inspected_date,
    item_name: r.item_name,
    vendor_name: (r.proc_vendors as unknown as { name: string } | null)?.name ?? null,
    approval_no: (r.proc_approvals as unknown as { doc_number: string | null } | null)?.doc_number ?? null,
    project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? null,
    amount: Number(r.amount),
    photo_count: (r.proc_purchase_photos as unknown as { id: string }[] | null)?.length ?? 0,
    report_date: r.report_date,
    egp_no: r.egp_no,
    withholding: withholdingTax(Number(r.amount)),
    net: Math.round((Number(r.amount) - withholdingTax(Number(r.amount))) * 100) / 100,
    status: stepStatus(r),
  }));
  rows.sort((a, b) => (a.doc_type === b.doc_type ? docSeq(a.doc_no) - docSeq(b.doc_no) : a.doc_type === "ซื้อ" ? -1 : 1));
  return { year: current?.year ?? null, rows };
}
