import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAssetSummaryPdfData } from "@/lib/pdf/build-asset-summary-pdf";
import { buildExcelBuffer } from "@/lib/excel";
import { contentDisposition } from "@/lib/http";

const CONDITION_LABEL: Record<string, string> = {
  usable: "ใช้งานได้",
  damaged: "ชำรุด",
  disposal: "จำหน่าย",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();

  const data = await buildAssetSummaryPdfData(supabase, {
    categoryId: url.searchParams.get("category") ?? undefined,
    condition: url.searchParams.get("condition") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });

  const buffer = await buildExcelBuffer(
    "ทะเบียนทรัพย์สิน",
    [
      { header: "ลำดับ", key: "seq", width: 8 },
      { header: "รายการ", key: "name", width: 28 },
      { header: "หมวดหมู่", key: "categoryName", width: 18 },
      { header: "หมายเลขครุภัณฑ์", key: "assetCode", width: 20 },
      { header: "จำนวน", key: "quantity", width: 10 },
      { header: "หน่วย", key: "unit", width: 10 },
      { header: "ที่ตั้ง", key: "location", width: 22 },
      { header: "สภาพ", key: "condition", width: 12 },
      { header: "ปีที่ได้มา", key: "acquiredYear", width: 10 },
      { header: "ราคาทุน (บาท)", key: "price", width: 14, numFmt: "#,##0.00" },
      { header: "อายุใช้งาน (ปี)", key: "usefulLifeYears", width: 12 },
      { header: "ค่าเสื่อม/ปี (บาท)", key: "annual", width: 16, numFmt: "#,##0.00" },
      { header: "ค่าเสื่อมสะสม (บาท)", key: "cumulative", width: 16, numFmt: "#,##0.00" },
      { header: "มูลค่าสุทธิ (บาท)", key: "net", width: 16, numFmt: "#,##0.00" },
    ],
    data.rows.map((row) => ({
      seq: row.seq,
      name: row.name,
      categoryName: row.categoryName ?? "-",
      assetCode: row.assetCode ?? "ยังไม่ติดป้าย",
      quantity: row.quantity,
      unit: row.unit ?? "-",
      location: row.location,
      condition: CONDITION_LABEL[row.condition] ?? row.condition,
      acquiredYear: row.acquiredYear ?? "-",
      price: row.price,
      usefulLifeYears: row.usefulLifeYears ?? "-",
      annual: row.annual,
      cumulative: row.cumulative,
      net: row.net,
    })),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("attachment", "ทะเบียนทรัพย์สิน.xlsx"),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
