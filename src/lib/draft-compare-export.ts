// ส่งออกตารางเทียบร่างโครงการกับโครงการปีก่อนเป็นไฟล์ Excel — หนึ่งแผ่นต่อหนึ่งกลุ่มบริหารงาน + แผ่น "สรุป" รวมทุกกลุ่ม
// (ใช้ในหน้า การจัดสรรเงิน > ร่างโครงการปีงบประมาณนี้ ฝั่งเบราว์เซอร์ — ข้อมูลโหลดมาแสดงในตารางอยู่แล้วจึงไม่ต้อง query ซ้ำ)
// เลือกได้ว่าจะแสดงคอลัมน์ "ปีก่อน" และ "ผลต่าง" หรือไม่ (ปีนี้แสดงเสมอ)

export type DraftCompareExportActivity = { name: string; prev: number | null; next: number | null };
export type DraftCompareExportProject = {
  name: string;
  prev: number | null;
  next: number | null;
  /** หมายเหตุท้ายชื่อโครงการ เช่น "ยังไม่มีร่างปี 2570" / "ไม่มีโครงการเทียบ" */
  note?: string;
  activities: DraftCompareExportActivity[];
};
export type DraftCompareExportGroup = {
  name: string;
  allocated: number | null;
  prevTotal: number;
  nextTotal: number;
  projects: DraftCompareExportProject[];
};

const MONEY_FMT = "#,##0.00;[Red]-#,##0.00";
const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF1F5F9" } };
const GRAY_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
const THIN = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const COL_LETTERS = "ABCDEFGHIJ";

// ชื่อแผ่นงาน Excel: ยาวไม่เกิน 31 ตัวอักษร ห้ามมี [ ] : * ? / \ และห้ามซ้ำกัน
function sheetName(raw: string, used: Set<string>) {
  const base = raw.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "แผ่นงาน";
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${i++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export async function buildDraftCompareWorkbook(opts: {
  schoolName: string;
  prevYear: string | number;
  nextYear: string | number;
  groups: DraftCompareExportGroup[];
  /** แสดงคอลัมน์ปีก่อน (ค่าเริ่มต้น true) */
  showPrev?: boolean;
  /** แสดงคอลัมน์ผลต่างปีนี้ - ปีก่อน (ค่าเริ่มต้น true) */
  showDiff?: boolean;
}): Promise<ArrayBuffer> {
  const showPrev = opts.showPrev ?? true;
  const showDiff = opts.showDiff ?? true;
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  const title =
    `ร่างโครงการปีงบประมาณ ${opts.nextYear}` + (showPrev || showDiff ? ` เทียบกับปีงบประมาณ ${opts.prevYear}` : "");

  // ----- แผ่นสรุป -----
  const summary = workbook.addWorksheet(sheetName("สรุป", used));
  // คอลัมน์: ลำดับ | กลุ่ม | [ปีก่อน] | ปีนี้ | [ผลต่าง] | งบจัดสรร | คงเหลือ
  const sumHeaders = ["ลำดับ", "กลุ่มบริหารงาน"];
  const sumWidths = [8, 38];
  if (showPrev) {
    sumHeaders.push(`ปี ${opts.prevYear}`);
    sumWidths.push(18);
  }
  sumHeaders.push(`ปี ${opts.nextYear}`);
  sumWidths.push(18);
  if (showDiff) {
    sumHeaders.push("ผลต่าง");
    sumWidths.push(18);
  }
  sumHeaders.push("งบจัดสรรให้กลุ่ม", "คงเหลือ");
  sumWidths.push(18, 18);
  summary.columns = sumWidths.map((width, i) => ({ key: `c${i}`, width }));
  const sumLast = COL_LETTERS[sumHeaders.length - 1];
  const moneyFrom = 2; // index (0-based) ของคอลัมน์ตัวเลขแรก
  summary.mergeCells(`A1:${sumLast}1`);
  summary.getCell("A1").value = `${opts.schoolName} — ${title}`;
  summary.getCell("A1").font = { bold: true, size: 14 };
  summary.getCell("A1").alignment = { horizontal: "center" };
  const sHeader = summary.getRow(3);
  sHeader.values = sumHeaders;
  sHeader.font = { bold: true };
  sHeader.alignment = { horizontal: "center" };
  sHeader.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.border = BORDER;
  });
  const sumRow = (no: number | string, label: string, prev: number, next: number, alloc: number | null, remain: number | null) => {
    const values: (string | number | null)[] = [no, label];
    if (showPrev) values.push(prev);
    values.push(next);
    if (showDiff) values.push(next - prev);
    values.push(alloc, remain);
    return values;
  };
  opts.groups.forEach((g, i) => {
    const hasAlloc = g.allocated !== null && g.allocated > 0;
    const row = summary.addRow(
      sumRow(i + 1, g.name, g.prevTotal, g.nextTotal, hasAlloc ? g.allocated : null, hasAlloc ? (g.allocated as number) - g.nextTotal : null),
    );
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = BORDER;
      if (col - 1 >= moneyFrom) c.numFmt = MONEY_FMT;
    });
    row.getCell(1).alignment = { horizontal: "center" };
  });
  const totalPrev = opts.groups.reduce((s, g) => s + g.prevTotal, 0);
  const totalNext = opts.groups.reduce((s, g) => s + g.nextTotal, 0);
  const sTotal = summary.addRow(sumRow("", "รวมทั้งสิ้น", totalPrev, totalNext, null, null));
  sTotal.font = { bold: true };
  sTotal.eachCell({ includeEmpty: true }, (c, col) => {
    c.border = BORDER;
    c.fill = HEADER_FILL;
    if (col - 1 >= moneyFrom) c.numFmt = MONEY_FMT;
  });
  summary.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ----- หนึ่งแผ่นต่อหนึ่งกลุ่มบริหารงาน -----
  // คอลัมน์: ลำดับ | โครงการ | กิจกรรม | [ปีก่อน] | ปีนี้ | [ผลต่าง]
  const headers = ["ลำดับ", "โครงการ", "กิจกรรม"];
  const widths = [8, 46, 40];
  if (showPrev) {
    headers.push(`ปี ${opts.prevYear}`);
    widths.push(16);
  }
  headers.push(`ปี ${opts.nextYear}`);
  widths.push(16);
  if (showDiff) {
    headers.push("ผลต่าง");
    widths.push(16);
  }
  const last = COL_LETTERS[headers.length - 1];
  const nums = (prev: number | null, next: number | null) => {
    const out: (number | null)[] = [];
    if (showPrev) out.push(prev);
    out.push(next);
    if (showDiff) out.push(prev !== null && next !== null ? next - prev : null);
    return out;
  };

  for (const g of opts.groups) {
    const ws = workbook.addWorksheet(sheetName(g.name, used));
    ws.columns = widths.map((width, i) => ({ key: `c${i}`, width }));
    ws.mergeCells(`A1:${last}1`);
    ws.getCell("A1").value = `${opts.schoolName} — ${title}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center" };
    ws.mergeCells(`A2:${last}2`);
    ws.getCell("A2").value = g.name;
    ws.getCell("A2").font = { bold: true, size: 13 };
    ws.getCell("A2").alignment = { horizontal: "center" };
    if (g.allocated !== null && g.allocated > 0) {
      const remain = g.allocated - g.nextTotal;
      ws.mergeCells(`A3:${last}3`);
      ws.getCell("A3").value =
        `งบจัดสรรให้กลุ่ม ${fmt(g.allocated)} บาท · ร่างโครงการรวม ${fmt(g.nextTotal)} บาท · ` +
        (remain < -0.005 ? `เกินงบจัดสรร ${fmt(-remain)} บาท` : `เหลือ ${fmt(remain)} บาท`);
      ws.getCell("A3").alignment = { horizontal: "center" };
    }

    const header = ws.getRow(5);
    header.values = headers;
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle" };
    header.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.border = BORDER;
    });

    let no = 0;
    for (const p of g.projects) {
      no += 1;
      const projectCell = p.note ? `${p.name} (${p.note})` : p.name;
      const pr = ws.addRow([no, projectCell, "", ...nums(p.prev, p.next)]);
      pr.font = { bold: true, color: p.next === null ? { argb: "FF64748B" } : undefined };
      pr.eachCell({ includeEmpty: true }, (c, col) => {
        c.border = BORDER;
        c.fill = GRAY_FILL;
        c.alignment = { vertical: "top", wrapText: col === 2 };
        if (col >= 4) c.numFmt = MONEY_FMT;
      });
      pr.getCell(1).alignment = { horizontal: "center", vertical: "top" };
      for (const a of p.activities) {
        const ar = ws.addRow(["", "", a.name, ...nums(a.prev, a.next)]);
        ar.eachCell({ includeEmpty: true }, (c, col) => {
          c.border = BORDER;
          c.alignment = { vertical: "top", wrapText: col === 3 };
          if (col >= 4) c.numFmt = MONEY_FMT;
        });
      }
    }

    const total = ws.addRow(["", "รวมทั้งสิ้น", "", ...nums(g.prevTotal, g.nextTotal)]);
    total.font = { bold: true };
    total.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = BORDER;
      c.fill = HEADER_FILL;
      if (col >= 4) c.numFmt = MONEY_FMT;
    });
    ws.views = [{ state: "frozen", ySplit: 5 }];
    ws.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "5:5",
    };
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
