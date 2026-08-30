import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatBaht, formatThaiDate } from "@/lib/thai";

const THAI_FONT = "TH Sarabun New";
const BODY_SIZE = 32; // 16pt — sets w:lang="th-TH" per run so Word applies its own Thai line-break dictionary instead of treating unspaced Thai text as one unbreakable word.

function projectTypeLabel(type: string) {
  return type === "ใหม่" ? "โครงการใหม่" : type === "ต่อเนื่อง" ? "โครงการต่อเนื่อง" : type;
}

function run(text: string, opts: { bold?: boolean } = {}) {
  return new TextRun({
    text,
    font: THAI_FONT,
    size: BODY_SIZE,
    bold: opts.bold,
    language: { value: "th-TH" },
  });
}

function fieldRow(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [run(`${label}: `, { bold: true }), run(value || "-")],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [run(text, { bold: true })],
  });
}

function bodyParagraph(text: string | null | undefined) {
  const lines = (text || "-").split("\n");
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { after: 80 },
        alignment: AlignmentType.THAI_DISTRIBUTE,
        children: [run(line || " ")],
      }),
  );
}

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "111827" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "111827" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "111827" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "111827" },
};

function headerCell(text: string, widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    shading: { fill: "F1F5F9" },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(text, { bold: true })] })],
  });
}

function bodyCell(text: string, widthPct: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    children: [new Paragraph({ alignment, children: [run(text || "-")] })],
  });
}

export type ProposalDocxActivity = {
  name: string;
  period: string;
  responsible: string[];
  compensation: number;
  service: number;
  material: number;
};
export type ProposalDocxEvaluationItem = { type: string; indicator: string; target: string; method: string; tool: string };

export type ProposalDocxData = {
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  rationale: string | null;
  objectives: string | null;
  targetQuantity: string | null;
  targetQuality: string | null;
  activities: ProposalDocxActivity[];
  budgetAmount: number;
  riskFactors: string | null;
  riskMitigation: string | null;
  evaluationItems: ProposalDocxEvaluationItem[];
  expectedResults: string | null;
  endorsedByName: string | null;
  approvedByName: string | null;
};

function signatureParagraphs(role: string, signerName: string | null) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [run("ลงชื่อ...........................................")],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run(`(${signerName || "..........................................."})`)],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(role)] }),
  ];
}

export function buildProposalDocument(data: ProposalDocxData): Document {
  const duration =
    data.startDate || data.endDate
      ? `${data.startDate ? formatThaiDate(data.startDate) : "-"} ถึง ${data.endDate ? formatThaiDate(data.endDate) : "-"}`
      : "-";

  const activitiesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("ที่", 5),
          headerCell("รายละเอียดการดำเนินงาน", 21),
          headerCell("ระยะเวลา", 10),
          headerCell("ผู้รับผิดชอบ", 26),
          headerCell("ค่าตอบแทน", 13),
          headerCell("ค่าใช้สอย", 12),
          headerCell("ค่าวัสดุ", 13),
        ],
      }),
      ...data.activities.map(
        (a, i) =>
          new TableRow({
            children: [
              bodyCell(String(i + 1), 5, AlignmentType.CENTER),
              bodyCell(a.name, 21),
              bodyCell(a.period, 10),
              bodyCell(a.responsible.join(", "), 26),
              bodyCell(a.compensation ? formatBaht(a.compensation) : "-", 13, AlignmentType.RIGHT),
              bodyCell(a.service ? formatBaht(a.service) : "-", 12, AlignmentType.RIGHT),
              bodyCell(a.material ? formatBaht(a.material) : "-", 13, AlignmentType.RIGHT),
            ],
          }),
      ),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            borders: cellBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [run(`รวมงบประมาณทั้งสิ้น (แหล่งเงิน: ${data.budgetSource})`, { bold: true })],
              }),
            ],
          }),
          new TableCell({
            columnSpan: 3,
            borders: cellBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [run(`${formatBaht(data.budgetAmount)} บาท`, { bold: true })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const evaluationTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell("ประเภท", 12),
          headerCell("ตัวชี้วัด", 28),
          headerCell("ค่าเป้าหมาย", 12),
          headerCell("วิธีวัดและประเมินผล", 24),
          headerCell("เครื่องมือที่ใช้", 24),
        ],
      }),
      ...data.evaluationItems.map(
        (e) =>
          new TableRow({
            children: [
              bodyCell(e.type, 12),
              bodyCell(e.indicator, 28),
              bodyCell(e.target, 12),
              bodyCell(e.method, 24),
              bodyCell(e.tool, 24),
            ],
          }),
      ),
    ],
  });

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [run("แบบเสนอโครงการ", { bold: true })],
          }),
          fieldRow("ชื่อโครงการ", data.name),
          fieldRow("สนองกลยุทธ์โรงเรียน", data.strategyAlignment || "-"),
          fieldRow("สอดคล้องกับมาตรฐานการศึกษา", data.standard || "-"),
          fieldRow("กลุ่มงานที่รับผิดชอบ", data.adminGroup),
          fieldRow("ลักษณะโครงการ", projectTypeLabel(data.projectType)),
          fieldRow("ผู้รับผิดชอบโครงการ", data.responsible.join(", ") || data.proposerName || "-"),
          fieldRow("ระยะเวลาดำเนินการ", duration),
          fieldRow("สถานที่ดำเนินการ", data.location || "-"),

          sectionHeading("1. หลักการและเหตุผล"),
          ...bodyParagraph(data.rationale),

          sectionHeading("2. วัตถุประสงค์"),
          ...bodyParagraph(data.objectives),

          sectionHeading("3. เป้าหมาย"),
          sectionHeading("3.1 เป้าหมายเชิงปริมาณ (ผลผลิต)"),
          ...bodyParagraph(data.targetQuantity),
          sectionHeading("3.2 เป้าหมายเชิงคุณภาพ (ผลลัพธ์)"),
          ...bodyParagraph(data.targetQuality),

          sectionHeading("4. ขั้นตอนการดำเนินงาน และงบประมาณ"),
          activitiesTable,

          sectionHeading("7. การวิเคราะห์ความเสี่ยงของโครงการ — ปัจจัยความเสี่ยง"),
          ...bodyParagraph(data.riskFactors),
          sectionHeading("แนวทางการบริหารความเสี่ยง"),
          ...bodyParagraph(data.riskMitigation),

          sectionHeading("8. ตัวชี้วัดและเป้าหมายความสำเร็จ"),
          evaluationTable,

          sectionHeading("9. ผลที่คาดว่าจะได้รับ"),
          ...bodyParagraph(data.expectedResults),

          ...signatureParagraphs("ผู้เสนอโครงการ", data.responsible.join(", ") || data.proposerName),
          ...signatureParagraphs("ผู้เห็นชอบโครงการ", data.endorsedByName),
          ...signatureParagraphs("ผู้อนุมัติโครงการ", data.approvedByName),
        ],
      },
    ],
  });
}

export async function renderProposalDocxBuffer(data: ProposalDocxData): Promise<Buffer> {
  return Packer.toBuffer(buildProposalDocument(data));
}
