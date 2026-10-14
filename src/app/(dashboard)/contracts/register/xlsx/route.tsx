import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExcelBuffer } from "@/lib/excel";
import { contentDisposition } from "@/lib/http";
import { formatThaiDate } from "@/lib/thai";
import { contractStatusKey, fetchContractRegister, filterFromSearchParams } from "@/lib/contract-register";

export async function GET(request: Request) {
  const supabase = await createClient();
  const rows = await fetchContractRegister(supabase, filterFromSearchParams(new URL(request.url).searchParams));
  const buffer = await buildExcelBuffer(
    "ทะเบียนสัญญา",
    [
      { header: "ที่", key: "no", width: 6 },
      { header: "ประเภท", key: "type", width: 12 },
      { header: "เลขที่สัญญา", key: "contractNo", width: 14 },
      { header: "วันที่ทำสัญญา", key: "contractDate", width: 18 },
      { header: "คู่สัญญา", key: "vendor", width: 30 },
      { header: "โครงการ", key: "project", width: 40 },
      { header: "วันสิ้นสุดสัญญา", key: "endDate", width: 18 },
      { header: "สถานะ", key: "status", width: 18 },
      { header: "จำนวนเงิน (บาท)", key: "amount", width: 16, numFmt: "#,##0.00" },
    ],
    rows.map((r, i) => ({
      no: i + 1,
      type: `สัญญา${r.contract_type}`,
      contractNo: r.contract_no,
      contractDate: formatThaiDate(r.contract_date),
      vendor: r.vendor_name,
      project: r.project_name ?? "-",
      endDate: r.end_date ? formatThaiDate(r.end_date) : "-",
      status: contractStatusKey(r.end_date).label,
      amount: r.amount,
    })),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition("attachment", "ทะเบียนสัญญา.xlsx"),
    },
  });
}
