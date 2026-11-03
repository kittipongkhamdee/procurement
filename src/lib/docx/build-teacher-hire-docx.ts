import { AlignmentType, Document, Packer, Paragraph, TextRun } from "docx";
import { buildTeacherHireBlocks, type Block, type ContractContext, type TeacherHireContract } from "@/lib/teacher-hire-contract";
import { insertZwsp, THAI_FONT } from "./thai-docx";

// สัญญาจ้างครูอัตราจ้าง ชุด 4 ส่วน เป็นไฟล์ Word (แก้ไขข้อความต่อได้) — เนื้อหามาจากบล็อกชุดเดียวกับ PDF
// (teacher-hire-contract.ts) TH Sarabun New 16pt ลายมือชื่อเป็นเส้นจุดข้อความ (Word ไม่มีบล็อกเส้นจุดแบบ PDF)

const FS = 32; // half-point → 16pt
const SIGN_INDENT = 3900; // twip — ขยับบล็อกลงชื่อไปครึ่งขวาของหน้า
const DOTS = "……………………………………";

function run(text: string, opts: { bold?: boolean; size?: number } = {}) {
  return new TextRun({ text: insertZwsp(text), font: THAI_FONT, size: opts.size ?? FS, bold: opts.bold });
}

function para(text: string, o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean; size?: number; firstLine?: number; left?: number; after?: number; before?: number; pageBreakBefore?: boolean; keepNext?: boolean; keepLines?: boolean } = {}) {
  return new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT,
    spacing: { after: o.after ?? 80, before: o.before ?? 0, line: 276, lineRule: "auto" },
    indent: { firstLine: o.firstLine, left: o.left },
    pageBreakBefore: o.pageBreakBefore,
    keepNext: o.keepNext,
    keepLines: o.keepLines,
    children: [run(text, { bold: o.bold, size: o.size })],
  });
}

function blockParagraphs(b: Block, first: boolean): Paragraph[] {
  const pb = first ? { pageBreakBefore: true } : {};
  switch (b.kind) {
    case "title":
      return [para(b.text, { align: AlignmentType.CENTER, bold: true, size: b.size === "xl" ? 40 : 34, after: b.size === "xl" ? 120 : 40, ...pb })];
    // จัดแบบ "กระจายแบบไทย" (thaiDistribute) เหมือนไฟล์ Word ต้นแบบ
    case "para":
    case "clause":
      return [para(b.text, { firstLine: 720, align: AlignmentType.THAI_DISTRIBUTE, ...pb })];
    case "item":
      return [para(b.text, { left: 1500, after: 20, align: AlignmentType.THAI_DISTRIBUTE, ...pb })];
    case "right":
      return [para(b.text, { align: AlignmentType.RIGHT, ...pb })];
    default:
      return [];
  }
}

function signParagraphs(b: Extract<Block, { kind: "sign" }>, isLast: boolean): Paragraph[] {
  const name = b.name ? `(${b.name})` : "(……………………………………)";
  const out = [
    para(`ลงชื่อ ${DOTS} ${b.role}`, { left: SIGN_INDENT - 300, before: 200, after: 0, keepNext: true, keepLines: true }),
    para(name, { align: AlignmentType.CENTER, left: SIGN_INDENT, after: b.extra?.length ? 0 : 40, keepNext: !!b.extra?.length || !isLast, keepLines: true }),
  ];
  (b.extra ?? []).forEach((x, i, arr) => out.push(para(x, { align: AlignmentType.CENTER, left: SIGN_INDENT, after: 40, keepNext: i < arr.length - 1 || !isLast, keepLines: true })));
  return out;
}

export async function renderTeacherHireDocxBuffer(contract: TeacherHireContract, ctx: ContractContext): Promise<Buffer> {
  const blocks = buildTeacherHireBlocks(contract, ctx);
  const children: Paragraph[] = [];
  let startOfSection = false;
  blocks.forEach((b, i) => {
    if (b.kind === "pagebreak") {
      startOfSection = true;
      return;
    }
    if (b.kind === "sign") {
      // ลายมือชื่อของกลุ่มเดียวกันให้อยู่หน้าเดียวกัน (ไม่ให้ตกหน้าใหม่แยกจากกัน)
      const next = blocks[i + 1];
      children.push(...signParagraphs(b, !(next && next.kind === "sign")));
      return;
    }
    children.push(...blockParagraphs(b, startOfSection));
    startOfSection = false;
  });

  const doc = new Document({
    creator: ctx.school_name,
    title: `สัญญาจ้างครูอัตราจ้าง ${contract.contract_no}`,
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1600, right: 1134 } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
