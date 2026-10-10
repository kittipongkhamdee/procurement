// ส่งออกตารางเทียบร่างโครงการกับโครงการปีก่อนเป็นไฟล์ Excel — หนึ่งแผ่นต่อหนึ่งกลุ่มบริหารงาน + แผ่น "สรุป" รวมทุกกลุ่ม
// (ใช้ในหน้า การจัดสรรเงิน > ร่างโครงการปีงบประมาณนี้ ฝั่งเบราว์เซอร์ — ข้อมูลโหลดมาแสดงในตารางอยู่แล้วจึงไม่ต้อง query ซ้ำ)

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

export async function buildDraftCompareWorkbook(opts: {
  schoolName: string;
  prevYear: string | number;
  nextYear: string | number;
  groups: DraftCompareExportGroup[];
}): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const used = new Set<string>();
  const title = `ร่างโครงการปีงบประมาณ ${opts.nextYear} เทียบกับปีงบประมาณ ${opts.prevYear}`;

  // ----- แผ่นสรุป -----
  const summary = workbook.addWorksheet(sheetName("สรุป", used));
  summary.columns = [
    { key: "no", width: 8 },
    { key: "group", width: 38 },
    { key: "prev", width: 18 },
    { key: "next", width: 18 },
    { key: "diff", width: 18 },
    { key: "alloc", width: 18 },
    { key: "remain", width: 18 },
  ];
  summary.mergeCells("A1:G1");
  summary.getCell("A1").value = `${opts.schoolName} — ${title}`;
  summary.getCell("A1").font = { bold: true, size: 14 };
  summary.getCell("A1").alignment = { horizontal: "center" };
  const sHeader = summary.getRow(3);
  sHeader.values = ["ลำดับ", "กลุ่มบริหารงาน", `ปี ${opts.prevYear}`, `ปี ${opts.nextYear}`, "ผลต่าง", "งบจัดสรรให้กลุ่ม", "คงเหลือ"];
  sHeader.font = { bold: true };
  sHeader.alignment = { horizontal: "center" };
  sHeader.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.border = BORDER;
  });
  opts.groups.forEach((g, i) => {
    const hasAlloc = g.allocated !== null && g.allocated > 0;
    const row = summary.addRow([
      i + 1,
      g.name,
      g.prevTotal,
      g.nextTotal,
      g.nextTotal - g.prevTotal,
      hasAlloc ? g.allocated : null,
      hasAlloc ? (g.allocated as number) - g.nextTotal : null,
    ]);
    row.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = BORDER;
      if (col >= 3) c.numFmt = MONEY_FMT;
    });
    row.getCell(1).alignment = { horizontal: "center" };
  });
  const totalPrev = opts.groups.reduce((s, g) => s + g.prevTotal, 0);
  const totalNext = opts.groups.reduce((s, g) => s + g.nextTotal, 0);
  const sTotal = summary.addRow(["", "รวมทั้งสิ้น", totalPrev, totalNext, totalNext - totalPrev, null, null]);
  sTotal.font = { bold: true };
  sTotal.eachCell({ includeEmpty: true }, (c, col) => {
    c.border = BORDER;
    c.fill = HEADER_FILL;
    if (col >= 3) c.numFmt = MONEY_FMT;
  });
  summary.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ----- หนึ่งแผ่นต่อหนึ่งกลุ่มบริหารงาน -----
  for (const g of opts.groups) {
    const ws = workbook.addWorksheet(sheetName(g.name, used));
    ws.columns = [
      { key: "no", width: 8 },
      { key: "project", width: 46 },
      { key: "activity", width: 40 },
      { key: "prev", width: 16 },
      { key: "next", width: 16 },
      { key: "diff", width: 16 },
    ];
    ws.mergeCells("A1:F1");
    ws.getCell("A1").value = `${opts.schoolName} — ${title}`;
    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A1").alignment = { horizontal: "center" };
    ws.mergeCells("A2:F2");
    ws.getCell("A2").value = g.name;
    ws.getCell("A2").font = { bold: true, size: 13 };
    ws.getCell("A2").alignment = { horizontal: "center" };
    if (g.allocated !== null && g.allocated > 0) {
      const remain = g.allocated - g.nextTotal;
      ws.mergeCells("A3:F3");
      ws.getCell("A3").value =
        `งบจัดสรรให้กลุ่ม ${g.allocated.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท · ร่างโครงการรวม ${g.nextTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท · ` +
        (remain < -0.005
          ? `เกินงบจัดสรร ${(-remain).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`
          : `เหลือ ${remain.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`);
      ws.getCell("A3").alignment = { horizontal: "center" };
    }

    const header = ws.getRow(5);
    header.values = ["ลำดับ", "โครงการ", "กิจกรรม", `ปี ${opts.prevYear}`, `ปี ${opts.nextYear}`, "ผลต่าง"];
    header.font = { bold: true };
    header.alignment = { horizontal: "center", vertical: "middle" };
    header.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.border = BORDER;
    });

    let no = 0;
    for (const p of g.projects) {
      no += 1;
      const diff = p.prev !== null && p.next !== null ? p.next - p.prev : null;
      const projectCell = p.note ? `${p.name} (${p.note})` : p.name;
      const pr = ws.addRow([no, projectCell, "", p.prev, p.next, diff]);
      pr.font = { bold: true, color: p.next === null ? { argb: "FF64748B" } : undefined };
      pr.eachCell({ includeEmpty: true }, (c, col) => {
        c.border = BORDER;
        c.fill = GRAY_FILL;
        c.alignment = { vertical: "top", wrapText: col === 2 };
        if (col >= 4) c.numFmt = MONEY_FMT;
      });
      pr.getCell(1).alignment = { horizontal: "center", vertical: "top" };
      for (const a of p.activities) {
        const ad = a.prev !== null && a.next !== null ? a.next - a.prev : null;
        const ar = ws.addRow(["", "", a.name, a.prev, a.next, ad]);
        ar.eachCell({ includeEmpty: true }, (c, col) => {
          c.border = BORDER;
          c.alignment = { vertical: "top", wrapText: col === 3 };
          if (col >= 4) c.numFmt = MONEY_FMT;
        });
      }
    }

    const total = ws.addRow(["", "รวมทั้งสิ้น", "", g.prevTotal, g.nextTotal, g.nextTotal - g.prevTotal]);
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
