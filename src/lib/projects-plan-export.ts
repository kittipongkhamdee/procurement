// ส่งออก "โครงการตามแผนปฏิบัติการ" เป็นไฟล์ Excel (.xlsx) — โครงการ กิจกรรมย่อย กลุ่มบริหาร แหล่งเงินงบประมาณ งบประมาณ
// ใช้ในหน้า โครงการ (ฝั่งเบราว์เซอร์ — ข้อมูลโหลดมาแสดงในตารางอยู่แล้ว) กิจกรรมที่แบ่งหลายแหล่งเงินแสดงยอดแยกแหล่ง
// และมีแผ่นสรุปตามกลุ่มบริหาร/แหล่งเงิน (นับตามการแบ่งหลายแหล่ง)

export type PlanExportActivity = {
  name: string;
  budget: number;
  /** แบ่งหลายแหล่งเงิน (ว่าง = ใช้แหล่งงบของโครงการ) */
  sources: { name: string; amount: number }[];
};

export type PlanExportProject = {
  name: string;
  adminGroup: string;
  /** ข้อความแหล่งเงินของโครงการ (หลายแหล่งคั่นด้วย +) — ใช้แสดงในแถวโครงการ */
  sourceLabel: string;
  /** ชื่อแหล่งงบหลักของโครงการ (แหล่งเดียว) — ใช้เป็นแหล่งของกิจกรรมที่ไม่ได้แบ่ง */
  ownSourceName: string;
  budget: number;
  activities: PlanExportActivity[];
  /** แบ่งหลายแหล่งระดับโครงการ (เฉพาะโครงการที่ไม่มีกิจกรรมย่อย) */
  projectSources: { name: string; amount: number }[];
  spent?: number;
  paid?: number;
  remaining?: number;
};

const MONEY_FMT = "#,##0.00";
const baht = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function buildProjectsPlanWorkbook(opts: { yearLabel: string; projects: PlanExportProject[]; showSpending?: boolean }): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const THIN = { style: "thin" as const, color: { argb: "FFBFC5CE" } };
  const border = { left: THIN, right: THIN, top: THIN, bottom: THIN };
  const font = (o: Record<string, unknown> = {}) => ({ name: "Tahoma", size: 11, ...o });
  const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
  const showSpending = !!opts.showSpending;
  const colCount = showSpending ? 9 : 6;
  const lastCol = String.fromCharCode(64 + colCount);

  const ws = wb.addWorksheet("โครงการตามแผนปฏิบัติการ", { views: [{ state: "frozen", ySplit: 4 }] });
  ws.mergeCells(`A1:${lastCol}1`);
  ws.getCell("A1").value = `โครงการตามแผนปฏิบัติการ ปีงบประมาณ ${opts.yearLabel}`;
  ws.getCell("A1").font = { name: "Tahoma", size: 14, bold: true };
  ws.mergeCells(`A2:${lastCol}2`);
  ws.getCell("A2").value = "โครงการ กิจกรรมย่อย กลุ่มบริหาร แหล่งเงินงบประมาณ และงบประมาณ (ข้อมูลจากระบบ ณ วันที่ส่งออก)";
  ws.getCell("A2").font = font({ color: { argb: "FF555555" } });
  const heads = ["ลำดับ", "โครงการ", "กิจกรรมย่อย", "กลุ่มบริหาร", "แหล่งเงินงบประมาณ", "งบประมาณ (บาท)", ...(showSpending ? ["อนุมัติแล้ว (บาท)", "จ่ายจริง (บาท)", "คงเหลือ (บาท)"] : [])];
  heads.forEach((h, i) => {
    const c = ws.getCell(4, i + 1);
    c.value = h;
    c.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    c.fill = fill("FF1F3A5F");
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  });

  let r = 5;
  const byGroup = new Map<string, number>();
  const bySource = new Map<string, number>();
  const addSource = (name: string, amount: number) => bySource.set(name || "ไม่ระบุแหล่งเงิน", (bySource.get(name || "ไม่ระบุแหล่งเงิน") ?? 0) + amount);
  const splitText = (s: { name: string; amount: number }[]) => s.map((x) => `${x.name} ${baht(x.amount)}`).join(" + ");

  opts.projects.forEach((p, idx) => {
    const n = idx + 1;
    byGroup.set(p.adminGroup, (byGroup.get(p.adminGroup) ?? 0) + p.budget);
    const row = ws.getRow(r);
    const vals: (string | number)[] = [n, p.name, "", p.adminGroup, p.sourceLabel, p.budget];
    if (showSpending) vals.push(p.spent ?? 0, p.paid ?? 0, p.remaining ?? 0);
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v;
      c.font = font({ bold: true });
      c.fill = fill("FFE8EEF6");
      c.border = border;
      c.alignment = { vertical: "top", wrapText: true, horizontal: i === 0 ? "center" : i >= 5 ? "right" : "left" };
    });
    for (let i = 6; i <= colCount; i++) row.getCell(i).numFmt = MONEY_FMT;
    r++;
    if (p.activities.length === 0) {
      if (p.projectSources.length > 0) p.projectSources.forEach((x) => addSource(x.name, x.amount));
      else addSource(p.ownSourceName, p.budget);
    }
    p.activities.forEach((a, k) => {
      if (a.sources.length > 0) a.sources.forEach((x) => addSource(x.name, x.amount));
      else addSource(p.ownSourceName, a.budget);
      const rr = ws.getRow(r);
      ["", "", `${n}.${k + 1} ${a.name}`, p.adminGroup, a.sources.length > 0 ? splitText(a.sources) : p.ownSourceName, a.budget].forEach((v, i) => {
        const c = rr.getCell(i + 1);
        c.value = v;
        c.font = font();
        c.border = border;
        c.alignment = { vertical: "top", wrapText: true, horizontal: i === 5 ? "right" : "left" };
      });
      for (let i = 7; i <= colCount; i++) rr.getCell(i).border = border;
      rr.getCell(6).numFmt = MONEY_FMT;
      r++;
    });
  });

  const tot = ws.getRow(r);
  tot.getCell(2).value = "รวมทั้งสิ้น";
  tot.getCell(2).font = font({ bold: true });
  // รวมเฉพาะแถวโครงการ (มีลำดับ) — กิจกรรมย่อยไม่นับซ้ำ
  tot.getCell(6).value = { formula: `SUMIF(A5:A${r - 1},">0",F5:F${r - 1})` };
  tot.getCell(6).font = font({ bold: true });
  tot.getCell(6).numFmt = MONEY_FMT;
  if (showSpending) {
    (["G", "H", "I"] as const).forEach((col, i) => {
      const cell = tot.getCell(7 + i);
      cell.value = { formula: `SUMIF(A5:A${r - 1},">0",${col}5:${col}${r - 1})` };
      cell.font = font({ bold: true });
      cell.numFmt = MONEY_FMT;
    });
  }
  for (let i = 1; i <= colCount; i++) {
    tot.getCell(i).fill = fill("FFFFF4D6");
    tot.getCell(i).border = border;
  }
  [8, 52, 52, 24, 40, 18, 18, 18, 18].slice(0, colCount).forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.autoFilter = { from: "A4", to: `${lastCol}${r - 1}` };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4" };

  const s2 = wb.addWorksheet("สรุปตามกลุ่มและแหล่งเงิน");
  const table = (row: number, title: string, data: [string, number][]) => {
    s2.getCell(row, 1).value = title;
    s2.getCell(row, 1).font = { name: "Tahoma", size: 12, bold: true };
    ["รายการ", "งบประมาณ (บาท)"].forEach((h, i) => {
      const c = s2.getCell(row + 1, i + 1);
      c.value = h;
      c.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
      c.fill = fill("FF1F3A5F");
      c.border = border;
      c.alignment = { horizontal: "center" };
    });
    let rr = row + 2;
    for (const [k, v] of data) {
      const a = s2.getCell(rr, 1);
      const b = s2.getCell(rr, 2);
      a.value = k;
      b.value = v;
      a.font = b.font = font();
      a.border = b.border = border;
      b.numFmt = MONEY_FMT;
      rr++;
    }
    const a = s2.getCell(rr, 1);
    const b = s2.getCell(rr, 2);
    a.value = "รวม";
    b.value = { formula: `SUM(B${row + 2}:B${rr - 1})` };
    a.font = b.font = font({ bold: true });
    a.fill = b.fill = fill("FFFFF4D6");
    a.border = b.border = border;
    b.numFmt = MONEY_FMT;
    return rr + 2;
  };
  const next = table(1, "สรุปตามกลุ่มบริหาร", [...byGroup.entries()]);
  table(next, "สรุปตามแหล่งเงินงบประมาณ (นับตามการแบ่งหลายแหล่งของกิจกรรม)", [...bySource.entries()]);
  s2.getColumn(1).width = 46;
  s2.getColumn(2).width = 20;

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
