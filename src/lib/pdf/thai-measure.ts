import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";

// วัดความกว้างข้อความจริงจากไฟล์ฟอนต์ Sarabun (ไม่ใช่เดาจากจำนวนตัวอักษร) ไว้ตัดบรรทัดภาษาไทยเองล่วงหน้า
// — ดูเหตุผลที่ต้องตัดเองใน thai-pdf.ts (react-pdf ตัดบรรทัดอัตโนมัติแล้วบางครั้งกินตัวอักษรท้ายบรรทัด)

type MeasuringFont = { unitsPerEm: number; layout(text: string): { advanceWidth: number } };

const cache = new Map<string, MeasuringFont>();

function load(file: string): MeasuringFont {
  let font = cache.get(file);
  if (!font) {
    const buf = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts", file));
    font = (fontkit as unknown as { create(b: Buffer): MeasuringFont }).create(buf);
    cache.set(file, font);
  }
  return font;
}

export type MeasureFamily = "Sarabun" | "THSarabunNew";

/** ความกว้างของข้อความ (หน่วย pt) ที่ขนาดฟอนต์ size — family เริ่มต้น Sarabun */
export function measureText(text: string, size: number, bold = false, family: MeasureFamily = "Sarabun"): number {
  if (!text) return 0;
  const font = load(`${family}-${bold ? "Bold" : "Regular"}.ttf`);
  return (font.layout(text).advanceWidth * size) / font.unitsPerEm;
}

/** ตัดข้อความขึ้นบรรทัดใหม่ที่ขอบเขต "คำ" จริง (Intl.Segmenter มีพจนานุกรมภาษาไทยในตัว) ให้แต่ละบรรทัดกว้าง
 * ไม่เกินความกว้างที่กำหนด — บรรทัดแรกกว้างได้ firstWidth ส่วนบรรทัดถัดไปกว้างได้ restWidth คำเดียวที่ยาวเกิน
 * ทั้งบรรทัดจะตัดระดับตัวอักษรเป็นทางเลือกสุดท้าย (ไม่มีการทิ้งข้อความ) */
export function wrapByWidth(
  text: string,
  size: number,
  firstWidth: number,
  restWidth: number,
  bold = false,
  family: MeasureFamily = "Sarabun",
  /** คำ/วลีที่ห้ามตัดกลาง เช่น ชื่อเฉพาะ (ชื่อโรงเรียน ชื่อคน ชื่อตำบล) — ตัวตัดคำแยก "ตาเบาวิทยา" เป็น "ตา|เบา|วิทยา" */
  keepTogether: string[] = [],
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  const keep = [...new Set(keepTogether.map((k) => k.trim()).filter((k) => k.length > 1))].sort((a, b) => b.length - a.length);
  const segments: string[] = [];
  let rest = clean;
  while (rest) {
    let at = -1;
    let hit = "";
    for (const k of keep) {
      const i = rest.indexOf(k);
      if (i !== -1 && (at === -1 || i < at)) {
        at = i;
        hit = k;
      }
    }
    const plain = at === -1 ? rest : rest.slice(0, at);
    segments.push(...[...segmenter.segment(plain)].map((s) => s.segment));
    if (at === -1) break;
    segments.push(hit);
    rest = rest.slice(at + hit.length);
  }
  const lines: string[] = [];
  let current = "";
  const limit = () => (lines.length === 0 ? firstWidth : restWidth);

  for (let seg of segments) {
    while (seg) {
      const candidate = current + seg;
      if (measureText(candidate.trimEnd(), size, bold, family) <= limit()) {
        current = candidate;
        seg = "";
      } else if (current.trim() !== "") {
        lines.push(current.trimEnd());
        current = "";
        seg = seg.trimStart();
      } else {
        // คำเดียวยาวเกินทั้งบรรทัด — ตัดระดับตัวอักษร
        let cut = seg.length;
        while (cut > 1 && measureText(seg.slice(0, cut), size, bold, family) > limit()) cut -= 1;
        lines.push(seg.slice(0, cut));
        seg = seg.slice(cut);
      }
    }
  }
  if (current.trim() !== "") lines.push(current.trimEnd());
  return lines.length > 0 ? lines : [""];
}
