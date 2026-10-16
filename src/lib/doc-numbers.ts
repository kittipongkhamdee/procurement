// เลขที่เอกสารงานพัสดุ — งานพัสดุออกเลขเองแยกตามประเภทงาน กันเลข "1/2570" ซ้ำข้ามเมนู
// เก็บในฐานข้อมูลเป็น "<ลำดับ>/<ปีงบ>" เหมือนเดิม แล้วเติมตัวอักษรนำหน้าตอนแสดงผล/พิมพ์ (เลข "ที่" ในบันทึก, ชื่อไฟล์ PDF)
//   ซ    = งานซื้อ + ว.804 (นับชุดเดียวกัน)   จ = งานจ้าง   ว119 = ว.119   บค = เบิกค่าใช้จ่ายโครงการ (ตาราง 2)

export const DOC_PREFIX = { purchase: "ซ", hire: "จ", w119: "ว119", claim: "บค" } as const;
export type DocKind = keyof typeof DOC_PREFIX;

export function procurementDocKind(docType: string): DocKind {
  return docType === "จ้าง" ? "hire" : "purchase";
}

/** "1/2570" → "ซ 1/2570" (ไม่เติมซ้ำถ้าพิมพ์ตัวอักษรนำหน้ามาแล้ว) */
export function withPrefix(no: string | null | undefined, kind: DocKind) {
  const v = (no ?? "").trim();
  if (!v) return v;
  const p = DOC_PREFIX[kind];
  return v.startsWith(p) ? v : `${p} ${v}`;
}
