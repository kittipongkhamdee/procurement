import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatBaht } from "@/lib/thai";
import type { ApprovalPdfData } from "./approval-types";

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const PAGE_H = 841.92;

/** ปิดทับพื้นที่จุดไข่ปลา/ข้อความเดิมของเทมเพลตด้วยสี่เหลี่ยมขาว ก่อนเขียนค่าจริงทับ — พิกัดอ้างอิง
 * จากขอบบนของหน้า (แบบเดียวกับ bbox ของ PyMuPDF: x0, y1 คือขอบล่างของบรรทัดนั้น) */
function whiteout(page: PDFPage, x0: number, x1: number, yBottom: number, height: number) {
  page.drawRectangle({
    x: x0 - 1,
    y: PAGE_H - yBottom - 1,
    width: x1 - x0 + 2,
    height: height + 2,
    color: WHITE,
  });
}

/** วาดข้อความที่พิกัด (x, yBottom) — yBottom คือขอบล่างของบรรทัดนั้นในเทมเพลตต้นฉบับ (ค่าเดียวกับที่
 * PyMuPDF รายงานเป็น bbox[3]) แปลงเป็นระบบพิกัดของ pdf-lib (อ้างอิงขอบล่างหน้า) ให้อัตโนมัติ
 * ย่อขนาดฟอนต์ลงถ้าข้อความยาวเกิน maxWidth กันข้อความยาว (เช่น ชื่อโครงการ) ล้นทับข้อความอื่น */
function put(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yBottom: number,
  opts: { size?: number; maxWidth?: number; align?: "left" | "center" | "right" } = {},
) {
  if (!text) return;
  let size = opts.size ?? 12;
  if (opts.maxWidth) {
    while (size > 6 && font.widthOfTextAtSize(text, size) > opts.maxWidth) size -= 0.5;
  }
  let drawX = x;
  if (opts.align === "center" && opts.maxWidth) {
    drawX = x + (opts.maxWidth - font.widthOfTextAtSize(text, size)) / 2;
  } else if (opts.align === "right" && opts.maxWidth) {
    drawX = x + opts.maxWidth - font.widthOfTextAtSize(text, size);
  }
  page.drawText(text, { x: drawX, y: PAGE_H - yBottom + 2.5, size, font, color: BLACK });
}

/** เคลียร์จุดไข่ปลาเดิมในช่วง (x0,x1) แล้วเขียนค่าจริงทับ ในตำแหน่งเดียวกัน */
function fill(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x0: number,
  x1: number,
  yBottom: number,
  height: number,
  opts: { size?: number; align?: "left" | "center" | "right" } = {},
) {
  whiteout(page, x0, x1, yBottom, height);
  if (!text) return;
  put(page, font, text, x0, yBottom, { size: opts.size, maxWidth: x1 - x0, align: opts.align });
}

function checkmark(page: PDFPage, font: PDFFont, x0: number, yBottom: number) {
  put(page, font, "X", x0, yBottom, { size: 9, maxWidth: 14, align: "center" });
}

export async function renderApprovalPdfBuffer(data: ApprovalPdfData): Promise<Buffer> {
  const templateBytes = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf-overlay/approval-template.pdf"));
  const sarabunRegular = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf"));
  const sarabunBold = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"));

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(sarabunRegular, { subset: true });
  const boldFont = await pdfDoc.embedFont(sarabunBold, { subset: true });

  const [page1, page2] = pdfDoc.getPages();

  // ---------- หน้า 1 ----------
  fill(page1, font, data.doc_number ?? "", 127, 286, 120.9, 17.5);
  fill(page1, font, data.doc_date, 320, 534, 120.9, 17.5);
  fill(page1, font, data.department ?? "", 245, 428, 191.8, 17.5);
  fill(page1, font, data.activity_name ?? "", 138, 538, 213.1, 17.5);
  fill(page1, font, data.project_name ?? "", 160, 537, 234.4, 17.5);
  fill(page1, font, data.plan_date_text ?? "", 160, 261, 255.6, 17.4);
  fill(page1, font, formatBaht(data.requested_amount), 451, 519, 255.6, 17.4, { align: "right" });

  fill(page1, font, data.requested_by_name ?? "", 330, 454, 325.6, 17.4, { align: "center" });

  // ตารางรายการเงิน 5 แถว + รวมทั้งสิ้น (ช่องว่างอยู่แล้ว ไม่ต้องปิดทับ)
  const summaryRowsY = [370.8, 392.6, 414.4, 436.2, 458.0];
  data.summary_items.slice(0, 5).forEach((row, i) => {
    if (row.amount) put(page1, font, formatBaht(row.amount), 384, summaryRowsY[i], { size: 11, maxWidth: 50, align: "right" });
    if (row.note) put(page1, font, row.note, 476, summaryRowsY[i], { size: 10, maxWidth: 40 });
  });
  const summaryTotal = data.summary_items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  put(page1, boldFont, formatBaht(summaryTotal), 384, 479.9, { size: 11, maxWidth: 50, align: "right" });

  // กล่อง 1: ความเห็นงานแผนงาน
  fill(page1, font, data.budget != null ? formatBaht(data.budget) : "", 172, 270, 566.0, 17.4);
  fill(page1, font, formatBaht(data.requested_amount), 156, 270, 587.3, 17.5);
  fill(page1, font, data.remaining != null ? formatBaht(data.remaining) : "", 170, 270, 608.6, 17.4);
  fill(page1, font, `(${data.signer_planning ?? "-"})`, 90.7, 204.4, 651.2, 17.4, { align: "center" });

  // กล่อง 2: ความเห็นเจ้าหน้าที่การเงิน
  if (data.fund_type === "งบค่าจัดการเรียนการสอน") checkmark(page1, font, 317.2, 565.3);
  if (data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน") checkmark(page1, font, 317.2, 586.5);
  if (data.fund_type === "เงินรายได้สถานศึกษา") checkmark(page1, font, 317.2, 607.9);
  fill(page1, font, `(${data.signer_finance ?? "-"})`, 317.2, 470.1, 651.2, 17.4, { align: "center" });

  // กล่อง 3: ความเห็นของรองผู้อำนวยการ
  if (data.deputy_decision === "ควร") checkmark(page1, font, 90.7, 714.9);
  if (data.deputy_decision === "ไม่ควร") {
    checkmark(page1, font, 90.7, 736.2);
    fill(page1, font, data.deputy_note ?? "", 239, 299.7, 736.9, 17.4, { size: 9 });
  }
  fill(page1, font, `(${data.signer_deputy ?? "-"})`, 90.7, 235.0, 779.5, 17.4, { align: "center" });

  // กล่อง 4: ความเห็นของผู้อำนวยการโรงเรียน
  if (data.status === "อนุมัติ") checkmark(page1, font, 317.2, 714.9);
  if (data.status === "ไม่อนุมัติ") checkmark(page1, font, 317.2, 736.2);
  fill(page1, font, `(${data.signer_director ?? "-"})`, 317.2, 476.6, 779.5, 17.4, { align: "center" });
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
    fill(page1, font, String(d.getDate()), 338, 365, 822.0, 17.4, { size: 10 });
    fill(page1, font, THAI_MONTHS[d.getMonth() + 1], 390, 479, 822.0, 17.4, { size: 10 });
    fill(page1, font, String(d.getFullYear() + 543), 500, 522.7, 822.0, 17.4, { size: 10 });
  }

  // ---------- หน้า 2: รายการวัสดุ อุปกรณ์ ----------
  fill(page2, font, data.project_name ?? "", 255, 522, 53.3, 17.5, { size: 11 });
  fill(page2, font, data.activity_name ?? "", 142, 520, 74.7, 17.5, { size: 11 });
  fill(page2, font, data.department ?? "", 156, 288, 95.9, 17.4, { size: 10 });
  fill(page2, font, data.group_name ?? "", 327, 440, 95.9, 17.4, { size: 10 });
  fill(page2, font, data.budget_year_text ?? "", 493, 530, 95.9, 17.4, { size: 10 });

  const itemRowsY = [
    182.2, 203.9, 225.8, 247.5, 269.4, 291.2, 312.9, 334.8, 356.6, 378.3, 400.2, 422.0, 443.7, 465.6, 487.3, 509.1,
    531.0, 552.7, 574.5, 596.4, 618.1, 640.0, 661.7, 683.5, 705.4, 727.1, 748.9, 770.8, 792.5,
  ];
  data.items.slice(0, itemRowsY.length).forEach((item, i) => {
    const y = itemRowsY[i];
    if (item.name) put(page2, font, item.name, 93, y, { size: 10, maxWidth: 198 });
    if (item.qty != null) put(page2, font, String(item.qty), 296, y, { size: 10, maxWidth: 62, align: "center" });
    if (item.unit_price != null) put(page2, font, formatBaht(item.unit_price), 360, y, { size: 10, maxWidth: 60, align: "right" });
    if (item.total != null) put(page2, font, formatBaht(item.total), 422, y, { size: 10, maxWidth: 60, align: "right" });
    if (item.note) put(page2, font, item.note, 485, y, { size: 9, maxWidth: 48 });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
