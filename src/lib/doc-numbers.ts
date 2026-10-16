// รูปแบบเลขที่เอกสารงานพัสดุ — งานพัสดุออกเลขเอง แอดมินกำหนดรูปแบบได้ที่หน้าตั้งค่า (proc_app_settings)
// ตัวแปร: {n} = ลำดับที่ (นับใหม่ทุกปีงบ), {yyyy} = ปีงบประมาณ พ.ศ., {yy} = 2 หลักท้ายของปีงบ
// รูปแบบว่าง = ไม่เสนอเลขอัตโนมัติ (ผู้ใช้กรอกเองหรือเว้นว่างได้) — เลขที่เก็บในฐานข้อมูลเป็นข้อความเต็มตามที่พิมพ์

export const DOC_NUMBER_KINDS = [
  { kind: "purchase", key: "doc_number_format_purchase", label: "งานซื้อ + ว.804 (นับชุดเดียวกัน)", fallback: "{n}/{yyyy}" },
  { kind: "hire", key: "doc_number_format_hire", label: "งานจ้าง", fallback: "{n}/{yyyy}" },
  { kind: "w119", key: "doc_number_format_w119", label: "ว.119 ค่าใช้จ่ายบริหารงาน", fallback: "{n}/{yyyy} (ว119)" },
  { kind: "claim", key: "doc_number_format_claim", label: "เบิกค่าใช้จ่ายโครงการ (ตาราง 2)", fallback: "" },
] as const;
export type DocNumberKind = (typeof DOC_NUMBER_KINDS)[number]["kind"];

export function docNumberKind(docType: string): DocNumberKind {
  return docType === "จ้าง" ? "hire" : "purchase";
}

/** อ่านรูปแบบจากค่าตั้ง (ยังไม่เคยตั้ง = ค่าเริ่มต้น, ตั้งเป็นค่าว่าง "-" = ไม่เสนออัตโนมัติ) */
export function docNumberTemplate(kind: DocNumberKind, settings: Map<string, string> | Record<string, string>) {
  const def = DOC_NUMBER_KINDS.find((k) => k.kind === kind)!;
  const v = settings instanceof Map ? settings.get(def.key) : settings[def.key];
  if (v === undefined) return def.fallback;
  return v === "-" ? "" : v;
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
