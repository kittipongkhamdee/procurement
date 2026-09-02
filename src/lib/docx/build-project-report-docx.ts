import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { insertZwsp, THAI_FONT, THAI_FONT_SIZE, THAI_FONT_SIZE_HEADING, THAI_FONT_SIZE_TITLE } from "./thai-docx";
import { getImageSize } from "./image-size";
import type { ProjectReportPdfData } from "../pdf/project-report-document";

export { buildProjectReportPdfData as buildProjectReportDocxData } from "../pdf/build-project-report-pdf";

const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;
const MARGIN_TWIP = 1440; // 2.54cm
const LINE_1_5 = 360; // ตามสัดส่วนของ docx.js: 240 = single spacing

function run(text: string, opts: { bold?: boolean } = {}) {
  return new TextRun({ text: insertZwsp(text), font: THAI_FONT, size: THAI_FONT_SIZE, bold: opts.bold });
}

function paragraph(text: string, opts: { spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_1_5, lineRule: "auto", after: opts.spacingAfter ?? 120 },
    children: [run(text)],
  });
}

function heading(text: string, size: number, opts: { center?: boolean } = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text: insertZwsp(text), font: THAI_FONT, size, bold: true })],
  });
}

function labelValue(label: string, value: string) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: LINE_1_5, lineRule: "auto", after: 80 },
    children: [run(`${label}: `, { bold: true }), run(value || "-")],
  });
}

function bullets(items: string[]) {
  return items.map(
    (item, i) =>
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { line: LINE_1_5, lineRule: "auto", after: 60 },
        indent: { left: 360, hanging: 360 },
        children: [run(`${i + 1}. ${item}`)],
      }),
  );
}

function bulletSection(headingText: string, items: string[]) {
  if (items.length === 0) return [];
  return [heading(headingText, THAI_FONT_SIZE), ...bullets(items)];
}

type IndicatorResult = { indicator: string; target: string; actual: string };

function indicatorTable(headingText: string, rows: IndicatorResult[]) {
  if (rows.length === 0) return [];
  const headerShading = { type: ShadingType.SOLID, color: "F1F5F9", fill: "F1F5F9" };
  return [
    heading(headingText, THAI_FONT_SIZE),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ shading: headerShading, width: { size: 50, type: WidthType.PERCENTAGE }, children: [cellParagraph("ตัวชี้วัด", true)] }),
            new TableCell({ shading: headerShading, width: { size: 25, type: WidthType.PERCENTAGE }, children: [cellParagraph("ค่าเป้าหมาย", true)] }),
            new TableCell({ shading: headerShading, width: { size: 25, type: WidthType.PERCENTAGE }, children: [cellParagraph("ผลการดำเนินงาน", true)] }),
          ],
        }),
        ...rows.map(
          (r) =>
            new TableRow({
              children: [
                new TableCell({ children: [cellParagraph(r.indicator)] }),
                new TableCell({ children: [cellParagraph(r.target || "-")] }),
                new TableCell({ children: [cellParagraph(r.actual || "-")] }),
              ],
            }),
        ),
      ],
    }),
    new Paragraph({ text: "" }),
  ];
}

function cellParagraph(text: string, bold = false) {
  return new Paragraph({ children: [run(text, { bold })] });
}

function budgetTable(approved: number | null, used: number | null) {
  const remaining = approved != null && used != null ? approved - used : null;
  const row = (label: string, value: number | null, bold = false) =>
    new TableRow({
      children: [
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [cellParagraph(label, bold)] }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(value != null ? `${formatBaht(value)} บาท` : "-", { bold })] })],
        }),
      ],
    });
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row("งบประมาณที่ได้รับอนุมัติ", approved),
        row("งบประมาณที่ใช้ไปจริง", used),
        row("คงเหลือ", remaining, true),
      ],
    }),
    new Paragraph({ text: "" }),
  ];
}

export type ProjectReportPhoto = { data: Buffer; format: "png" | "jpg" };

export async function renderProjectReportDocxBuffer(data: ProjectReportPdfData): Promise<Buffer> {
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: "รายงานสรุปโครงการ", font: THAI_FONT, size: THAI_FONT_SIZE_TITLE, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "โรงเรียนตาเบาวิทยา", font: THAI_FONT, size: THAI_FONT_SIZE })],
    }),
    heading("1. ส่วนหัวรายงาน", THAI_FONT_SIZE_HEADING),
    labelValue("ชื่อโครงการ", data.project_name ?? "-"),
  ];

  if (data.strategy_alignment) body.push(labelValue("สนองกลยุทธ์โรงเรียน", data.strategy_alignment));
  if (data.standard) body.push(labelValue("สอดคล้องมาตรฐานการศึกษา", data.standard));

  body.push(
    labelValue("ผู้รับผิดชอบโครงการ", data.responsible_name ?? "-"),
    labelValue(
      "ระยะเวลาดำเนินงาน",
      data.period_start
        ? `${formatThaiDate(data.period_start)} - ${formatThaiDate(data.period_end ?? data.period_start)}`
        : "-",
    ),
    labelValue("สถานที่ดำเนินการ", data.location ?? "-"),
  );

  if (data.not_implemented) {
    body.push(heading("ผลการดำเนินงาน", THAI_FONT_SIZE_HEADING), paragraph("ไม่ได้ดำเนินการโครงการนี้"));
    if (data.not_implemented_reason) body.push(paragraph(`เหตุผล: ${data.not_implemented_reason}`));
  } else {
    body.push(heading("2. หลักการและวัตถุประสงค์", THAI_FONT_SIZE_HEADING));
    if (data.background) body.push(paragraph(`ความเป็นมา: ${data.background}`));
    if (data.objectives.length > 0) {
      body.push(paragraph("วัตถุประสงค์"), ...bullets(data.objectives));
    }

    body.push(heading("3. ผลการดำเนินงานโครงการ", THAI_FONT_SIZE_HEADING));
    body.push(...bulletSection("สรุปการดำเนินงาน/กิจกรรมที่ทำจริง", data.activities_done));
    body.push(...indicatorTable("ตัวชี้วัดเชิงปริมาณ", data.indicator_results_quantity));
    body.push(...indicatorTable("ตัวชี้วัดเชิงคุณภาพ", data.indicator_results_quality));
    if (data.satisfaction_percent != null) {
      body.push(paragraph(`ผลการประเมินความพึงพอใจ: ร้อยละ ${data.satisfaction_percent}`));
    }
    body.push(...budgetTable(data.budget_approved, data.budget_used));

    body.push(heading("4. สรุปภาพรวมและข้อเสนอแนะ", THAI_FONT_SIZE_HEADING));
    body.push(...bulletSection("จุดเด่น / ประสบความสำเร็จ", data.highlights));
    body.push(...bulletSection("ปัญหาและอุปสรรค", data.problems));
    body.push(...bulletSection("ข้อเสนอแนะในการปรับปรุงครั้งต่อไป", data.recommendations));

    if (data.photos.length > 0) {
      body.push(heading("5. ภาพถ่ายกิจกรรม", THAI_FONT_SIZE_HEADING));
      const maxWidth = 400;
      for (const photo of data.photos) {
        const { width, height } = getImageSize(photo.data, photo.format);
        const scale = Math.min(1, maxWidth / width);
        body.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new ImageRun({
                type: photo.format,
                data: photo.data,
                transformation: { width: Math.round(width * scale), height: Math.round(height * scale) },
              }),
            ],
          }),
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIP, height: A4_HEIGHT_TWIP },
            margin: { top: MARGIN_TWIP, bottom: MARGIN_TWIP, left: MARGIN_TWIP, right: MARGIN_TWIP },
          },
        },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
