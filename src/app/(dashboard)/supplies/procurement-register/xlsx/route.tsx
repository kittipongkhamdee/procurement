import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExcelBuffer } from "@/lib/excel";
import { contentDisposition } from "@/lib/http";
import { formatThaiDate } from "@/lib/thai";
import { applyRegisterFilter, fetchProcurementRegister, filterFromSearchParams } from "@/lib/procurement-register";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { rows } = await fetchProcurementRegister(supabase);
  const filtered = applyRegisterFilter(rows, filterFromSearchParams(new URL(request.url).searchParams));
  const buffer = await buildExcelBuffer(
    "ทะเบียนคุมจัดซื้อจัดจ้าง",
    [
      { header: "ที่", key: "no", width: 6 },
      { header: "วันที่", key: "date", width: 18 },
      { header: "เลขที่", key: "docNo", width: 12 },
      { header: "รายการซื้อ / จ้าง", key: "item", width: 40 },
      { header: "ประเภท", key: "type", width: 8 },
      { header: "วิธี", key: "method", width: 14 },
      { header: "ผู้ขาย / ผู้รับจ้าง", key: "vendor", width: 30 },
      { header: "จำนวนเงิน", key: "amount", width: 14, numFmt: "#,##0.00" },
      { header: "หัก ณ ที่จ่าย", key: "wht", width: 12, numFmt: "#,##0.00" },
      { header: "จ่ายสุทธิ", key: "net", width: 14, numFmt: "#,##0.00" },
      { header: "วันตรวจรับ", key: "inspected", width: 18 },
      { header: "สถานะ", key: "status", width: 16 },
      { header: "โครงการ", key: "project", width: 36 },
      { header: "บันทึกขออนุมัติ", key: "approval", width: 14 },
    ],
    filtered.map((r, i) => ({
      no: i + 1,
      date: formatThaiDate(r.record_date),
      docNo: `${r.doc_type === "ซื้อ" ? "ซ" : "จ"} ${r.doc_no}`,
      item: r.item_name ?? "-",
      type: r.doc_type,
      method: "เฉพาะเจาะจง",
      vendor: r.vendor_name ?? "-",
      amount: r.amount,
      wht: r.withholding,
      net: r.net,
      inspected: r.inspected_date ? formatThaiDate(r.inspected_date) : "-",
      status: r.status,
      project: r.project_name ?? "-",
      approval: r.approval_no ?? "-",
    })),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("attachment", "ทะเบียนคุมจัดซื้อจัดจ้าง.xlsx"),
    },
  });
}
