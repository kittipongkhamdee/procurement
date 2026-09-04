import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatBaht } from "@/lib/thai";
import type { ApprovalPdfData } from "./approval-types";

const BLACK = rgb(0, 0, 0);
const PAGE_H = 841.92;
const FONT_SIZE = 11;

/** วาดข้อความที่พิกัด (x, yBottom) ด้วยขนาดฟอนต์คงที่ FONT_SIZE เสมอ (ไม่ย่ออัตโนมัติ) — yBottom คือ
 * ขอบล่างของบรรทัดนั้นในเทมเพลตต้นฉบับ (ค่าเดียวกับที่ PyMuPDF รายงานเป็น bbox[3]) แปลงเป็นระบบ
 * พิกัดของ pdf-lib (อ้างอิงขอบล่างหน้า) ให้อัตโนมัติ */
function put(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yBottom: number,
  opts: { maxWidth?: number; align?: "left" | "center" | "right"; yLift?: number } = {},
) {
  if (!text) return;
  let drawX = x;
  if (opts.align === "center" && opts.maxWidth) {
    drawX = x + (opts.maxWidth - font.widthOfTextAtSize(text, FONT_SIZE)) / 2;
  } else if (opts.align === "right" && opts.maxWidth) {
    drawX = x + opts.maxWidth - font.widthOfTextAtSize(text, FONT_SIZE);
  }
  page.drawText(text, { x: drawX, y: PAGE_H - yBottom + (opts.yLift ?? 6.5), size: FONT_SIZE, font, color: BLACK });
}

/** ระยะร่นเข้าจากขอบซ้าย/ขวาของช่อง กันไม่ให้ข้อความไปชิดวงเล็บปิด/ป้ายชื่อข้างเคียงในเทมเพลตมากเกินไป */
const INSET = 2;

/** เขียนค่าจริงทับตำแหน่งจุดไข่ปลาเดิมในเทมเพลตตรงๆ โดยไม่ปิดทับพื้นหลังก่อน (พื้นหลังโปร่งใส) —
 * ให้จุดไข่ปลาเดิมยังมองทะลุเห็นใต้ตัวอักษรที่เขียนทับได้ตามที่ผู้ใช้ต้องการ */
function fill(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x0: number,
  x1: number,
  yBottom: number,
  _height: number,
  opts: { align?: "left" | "center" | "right" } = {},
) {
  const left = x0 + INSET;
  const right = x1 - INSET;
  if (!text) return;
  put(page, font, text, left, yBottom, { maxWidth: right - left, align: opts.align });
}

function checkmark(page: PDFPage, font: PDFFont, x0: number, yBottom: number) {
  put(page, font, "X", x0, yBottom, { maxWidth: 14, align: "center" });
}

export async function renderApprovalPdfBuffer(data: ApprovalPdfData): Promise<Buffer> {
  const templateBytes = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf-overlay/approval-template.pdf"));
  const sarabunLight = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Light.ttf"));
  const sarabunBold = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"));

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  // ใช้ Sarabun Light (ไม่ใช่ Regular) ให้ตัวหนังสือที่เขียนทับดูบางลงกว่าเดิมตามที่ผู้ใช้ขอ
  const font = await pdfDoc.embedFont(sarabunLight, { subset: true });
  const boldFont = await pdfDoc.embedFont(sarabunBold, { subset: true });

  const [page1, page2] = pdfDoc.getPages();

  // ---------- หน้า 1 ----------
  // บรรทัด "เรื่อง" — ผู้ใช้ลบคำว่า "โครงการ" ออกจากเทมเพลตแล้ว ชื่อโครงการเขียนทับต่อท้าย
  // "...อนุมัติใช้เงิน" ตำแหน่งจุดเริ่มจุดไข่ปลาหลังลบคำนั้นบังเอิญตรงกับตำแหน่งเดิมพอดี (วัดซ้ำแล้ว)
  fill(page1, font, data.project_name ?? "", 274.4, 537, 147.4, 17.5);
  fill(page1, font, data.doc_number ?? "", 127, 286, 120.9, 17.5);
  fill(page1, font, data.doc_date, 320, 534, 120.9, 17.5);
  fill(page1, font, data.department ?? "", 245, 428, 191.8, 17.5);
  fill(page1, font, data.activity_name ?? "", 138, 538, 213.1, 17.5);
  fill(page1, font, data.project_name ?? "", 160, 537, 234.4, 17.5);
  fill(page1, font, data.plan_date_text ?? "", 160, 261, 255.6, 17.4);
  fill(page1, font, formatBaht(data.requested_amount), 451, 503, 255.6, 17.4, { align: "right" });

  fill(page1, font, data.requested_by_name ?? "", 296, 465, 325.6, 17.4, { align: "center" });

  // ตารางรายการเงิน 5 แถว + รวมทั้งสิ้น (ช่องว่างอยู่แล้ว ไม่ต้องปิดทับ) — ใช้ yLift ต่ำกว่าปกติ (4.0pt
  // แทน 6.5pt) เพราะช่องนี้เป็นตารางที่มีเส้นขอบจริง ไม่ใช่จุดไข่ปลา ตัวเลขจึงควรอยู่กึ่งกลางแถวมากกว่า
  const summaryRowsY = [370.8, 392.6, 414.4, 436.2, 458.0];
  data.summary_items.slice(0, 5).forEach((row, i) => {
    if (row.amount)
      put(page1, font, formatBaht(row.amount), 384, summaryRowsY[i], { maxWidth: 50, align: "right", yLift: 4.0 });
    if (row.note) put(page1, font, row.note, 476, summaryRowsY[i], { maxWidth: 40, yLift: 4.0 });
  });
  const summaryTotal = data.summary_items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  put(page1, boldFont, formatBaht(summaryTotal), 384, 479.9, { maxWidth: 44, align: "right", yLift: 4.0 });

  // กล่อง 1: ความเห็นงานแผนงาน
  fill(page1, font, data.budget != null ? formatBaht(data.budget) : "", 180, 270, 566.0, 17.4);
  fill(page1, font, formatBaht(data.requested_amount), 164, 270, 587.3, 17.5);
  fill(page1, font, data.remaining != null ? formatBaht(data.remaining) : "", 178, 270, 608.6, 17.4);
  // ชื่อผู้ลงนามทั้ง 4 จุด (งานแผนงาน/การเงิน/รองผู้อำนวยการ/ผู้อำนวยการ) เป็นชื่อที่พิมพ์ไว้ในเทมเพลต
  // ต้นฉบับอยู่แล้วตายตัว — ไม่ต้องเขียนทับ ปล่อยให้เทมเพลตแสดงชื่อเดิมตามที่เป็น

  // กล่อง 2: ความเห็นเจ้าหน้าที่การเงิน
  if (data.fund_type === "งบค่าจัดการเรียนการสอน") checkmark(page1, font, 317.2, 565.3);
  if (data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน") checkmark(page1, font, 317.2, 586.5);
  if (data.fund_type === "เงินรายได้สถานศึกษา") checkmark(page1, font, 317.2, 607.9);

  // กล่อง 3: ความเห็นของรองผู้อำนวยการ
  if (data.deputy_decision === "ควร") checkmark(page1, font, 90.7, 714.9);
  if (data.deputy_decision === "ไม่ควร") {
    checkmark(page1, font, 90.7, 736.2);
    fill(page1, font, data.deputy_note ?? "", 239, 299.7, 736.9, 17.4);
  }

  // กล่อง 4: ความเห็นของผู้อำนวยการโรงเรียน
  if (data.status === "อนุมัติ") checkmark(page1, font, 317.2, 714.9);
  if (data.status === "ไม่อนุมัติ") checkmark(page1, font, 317.2, 736.2);
  if (data.approved_at) {
    const d = new Date(data.approved_at);
    const THAI_MONTHS = [
      "",
      "มกราคม",
      "กุมภาพันธ์",
      "มีนาคม",
      "เมษายน",
      "พฤษภาคม",
      "มิถุนายน",
      "กรกฎาคม",
      "สิงหาคม",
      "กันยายน",
      "ตุลาคม",
      "พฤศจิกายน",
      "ธันวาคม",
    ];
    fill(page1, font, String(d.getDate()), 338, 365, 822.0, 17.4);
    fill(page1, font, THAI_MONTHS[d.getMonth() + 1], 390, 479, 822.0, 17.4);
    fill(page1, font, String(d.getFullYear() + 543), 500, 522.7, 822.0, 17.4);
  }

  // ---------- หน้า 2: รายการวัสดุ อุปกรณ์ ----------
  // ผู้ใช้ลบบรรทัด "กลุ่มสาระ/งาน...กลุ่มงาน...ปีการศึกษา..." ออกจากเทมเพลตแล้ว (ไม่ได้ใช้ค่า
  // department/group_name/budget_year_text บนหน้านี้อีกต่อไป) ทำให้อีก 2 บรรทัดด้านบนเลื่อนลง
  fill(page2, font, data.project_name ?? "", 255, 522, 74.7, 17.5);
  fill(page2, font, data.activity_name ?? "", 142, 520, 95.9, 17.5);

  // ตารางรายการวัสดุอุปกรณ์ขยับคอลัมน์ใหม่ตามเทมเพลตที่แก้ไข (แถวคงตำแหน่งเดิมทุกแถว)
  const itemRowsY = [
    182.2, 203.9, 225.8, 247.5, 269.4, 291.2, 312.9, 334.8, 356.6, 378.3, 400.2, 422.0, 443.7, 465.6, 487.3, 509.1,
    531.0, 552.7, 574.5, 596.4, 618.1, 640.0, 661.7, 683.5, 705.4, 727.1, 748.9, 770.8, 792.5,
  ];
  data.items.slice(0, itemRowsY.length).forEach((item, i) => {
    const y = itemRowsY[i];
    if (item.name) put(page2, font, item.name, 93, y, { maxWidth: 205, yLift: 4.0 });
    if (item.qty != null) put(page2, font, String(item.qty), 299.5, y, { maxWidth: 46, align: "center", yLift: 4.0 });
    if (item.unit_price != null)
      put(page2, font, formatBaht(item.unit_price), 349.4, y, { maxWidth: 68.7, align: "right", yLift: 4.0 });
    if (item.total != null) put(page2, font, formatBaht(item.total), 422.1, y, { maxWidth: 66.8, align: "right", yLift: 4.0 });
    if (item.note) put(page2, font, item.note, 499.6, y, { maxWidth: 48, yLift: 4.0 });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
