import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExcelBuffer } from "@/lib/excel";
import { contentDisposition } from "@/lib/http";
import { CONDITION_LABEL, STATUS_LABEL, fetchAssetItemsForExport } from "@/lib/asset-register-export";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();

  const rows = await fetchAssetItemsForExport(supabase, {
    roundId: url.searchParams.get("round") ?? undefined,
    categoryId: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    condition: url.searchParams.get("condition") ?? undefined,
    search: url.searchParams.get("q") ?? undefined,
  });

  const buffer = await buildExcelBuffer(
    "จัดการทรัพย์สิน",
    [
      { header: "รหัสครุภัณฑ์", key: "assetCode", width: 22 },
      { header: "ชื่อทรัพย์สิน", key: "name", width: 30 },
      { header: "หมวดหมู่", key: "categoryName", width: 18 },
      { header: "สถานที่", key: "location", width: 22 },
      { header: "จำนวน", key: "quantity", width: 10 },
      { header: "หน่วย", key: "unit", width: 10 },
      { header: "ราคา (บาท)", key: "price", width: 14, numFmt: "#,##0.00" },
      { header: "สภาพ", key: "condition", width: 12 },
      { header: "สถานะ", key: "status", width: 12 },
    ],
    rows.map((r) => ({
      assetCode: r.assetCode ?? "ยังไม่ติดป้าย",
      name: r.name,
      categoryName: r.categoryName ?? "-",
      location: r.location,
      quantity: r.quantity,
      unit: r.unit ?? "-",
      price: r.price,
      condition: CONDITION_LABEL[r.condition] ?? r.condition,
      status: STATUS_LABEL[r.status] ?? r.status,
    })),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("attachment", "จัดการทรัพย์สิน.xlsx"),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
