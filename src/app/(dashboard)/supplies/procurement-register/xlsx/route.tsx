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
      { header: "ประเภท", key: "type", width: 8 },
      { header: "เลขที่", key: "docNo", width: 10 },
      { header: "วันที่รายงาน", key: "recordDate", width: 18 },
      { header: "รายการ", key: "item", width: 40 },
      { header: "ผู้ขาย/ผู้รับจ้าง", key: "vendor", width: 30 },
      { header: "โครงการ", key: "project", width: 36 },
      { header: "บันทึกขออนุมัติ", key: "approval", width: 14 },
      { header: "วันสั่งซื้อ/จ้าง", key: "orderDate", width: 18 },
      { header: "วันตรวจรับ", key: "inspected", width: 18 },
      { header: "จำนวนเงิน (บาท)", key: "amount", width: 16, numFmt: "#,##0.00" },
      { header: "รูปอ้างอิง", key: "photos", width: 10 },
    ],
    filtered.map((r, i) => ({
      no: i + 1,
      type: r.doc_type,
      docNo: r.doc_no,
      recordDate: formatThaiDate(r.record_date),
      item: r.item_name ?? "-",
      vendor: r.vendor_name ?? "-",
      project: r.project_name ?? "-",
      approval: r.approval_no ?? "-",
      orderDate: formatThaiDate(r.order_date ?? r.record_date),
      inspected: r.inspected_date ? formatThaiDate(r.inspected_date) : "-",
      amount: r.amount,
      photos: r.photo_count,
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
