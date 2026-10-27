// รูปแบบเลขที่เอกสารงานพัสดุ — งานพัสดุออกเลขเอง แอดมินกำหนดรูปแบบได้ที่หน้าตั้งค่า (proc_app_settings)
// ตัวแปร: {n} = ลำดับที่ (นับใหม่ทุกปีงบ), {yyyy} = ปีงบประมาณ พ.ศ., {yy} = 2 หลักท้ายของปีงบ
// รูปแบบว่าง = ไม่เสนอเลขอัตโนมัติ (ผู้ใช้กรอกเองหรือเว้นว่างได้) — เลขที่เก็บในฐานข้อมูลเป็นข้อความเต็มตามที่พิมพ์

export const DOC_NUMBER_KINDS = [
  { kind: "purchase", key: "doc_number_format_purchase", label: "งานซื้อ + ว 804 (นับชุดเดียวกัน)", fallback: "{n}/{yyyy}" },
  { kind: "hire", key: "doc_number_format_hire", label: "งานจ้าง", fallback: "{n}/{yyyy}" },
  { kind: "w119", key: "doc_number_format_w119", label: "ว 119 ค่าใช้จ่ายบริหารงาน", fallback: "{n}/{yyyy} (ว119)" },
  { kind: "urgent", key: "doc_number_format_urgent", label: "จัดซื้อ/จัดจ้าง (กรณีจำเป็นเร่งด่วน)", fallback: "{n}/{yyyy} (เร่งด่วน)" },
  { kind: "requisition", key: "doc_number_format_requisition", label: "ใบเบิกวัสดุ", fallback: "จ {n}/{yyyy}" },
  { kind: "loan", key: "doc_number_format_loan", label: "สัญญาการยืมเงิน", fallback: "{n}/{yyyy}" },
  { kind: "claim", key: "doc_number_format_claim", label: "เบิกค่าใช้จ่ายโครงการ (ตาราง 2)", fallback: "" },
  // งานการเงิน — บค./บจ./ใบรับใบสำคัญ ต้องมีเลขเสมอ (เว้นว่าง = ใช้ค่าเริ่มต้น) ส่วนยืมเงินระหว่างประเภทเงิน (บง) เว้นว่างได้ = ไม่ใช้เลขที่เอกสาร
  { kind: "loan_receipt", key: "doc_number_format_loan_receipt", label: "ใบรับใบสำคัญ (ส่งใช้เงินยืม)", fallback: "บค {n}/{yyyy}", required: true },
  { kind: "fin_bk", key: "doc_number_format_fin_bk", label: "บัญชีรับ-จ่าย: ใบสำคัญรับเงิน (บค.)", fallback: "บค {n}/{yyyy}", required: true },
  { kind: "fin_bj", key: "doc_number_format_fin_bj", label: "บัญชีรับ-จ่าย: ใบเสร็จรับเงินผู้ขาย (บจ.)", fallback: "บจ {n}/{yyyy}", required: true },
  { kind: "fund_loan", key: "doc_number_format_fund_loan", label: "ยืมเงินระหว่างประเภทเงิน / ส่งใช้คืน", fallback: "บง {n}/{yyyy}" },
] as const satisfies readonly { kind: string; key: string; label: string; fallback: string; required?: boolean }[];
export type DocNumberKind = (typeof DOC_NUMBER_KINDS)[number]["kind"];

export function docNumberKind(docType: string): DocNumberKind {
  return docType === "จ้าง" ? "hire" : "purchase";
}

/** อ่านรูปแบบจากค่าตั้ง (ยังไม่เคยตั้ง = ค่าเริ่มต้น, ตั้งเป็นค่าว่าง "-" = ไม่เสนออัตโนมัติ) */
export function docNumberTemplate(kind: DocNumberKind, settings: Map<string, string> | Record<string, string>) {
  const def = DOC_NUMBER_KINDS.find((k) => k.kind === kind)!;
  const v = settings instanceof Map ? settings.get(def.key) : settings[def.key];
  if (v === undefined || (v === "-" && "required" in def)) return def.fallback;
  return v === "-" ? "" : v;
}

/** เลขที่ตามรูปแบบจากลำดับที่ — ใช้กับเลขที่เก็บเป็นลำดับ (บค./บจ. ในบัญชีรับ-จ่าย, บง.) */
export function formatDocNumber(template: string, n: number, fy: number) {
  return render(template, n, fy);
}

function render(template: string, n: number, fy: number) {
  return template.replaceAll("{n}", String(n)).replaceAll("{yyyy}", String(fy)).replaceAll("{yy}", String(fy % 100).padStart(2, "0"));
}

/** เลขที่ถัดไปตามรูปแบบ — หาลำดับสูงสุดของเลขที่มีอยู่ที่ตรงรูปแบบในปีงบนี้แล้ว +1 (รูปแบบว่าง = "") */
export function nextDocNumber(template: string, fy: number | null, existing: string[]) {
  if (!template || !fy || !template.includes("{n}")) return "";
  const pattern = template
    .split("{n}")
    .map((part) => render(part, 0, fy).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("(\\d+)");
  const re = new RegExp(`^${pattern}$`);
  const max = existing.reduce((m, raw) => {
    const hit = re.exec(raw.trim());
    const v = hit ? Number(hit[1]) : 0;
    return v > m ? v : m;
  }, 0);
  return render(template, max + 1, fy);
}

export function docNumberExample(template: string, fy = 2570) {
  return template ? render(template, 1, fy) : "(ไม่เสนอเลขอัตโนมัติ)";
}
