import { formatBaht } from "@/lib/thai";
import { getGarudaEmblemDataUri, getSarabunFontFaceCss } from "./assets";
import type { ApprovalPdfData } from "./approval-types";

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function checkbox(checked: boolean): string {
  return `<span class="checkbox">${checked ? "✕" : ""}</span>`;
}

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

function approvedDateParts(approvedAt: string | null) {
  if (!approvedAt) return { day: "", month: "", year: "" };
  const d = new Date(approvedAt);
  return { day: String(d.getDate()), month: THAI_MONTHS[d.getMonth() + 1], year: String(d.getFullYear() + 543) };
}

export function renderApprovalHtml(data: ApprovalPdfData): string {
  const summaryTotal = data.summary_items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const itemsGrandTotal = data.items.reduce((sum, i) => sum + (i.total ?? 0), 0);
  const approvedDate = approvedDateParts(data.approved_at);

  const summaryRows = data.summary_items
    .map(
      (row, i) => `
      <tr>
        <td class="tc">${i + 1}</td>
        <td>${esc(row.label)}</td>
        <td class="tr">${row.amount ? esc(formatBaht(row.amount)) : ""}</td>
        <td>${esc(row.note)}</td>
      </tr>`,
    )
    .join("");

  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td>${esc(item.name)}</td>
        <td class="tc">${item.qty ?? ""}</td>
        <td class="tr">${item.unit_price != null ? esc(formatBaht(item.unit_price)) : ""}</td>
        <td class="tr">${item.total != null ? esc(formatBaht(item.total)) : ""}</td>
        <td>${esc(item.note)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<style>
  ${getSarabunFontFaceCss()}

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Sarabun", sans-serif;
    font-size: 15px;
    color: #111827;
    line-height: 1.4;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm 20mm 12mm 22mm;
  }
  .page + .page { page-break-before: always; }

  .center { text-align: center; }

  .letterhead { position: relative; min-height: 19mm; margin-bottom: 4px; }
  .emblem { position: absolute; left: 0; top: 0; height: 18mm; }
  .school-logo { position: absolute; right: 0; top: 0; height: 15mm; object-fit: contain; }
  .title-wrap { text-align: center; padding-top: 6mm; }
  .title { font-size: 20px; font-weight: bold; margin: 0; }

  .header-line { display: flex; margin-bottom: 2px; }
  .header-line .label { font-weight: bold; white-space: nowrap; margin-right: 4px; }
  .header-line .fill { flex: 1; }
  .header-line .gap { margin-left: 28px; }

  hr { border: none; border-top: 1px solid #111827; margin: 6px 0 8px; }

  p.body-line { margin: 0 0 4px; }
  p.body-line.indent { text-indent: 2em; }

  .sign-block { text-align: center; margin: 8px 0 8px; }
  .sign-block .line { margin-bottom: 2px; }

  table.doc-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 14px; }
  table.doc-table th, table.doc-table td {
    border: 1px solid #111827;
    padding: 2px 6px;
    vertical-align: top;
  }
  table.doc-table th { text-align: center; font-weight: bold; }
  table.doc-table td.tc { text-align: center; }
  table.doc-table td.tr { text-align: right; }
  table.doc-table .col-no { width: 6%; text-align: center; }
  table.doc-table .col-item { width: 52%; }
  table.doc-table .col-amount { width: 20%; }
  table.doc-table .col-note { width: 22%; }
  table.doc-table tr.total-row td { font-weight: bold; }

  table.box-grid { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; break-inside: avoid; }
  table.box-grid tr { page-break-inside: avoid; break-inside: avoid; }
  table.box-grid td.box {
    border: 1px solid #111827;
    width: 50%;
    padding: 6px 8px;
    vertical-align: top;
    font-size: 13px;
  }
  .box-title { font-weight: bold; text-decoration: underline; margin: 0 0 4px; }
  .box-line { margin: 0 0 2px; }
  .checkbox {
    display: inline-flex;
    width: 11px;
    height: 11px;
    border: 1px solid #111827;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: bold;
    margin-right: 5px;
    vertical-align: -1px;
  }
  .box-sign { text-align: center; margin-top: 8px; }
  .box-sign .line { margin-bottom: 2px; }

  .page2-line { margin: 0 0 4px; }
  .page2-header { display: flex; margin-bottom: 10px; }
  .page2-header .item { margin-right: 24px; }
</style>
</head>
<body>
  <div class="page">
    <div class="letterhead">
      <img class="emblem" src="${getGarudaEmblemDataUri()}" />
      ${data.school_logo_url ? `<img class="school-logo" src="${esc(data.school_logo_url)}" />` : ""}
      <div class="title-wrap"><div class="title">บันทึกข้อความ</div></div>
    </div>

    <div class="header-line"><span class="label">ส่วนราชการ</span><span class="fill">${esc(
      `${data.school_name} อำเภอปราสาท จังหวัดสุรินทร์`,
    )}</span></div>
    <div class="header-line">
      <span class="label">ที่</span><span class="fill">${esc(data.doc_number ? `งป/${data.doc_number}` : "งป/")}</span>
      <span class="label gap">วันที่</span><span class="fill">${esc(data.doc_date)}</span>
    </div>
    <div class="header-line"><span class="label">เรื่อง</span><span class="fill">${esc(data.subject)}</span></div>
    <div class="header-line"><span class="label">เรียน</span><span class="fill">${esc(data.addressed_to)}</span></div>

    <hr />

    <p class="body-line indent">ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน) ${esc(data.department ?? "-")} จะดำเนินการจัดกิจกรรม (ชื่อกิจกรรม) ${esc(
      data.activity_name ?? "-",
    )}</p>
    <p class="body-line">ตามโครงการ/งาน ${esc(data.project_name ?? "-")}</p>
    <p class="body-line">จะดำเนินการวันที่ ${esc(data.plan_date_text ?? "-")} และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน ${esc(
      formatBaht(data.requested_amount),
    )} บาท</p>
    <p class="body-line indent">จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตและอนุมัติ</p>

    <div class="sign-block">
      <div class="line">(ลงชื่อ)........................................... ผู้รับผิดชอบโครงการ</div>
      <div class="line">(${esc(data.requested_by_name ?? "...........................................")})</div>
    </div>

    <table class="doc-table">
      <thead>
        <tr>
          <th class="col-no">ที่</th>
          <th class="col-item">รายการ</th>
          <th class="col-amount">จำนวนเงิน</th>
          <th class="col-note">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRows}
        <tr class="total-row">
          <td colspan="2" class="tr">รวมทั้งสิ้น</td>
          <td class="tr">${esc(formatBaht(summaryTotal))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <table class="box-grid">
      <tr>
        <td class="box">
          <p class="box-title">1. ความเห็นงานแผนงาน</p>
          <p class="box-line">- ตรวจสอบแล้วมีโครงการ</p>
          <p class="box-line">- เงินโครงการทั้งสิ้น ${data.budget != null ? esc(formatBaht(data.budget)) : "-"} บาท</p>
          <p class="box-line">- เงินขอใช้ครั้งนี้ ${esc(formatBaht(data.requested_amount))} บาท</p>
          <p class="box-line">- เงินโครงการเหลือ ${data.remaining != null ? esc(formatBaht(data.remaining)) : "-"} บาท</p>
          <div class="box-sign">
            <div class="line">(ลงชื่อ)...................................</div>
            <div class="line">(${esc(data.signer_planning ?? "-")})</div>
          </div>
        </td>
        <td class="box">
          <p class="box-title">2. ความเห็นเจ้าหน้าที่การเงิน</p>
          <p class="box-line">- ตรวจสอบแล้วมีงบประมาณ</p>
          <p class="box-line">${checkbox(data.fund_type === "งบค่าจัดการเรียนการสอน")} งบค่าจัดการเรียนการสอน</p>
          <p class="box-line">${checkbox(data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน")} งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน</p>
          <p class="box-line">${checkbox(data.fund_type === "เงินรายได้สถานศึกษา")} เงินรายได้สถานศึกษา</p>
          <div class="box-sign">
            <div class="line">(ลงชื่อ)...................................</div>
            <div class="line">(${esc(data.signer_finance ?? "-")})</div>
          </div>
        </td>
      </tr>
      <tr>
        <td class="box">
          <p class="box-title">3. ความเห็นของรองผู้อำนวยการ</p>
          <p class="box-line">- ตรวจสอบแล้วมีโครงการและงบประมาณ</p>
          <p class="box-line">${checkbox(data.deputy_decision === "ควร")} ควรอนุญาตและอนุมัติ</p>
          <p class="box-line">${checkbox(data.deputy_decision === "ไม่ควร")} ไม่ควรอนุญาตและอนุมัติเพราะ ${esc(
            data.deputy_note ?? "...",
          )}</p>
          <div class="box-sign">
            <div class="line">(ลงชื่อ)...................................</div>
            <div class="line">(${esc(data.signer_deputy ?? "-")})</div>
          </div>
        </td>
        <td class="box">
          <p class="box-title">4. ความเห็นของผู้อำนวยการโรงเรียน</p>
          <p class="box-line">- ตรวจสอบโครงการและงบประมาณ</p>
          <p class="box-line">${checkbox(data.status === "อนุมัติ")} อนุมัติ</p>
          <p class="box-line">${checkbox(data.status === "ไม่อนุมัติ")} ไม่อนุมัติ</p>
          <div class="box-sign">
            <div class="line">(ลงชื่อ)...................................</div>
            <div class="line">(${esc(data.signer_director ?? "-")})</div>
            <div class="line">ผู้อำนวยการโรงเรียนตาเบาวิทยา</div>
            <div class="line">วันที่ ${approvedDate.day || "........."} เดือน ${
              approvedDate.month || "........."
            } พ.ศ. ${approvedDate.year || "........."}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="page">
    <p class="page2-line">รายการวัสดุ อุปกรณ์ งาน/โครงการ ${esc(data.project_name ?? "-")}</p>
    <p class="page2-line">กิจกรรม ${esc(data.activity_name ?? "-")}</p>
    <div class="page2-header">
      <span class="item">กลุ่มสาระ/งาน ${esc(data.department ?? "-")}</span>
      <span class="item">กลุ่มงาน ${esc(data.group_name ?? "-")}</span>
      <span class="item">ปีการศึกษา ${esc(data.budget_year_text ?? "-")}</span>
    </div>

    <table class="doc-table">
      <thead>
        <tr>
          <th style="width:38%">รายการ</th>
          <th style="width:14%">จำนวน (หน่วย)</th>
          <th style="width:16%">ราคา/หน่วย</th>
          <th style="width:16%">จำนวนเงิน</th>
          <th style="width:16%">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${
          data.items.length > 0
            ? `<tr class="total-row"><td colspan="3" class="tr">รวมทั้งสิ้น</td><td class="tr">${esc(
                formatBaht(itemsGrandTotal),
              )}</td><td></td></tr>`
            : ""
        }
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
