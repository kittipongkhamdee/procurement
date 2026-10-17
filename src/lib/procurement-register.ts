import type { createClient } from "@/lib/supabase/server";

// ทะเบียนคุมจัดซื้อจัดจ้าง — รวมงานซื้อ/งานจ้าง/ว 804 (proc_purchase_requests), รายงาน ว 119 (proc_w119_reports) และ
// จัดซื้อ/จัดจ้างกรณีเร่งด่วน (proc_urgent_reports) ของปีงบประมาณปัจจุบัน — คอลัมน์ "ประเภท" แยก ซื้อ/จ้าง/ว 804/ว 119/เร่งด่วน
// ใช้ร่วมกันระหว่างหน้าเว็บ / พิมพ์ PDF / ส่งออก Excel — ตัวกรองส่งทาง query string: type, q

/** ประเภทในทะเบียน (ลำดับนี้ = ลำดับการเรียง) */
export const REGISTER_CATEGORIES = ["ซื้อ", "จ้าง", "ว 804", "ว 119", "เร่งด่วน"] as const;
export type RegisterCategory = (typeof REGISTER_CATEGORIES)[number];
/** หน้าที่ไปแก้ไขรายการแต่ละประเภท */
export const REGISTER_PAGE: Record<RegisterCategory, string> = {
  ซื้อ: "/supplies/purchase",
  จ้าง: "/supplies/hire",
  "ว 804": "/supplies/w804",
  "ว 119": "/supplies/w119",
  เร่งด่วน: "/supplies/urgent",
};

export type ProcurementRegisterRow = {
  id: string;
  category: RegisterCategory;
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
  register_note: string | null;
  method: string;
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

/** หมายเหตุ — ใช้กับกรณีอื่นๆ (ประเภทแยกคอลัมน์แล้ว) */
export function registerNote(r: ProcurementRegisterRow) {
  return [r.egp_no ? `e-GP ${r.egp_no}` : "", r.register_note ?? ""].filter(Boolean).join(" · ");
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
      (!f.type || r.category === f.type) &&
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
      "id, doc_type, doc_no, record_date, order_date, inspected_date, report_date, egp_no, register_note, method, item_name, amount, proc_vendors(name), proc_approvals(doc_number), plan_projects(name), proc_purchase_photos(id)",
    );
  if (current) {
    const ce = current.year - 543;
    query = query.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
  }
  let w119Query = supabase
    .from("proc_w119_reports")
    .select("id, doc_no, record_date, purchase_date, amount, register_note, proc_approvals(doc_number), plan_projects(name), proc_w119_items(name, vendor), proc_w119_photos(id)");
  let urgentQuery = supabase
    .from("proc_urgent_reports")
    .select("id, doc_no, doc_type, record_date, purchase_date, subject, register_note, payee, responsible_name, amount, approval_id, project_id, proc_urgent_items(kind, name)");
  if (current) {
    const ce = current.year - 543;
    w119Query = w119Query.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
    urgentQuery = urgentQuery.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
  }
  const [{ data, error }, { data: w119 }, { data: urgent }, { data: approvals }, { data: projects }] = await Promise.all([
    query,
    w119Query,
    urgentQuery,
    supabase.from("proc_approvals").select("id, doc_number"),
    supabase.from("plan_projects").select("id, name"),
  ]);
  if (error) throw new Error(error.message);
  const approvalNo = new Map((approvals ?? []).map((a) => [a.id, a.doc_number]));
  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const extra = (amount: number) => ({ withholding: withholdingTax(amount), net: Math.round((amount - withholdingTax(amount)) * 100) / 100 });
  const w119Rows: ProcurementRegisterRow[] = (w119 ?? []).map((r) => {
    const items = (r.proc_w119_items as unknown as { name: string; vendor: string | null }[] | null) ?? [];
    const amount = Number(r.amount);
    return {
      id: r.id,
      category: "ว 119",
      doc_type: "ซื้อ",
      doc_no: r.doc_no,
      record_date: r.record_date,
      order_date: r.purchase_date,
      // ว 119 — รายงานนี้ถือเป็นหลักฐานการตรวจรับโดยอนุโลม
      inspected_date: r.purchase_date,
      item_name: items.map((i) => i.name).join(", ") || null,
      vendor_name: [...new Set(items.map((i) => i.vendor).filter(Boolean))].join(", ") || null,
      approval_no: (r.proc_approvals as unknown as { doc_number: string | null } | null)?.doc_number ?? null,
      project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? null,
      amount,
      photo_count: (r.proc_w119_photos as unknown as { id: string }[] | null)?.length ?? 0,
      report_date: r.record_date,
      egp_no: null,
      register_note: r.register_note,
      method: "w119",
      ...extra(amount),
      status: "รายงาน ว 119",
    };
  });
  const urgentRows: ProcurementRegisterRow[] = (urgent ?? []).map((r) => {
    const items = (r.proc_urgent_items as unknown as { kind: string; name: string }[] | null) ?? [];
    const amount = Number(r.amount);
    return {
      id: r.id,
      category: "เร่งด่วน",
      doc_type: r.doc_type === "จ้าง" ? "จ้าง" : "ซื้อ",
      doc_no: r.doc_no ?? "",
      record_date: r.record_date,
      order_date: r.purchase_date,
      // รายงานกรณีเร่งด่วน (ข้อ 79 วรรคสอง) ถือเป็นหลักฐานการตรวจรับโดยอนุโลม
      inspected_date: r.purchase_date,
      item_name: items.length ? items.map((i) => `${i.kind}${i.name}`).join(", ") : r.subject,
      vendor_name: r.payee ?? r.responsible_name,
      approval_no: r.approval_id ? (approvalNo.get(r.approval_id) ?? null) : null,
      project_name: r.project_id ? (projectName.get(r.project_id) ?? null) : null,
      amount,
      photo_count: 0,
      report_date: r.record_date,
      egp_no: null,
      register_note: r.register_note,
      method: "urgent",
      ...extra(amount),
      status: "รายงานกรณีเร่งด่วน",
    };
  });
  const purchaseRows: ProcurementRegisterRow[] = (data ?? []).map((r) => ({
    id: r.id,
    category: r.method === "w804" ? "ว 804" : r.doc_type,
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
    register_note: r.register_note,
    method: r.method,
    withholding: withholdingTax(Number(r.amount)),
    net: Math.round((Number(r.amount) - withholdingTax(Number(r.amount))) * 100) / 100,
    status: stepStatus(r),
  }));
  const rows = [...purchaseRows, ...w119Rows, ...urgentRows];
  const order = (c: RegisterCategory) => REGISTER_CATEGORIES.indexOf(c);
  // เรียงตามวันที่บันทึกข้อความ แล้วตามลำดับเลขที่ (ประเภทเดียวกันวันเดียวกัน) — ประเภทต่างกันวันเดียวกันเรียงตามลำดับประเภท
  rows.sort((a, b) => a.record_date.localeCompare(b.record_date) || order(a.category) - order(b.category) || docSeq(a.doc_no) - docSeq(b.doc_no));
  return { year: current?.year ?? null, rows };
}
