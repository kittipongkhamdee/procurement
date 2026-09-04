import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatBaht } from "@/lib/thai";
import type { ApprovalPdfData } from "./approval-types";

const BLACK = rgb(0, 0, 0);
const PAGE_H = 841.92;
const FONT_SIZE = 10.5;
const MIN_SHRINK_SIZE = 8;

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

/** หาขนาดฟอนต์ที่ใหญ่สุด (ไม่เกิน FONT_SIZE, ไม่ต่ำกว่า minSize) ที่ทำให้ข้อความกว้างไม่เกิน maxWidth
 * ในบรรทัดเดียว — ใช้ร่วมกันระหว่าง fillAutoShrink/putAutoShrink */
function shrinkToFit(font: PDFFont, text: string, maxWidth: number, minSize: number): number {
  let size = FONT_SIZE;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.25;
  }
  return size;
}

/** ตัดข้อความท้ายออกทีละตัวจนกว่าจะพอดี maxWidth ที่ขนาดฟอนต์ที่กำหนด แล้วต่อ "…" ปิดท้าย — ใช้เป็น
 * ทางออกสุดท้ายเมื่อย่อฟอนต์ถึง minSize แล้วยังไม่พอ กันไม่ให้ข้อความยาวมากๆ (เช่นเหตุผลไม่อนุมัติ)
 * ไหลล้นไปทับคอลัมน์/ข้อความข้างเคียง */
function truncateToFit(font: PDFFont, text: string, maxWidth: number, size: number): string {
  const ellipsis = "…";
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid) + ellipsis, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

/** ย่อฟอนต์ให้พอดีก่อน ถ้าย่อถึง minSize แล้วยังไม่พอ ค่อยตัดข้อความท้ายทิ้งเป็นทางเลือกสุดท้าย —
 * รับประกันว่าข้อความที่วาดจะไม่กว้างเกิน maxWidth เสมอไม่ว่าข้อความต้นทางจะยาวแค่ไหน */
function fitText(font: PDFFont, text: string, maxWidth: number, minSize: number): { text: string; size: number } {
  const size = shrinkToFit(font, text, maxWidth, minSize);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };
  return { text: truncateToFit(font, text, maxWidth, size), size };
}

/** เหมือน fill() แต่ถ้าข้อความยาวเกินกรอบ (x0-x1) ในขนาดฟอนต์ปกติ จะลดขนาดฟอนต์ลงทีละน้อยจนกว่า
 * จะพอดีในบรรทัดเดียว (ไม่ต่ำกว่า minSize) แทนที่จะปล่อยให้ข้อความไหลล้นออกนอกกรอบ — ใช้กับช่องที่
 * เป็นกรอบบรรทัดเดียวตายตัวในเทมเพลตซึ่งขึ้นบรรทัดใหม่ไม่ได้ */
function fillAutoShrink(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x0: number,
  x1: number,
  yBottom: number,
  opts: { align?: "left" | "center" | "right"; minSize?: number } = {},
) {
  if (!text) return;
  const left = x0 + INSET;
  const right = x1 - INSET;
  const maxWidth = right - left;
  const { text: fitted, size } = fitText(font, text, maxWidth, opts.minSize ?? MIN_SHRINK_SIZE);
  const width = font.widthOfTextAtSize(fitted, size);
  let drawX = left;
  if (opts.align === "center") drawX = left + (maxWidth - width) / 2;
  else if (opts.align === "right") drawX = left + maxWidth - width;
  page.drawText(fitted, { x: drawX, y: PAGE_H - yBottom + 6.5, size, font, color: BLACK });
}

/** เหมือน putAutoShrink สำหรับช่องในตาราง (ไม่มี INSET ปรับเข้า อ้างอิง x ตรงๆ แบบ put()) — ใช้กับช่อง
 * ที่จัดชิดซ้ายในตารางซึ่ง put() เดิมไม่ได้บังคับความกว้างไว้เลย (เพราะ put() จำกัด maxWidth เฉพาะตอน
 * จัดกึ่งกลาง/ชิดขวาเท่านั้น) ทำให้ข้อความยาวไหลล้นออกนอกคอลัมน์ได้ */
function putAutoShrink(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  maxWidth: number,
  yBottom: number,
  opts: { yLift?: number; minSize?: number } = {},
) {
  if (!text) return;
  const { text: fitted, size } = fitText(font, text, maxWidth, opts.minSize ?? MIN_SHRINK_SIZE);
  page.drawText(fitted, { x, y: PAGE_H - yBottom + (opts.yLift ?? 6.5), size, font, color: BLACK });
}

type WrapSlot = { x0: number; x1: number; yBottom: number };

/** หาความยาวคำนำหน้า (prefix) สูงสุดของ text ที่กว้างไม่เกิน maxWidth ที่ขนาดฟอนต์ size ด้วย binary
 * search ระดับตัวอักษร (รองรับภาษาไทยที่มักไม่มีช่องว่างคั่นคำ ต่างจากการตัดแค่ที่ช่องว่างซึ่งจะปล่อยให้
 * คำเดียวที่ยาวเกินกรอบไหลออกนอกช่องทั้งดุ้นได้) แล้วค่อยขยับกลับไปตัดที่ช่องว่างล่าสุดถ้ามี เพื่อไม่ให้
 * ตัดกลางคำภาษาอังกฤษที่มีช่องว่างอยู่แล้วโดยไม่จำเป็น — คืนทั้งส่วนที่ใช้ (line) และส่วนที่เหลือ (rest)
 * เสมอ ไม่มีการทิ้งข้อความ */
function splitPrefix(font: PDFFont, text: string, maxWidth: number, size: number): { line: string; rest: string } {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { line: text, rest: "" };
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(text.slice(0, mid), size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  const cut = Math.max(lo, 1);
  const spaceIdx = text.lastIndexOf(" ", cut);
  const breakAt = spaceIdx > 0 ? spaceIdx : cut;
  return { line: text.slice(0, breakAt).trimEnd(), rest: text.slice(breakAt).trimStart() };
}

/** ตัดข้อความขึ้นบรรทัดใหม่ข้ามหลายช่อง (slots) ที่กำหนดไว้ล่วงหน้าในเทมเพลต (แต่ละช่องมีตำแหน่ง/ความกว้าง
 * ของตัวเอง) — แต่ละช่องที่ไม่ใช่ช่องสุดท้ายรับประกันว่าจะไม่กว้างเกิน maxWidth ของตัวเองเสมอ (ตัดระดับ
 * ตัวอักษรถ้าจำเป็น ไม่ใช่แค่ตัดที่ช่องว่าง) กันไม่ให้ข้อความไหลออกนอกช่อง/หลุดขอบกระดาษไปเงียบๆ ส่วนช่อง
 * สุดท้ายจะใส่ข้อความที่เหลือทั้งหมดเสมอ (ไม่ทิ้งข้อมูล) โดยย่อขนาดฟอนต์ก่อน แล้วตัดท้ายด้วย "…" ถ้ายังไม่พอ */
function fillWrap(
  page: PDFPage,
  font: PDFFont,
  text: string,
  slots: WrapSlot[],
  opts: { align?: "left" | "center" | "right"; minSize?: number } = {},
) {
  if (!text) return;
  const minSize = opts.minSize ?? MIN_SHRINK_SIZE;
  let remaining = text.trim();

  slots.forEach((slot, i) => {
    if (!remaining) return;
    const isLast = i === slots.length - 1;
    const maxWidth = slot.x1 - slot.x0 - 2 * INSET;
    let size = FONT_SIZE;
    let line: string;

    if (isLast) {
      const fitted = fitText(font, remaining, maxWidth, minSize);
      line = fitted.text;
      size = fitted.size;
      remaining = "";
    } else {
      const { line: l, rest } = splitPrefix(font, remaining, maxWidth, size);
      line = l;
      remaining = rest;
    }

    const width = font.widthOfTextAtSize(line, size);
    let drawX = slot.x0 + INSET;
    if (opts.align === "center") drawX = slot.x0 + INSET + (maxWidth - width) / 2;
    else if (opts.align === "right") drawX = slot.x0 + INSET + maxWidth - width;
    page.drawText(line, { x: drawX, y: PAGE_H - slot.yBottom + 6.5, size, font, color: BLACK });
  });
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
  fillAutoShrink(page1, font, data.doc_number ?? "", 127.7, 283, 107.7);
  fillAutoShrink(page1, font, data.doc_date, 317.95, 534.36, 107.7);

  // บรรทัด "เรื่อง" — ผู้ใช้แก้เทมเพลตเพิ่มบรรทัดสำรองว่างด้านล่างไว้ให้ขึ้นบรรทัดใหม่ได้แล้ว (เดิมมีปัญหา
  // ชื่อโครงการยาวไหลล้นออกนอกกรอบบรรทัดเดียว) จึงตัดคำขึ้นบรรทัดที่ 2 แทนการย่อขนาดฟอนต์อย่างเดียว
  fillWrap(page1, font, data.project_name ?? "", [
    { x0: 274.4, x1: 536.4, yBottom: 134.4 },
    { x0: 113.4, x1: 598.2, yBottom: 156.4 },
  ]);

  fillAutoShrink(page1, font, data.department ?? "", 245.21, 433.78, 198.9);
  fillAutoShrink(page1, font, data.activity_name ?? "", 138.26, 538.2, 220.3);

  // บรรทัด "ตามโครงการ/งาน" — เทมเพลตใหม่เว้นบรรทัดสำรองไว้เช่นกัน (บรรทัดที่ 2 แคบกว่าเพราะมีข้อความ
  // "จะดำเนินการวันที่...และขออนุมัติงบประมาณ" พิมพ์ต่อท้ายอยู่ในบรรทัดเดียวกัน)
  fillWrap(page1, font, data.project_name ?? "", [
    { x0: 159.83, x1: 536.98, yBottom: 241.5 },
    { x0: 85.1, x1: 246, yBottom: 262.8 },
  ]);

  fillAutoShrink(page1, font, data.plan_date_text ?? "", 328.51, 429.94, 262.8);
  fillAutoShrink(page1, font, formatBaht(data.requested_amount), 166.4, 253.5, 284.1, { align: "right" });

  fillAutoShrink(page1, font, data.requested_by_name ?? "", 295.87, 465.7, 354.1, { align: "center" });

  // ตารางรายการเงิน 5 แถว + รวมทั้งสิ้น (ช่องว่างอยู่แล้ว ไม่ต้องปิดทับ) — ใช้ yLift ต่ำกว่าปกติ (4.0pt
  // แทน 6.5pt) เพราะช่องนี้เป็นตารางที่มีเส้นขอบจริง ไม่ใช่จุดไข่ปลา ตัวเลขจึงควรอยู่กึ่งกลางแถวมากกว่า
  const summaryRowsY = [397.6, 419.5, 441.2, 463.1, 484.9];
  data.summary_items.slice(0, 5).forEach((row, i) => {
    if (row.amount)
      put(page1, font, formatBaht(row.amount), 384, summaryRowsY[i], { maxWidth: 50, align: "right", yLift: 4.0 });
    if (row.note) putAutoShrink(page1, font, row.note, 476, 40, summaryRowsY[i], { yLift: 4.0 });
  });
  const summaryTotal = data.summary_items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  put(page1, boldFont, formatBaht(summaryTotal), 384, 506.6, { maxWidth: 44, align: "right", yLift: 4.0 });

  // กล่อง 1: ความเห็นงานแผนงาน
  fillAutoShrink(page1, font, data.budget != null ? formatBaht(data.budget) : "", 172.89, 271.56, 583.5);
  fillAutoShrink(page1, font, formatBaht(data.requested_amount), 157.2, 271.44, 604.8);
  fillAutoShrink(page1, font, data.remaining != null ? formatBaht(data.remaining) : "", 170.86, 272.18, 626.1);
  // ชื่อผู้ลงนามทั้ง 4 จุด (งานแผนงาน/การเงิน/รองผู้อำนวยการ/ผู้อำนวยการ) เป็นชื่อที่พิมพ์ไว้ในเทมเพลต
  // ต้นฉบับอยู่แล้วตายตัว — ไม่ต้องเขียนทับ ปล่อยให้เทมเพลตแสดงชื่อเดิมตามที่เป็น

  // กล่อง 2: ความเห็นเจ้าหน้าที่การเงิน
  if (data.fund_type === "งบค่าจัดการเรียนการสอน") checkmark(page1, font, 317.23, 583.5);
  if (data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน") checkmark(page1, font, 317.23, 604.8);
  if (data.fund_type === "เงินรายได้สถานศึกษา") checkmark(page1, font, 317.23, 626.1);

  // กล่อง 3: ความเห็นของรองผู้อำนวยการ — เหตุผล "ไม่ควรอนุมัติ" ไม่ต้องเขียนลง PDF ตามที่ผู้ใช้ขอ
  // (ยังบันทึก/แสดงในเว็บตามปกติ แค่ไม่พิมพ์ทับเทมเพลต)
  if (data.deputy_decision === "ควร") checkmark(page1, font, 90.74, 733.1);
  if (data.deputy_decision === "ไม่ควร") checkmark(page1, font, 90.74, 754.4);

  // กล่อง 4: ความเห็นของผู้อำนวยการโรงเรียน — เทมเพลตใหม่วางเช็คบ็อกซ์ "อนุมัติ"/"ไม่อนุมัติ" ไว้
  // บรรทัดเดียวกัน (คนละตำแหน่ง x) ต่างจากเทมเพลตเดิมที่แยกกันคนละบรรทัด
  if (data.status === "อนุมัติ") checkmark(page1, font, 317.23, 733.1);
  if (data.status === "ไม่อนุมัติ") checkmark(page1, font, 388.3, 733.1);
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
    fill(page1, font, String(d.getDate()), 336.19, 365.83, 818.3, 17.4);
    fill(page1, font, THAI_MONTHS[d.getMonth() + 1], 388.3, 479.86, 818.3, 17.4);
    fill(page1, font, String(d.getFullYear() + 543), 495.96, 522.84, 818.3, 17.4);
  }

  // ---------- หน้า 2: รายการวัสดุ อุปกรณ์ ----------
  fillAutoShrink(page2, font, data.project_name ?? "", 179.93, 537.84, 60.5);
  fillAutoShrink(page2, font, data.activity_name ?? "", 125.19, 538.2, 81.75);

  // ตารางรายการวัสดุอุปกรณ์ — คอลัมน์ (x) เหมือนเทมเพลตเดิมทุกจุด มีแค่แถว (y) ที่เลื่อนขึ้นทั้งตาราง
  // ~14.15pt เท่ากันทุกแถว เพราะหัวกระดาษด้านบนเตี้ยลง (วัดตำแหน่งเส้นขอบตารางจริงเทียบเก่า-ใหม่แล้ว)
  const itemRowsY = [
    168.05, 189.75, 211.65, 233.35, 255.25, 277.05, 298.75, 320.65, 342.45, 364.15, 386.05, 407.85, 429.55, 451.45,
    473.15, 494.95, 516.85, 538.55, 560.35, 582.25, 603.95, 625.85, 647.55, 669.35, 691.25, 712.95, 734.75, 756.65,
    778.35,
  ];
  data.items.slice(0, itemRowsY.length).forEach((item, i) => {
    const y = itemRowsY[i];
    if (item.name) putAutoShrink(page2, font, item.name, 93, 205, y, { yLift: 4.0 });
    if (item.qty != null) put(page2, font, String(item.qty), 299.5, y, { maxWidth: 46, align: "center", yLift: 4.0 });
    if (item.unit_price != null)
      put(page2, font, formatBaht(item.unit_price), 349.4, y, { maxWidth: 68.7, align: "right", yLift: 4.0 });
    if (item.total != null) put(page2, font, formatBaht(item.total), 422.1, y, { maxWidth: 66.8, align: "right", yLift: 4.0 });
    if (item.note) putAutoShrink(page2, font, item.note, 499.6, 48, y, { yLift: 4.0 });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
