import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { formatThaiDate } from "@/lib/thai";
import { AssetAuditReportDocument, type AssetAuditReportPdfData } from "./asset-audit-report-document";

const RESULT_LABEL: Record<string, string> = {
  diff: "พบสภาพต่างจากบัญชี",
  notFound: "ตรวจไม่พบ",
};

// ตัดคำเองเป็น string สั้นพอดี 1 บรรทัดก่อนส่งเข้า PDF แทนการพึ่ง maxLines/textOverflow ของ react-pdf
// (เจอบั๊กจริง: ข้อความไทยยาวเกินคอลัมน์กลับหายไปทั้งเซลล์แทนที่จะตัดคำ ดู asset-audit-report-document.tsx)
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export async function buildAssetAuditReportPdfData(
  supabase: SupabaseClient<Database>,
  roundId: string,
): Promise<AssetAuditReportPdfData | null> {
  const [{ data: round }, { data: inspectors }, { data: auditItems }, { data: conditions }, { data: schoolSettings }] = await Promise.all([
    supabase.from("asset_audit_rounds").select("*").eq("id", roundId).maybeSingle(),
    supabase.from("asset_audit_inspectors").select("full_name_snapshot").eq("audit_round_id", roundId).order("sort_order"),
    supabase.from("asset_audit_items").select("item_id, book_condition_id, found, actual_condition_id, note").eq("audit_round_id", roundId),
    supabase.from("asset_conditions").select("id, name"),
    supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle(),
  ]);

  if (!round) return null;

  console.log(
    "[audit-pdf-debug]",
    roundId,
    "auditItems.length =",
    auditItems?.length,
    JSON.stringify((auditItems ?? []).map((r) => ({ item_id: r.item_id, found: r.found, actual: r.actual_condition_id, book: r.book_condition_id }))),
  );

  const conditionLookup = new Map((conditions ?? []).map((c) => [c.id, c.name]));

  const itemIds = (auditItems ?? []).map((r) => r.item_id);
  const { data: assetItems } =
    itemIds.length > 0 ? await supabase.from("asset_items").select("id, name, asset_code").in("id", itemIds) : { data: [] };
  const assetItemLookup = new Map((assetItems ?? []).map((it) => [it.id, it]));

  let match = 0;
  let diff = 0;
  let notFound = 0;
  let pending = 0;
  const diffRows: AssetAuditReportPdfData["diff_rows"] = [];

  (auditItems ?? []).forEach((r) => {
    let resultKey: "match" | "diff" | "notFound" | "pending";
    if (r.found === null) resultKey = "pending";
    else if (r.found === false) resultKey = "notFound";
    else if (r.actual_condition_id !== r.book_condition_id) resultKey = "diff";
    else resultKey = "match";

    if (resultKey === "match") match++;
    else if (resultKey === "pending") pending++;
    else {
      if (resultKey === "diff") diff++;
      else notFound++;
      const it = assetItemLookup.get(r.item_id);
      diffRows.push({
        seq: diffRows.length + 1,
        name: truncate(it?.name ?? "-", 16),
        // รหัสครุภัณฑ์เป็นข้อมูลระบุตัวตนสำคัญของรายงานตรวจสอบ ไม่ตัดคำทิ้ง — ปล่อยให้ขึ้นบรรทัดใหม่ได้
        // ตามปกติแทน (คอลัมน์นี้ทดสอบแล้วว่าขึ้นบรรทัดใหม่ได้ปลอดภัย ไม่ชนบั๊กทับซ้อนแบบ maxLines)
        assetCode: it?.asset_code ?? null,
        bookConditionName: truncate(conditionLookup.get(r.book_condition_id) ?? "-", 14),
        resultLabel: truncate(RESULT_LABEL[resultKey], 16),
        note: r.note,
      });
    }
  });

  return {
    school_name: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
    fiscal_year: round.fiscal_year,
    appointment_doc_ref: round.appointment_doc_ref,
    appointment_date: round.appointment_date ? formatThaiDate(round.appointment_date) : null,
    start_date: formatThaiDate(round.start_date),
    due_date: formatThaiDate(round.due_date),
    inspector_names: (inspectors ?? []).map((i) => i.full_name_snapshot),
    total: (auditItems ?? []).length,
    match,
    diff,
    not_found: notFound,
    pending,
    report_note: round.report_note,
    diff_rows: diffRows,
  };
}

export async function renderAssetAuditReportPdfBuffer(data: AssetAuditReportPdfData): Promise<Buffer> {
  return renderToBuffer(<AssetAuditReportDocument data={data} />);
}
