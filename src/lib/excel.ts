import ExcelJS from "exceljs";

export type ExcelColumn = { header: string; key: string; width?: number; numFmt?: string };

// สร้างไฟล์ .xlsx อย่างง่ายจากคอลัมน์ + แถวข้อมูล — ใช้ร่วมกันทุกจุดที่มีปุ่ม "ส่งออก Excel" ในระบบ
// หัวตารางแถวแรกทำตัวหนา + พื้นหลังเทาอ่อนให้อ่านง่าย
export async function buildExcelBuffer(
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
