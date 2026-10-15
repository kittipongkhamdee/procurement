import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import type { ProcurementRegisterRow } from "@/lib/procurement-register";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// ทะเบียนคุมจัดซื้อจัดจ้าง (A4 แนวนอน) — TH Sarabun New 16pt หัวเรื่อง 20pt แบบเดียวกับทะเบียนสัญญา

registerThSarabunFont();
const FS = 16;

const styles = StyleSheet.create({
  page: { fontFamily: "THSarabunNew", fontSize: FS, padding: 28, lineHeight: 1.15 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", lineHeight: 1.3, marginBottom: 2 },
  sub: { textAlign: "center", lineHeight: 1.3, marginBottom: 10 },
  table: { borderTopWidth: 0.8, borderLeftWidth: 0.8, marginBottom: 4 },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 0.8, borderBottomWidth: 0.8, paddingHorizontal: 4, paddingVertical: 2 },
  head: { fontWeight: "bold", backgroundColor: "#f1f5f9", textAlign: "center" },
});

const COLS = [
  { key: "no", label: "ที่", width: 26, align: "center" as const },
  { key: "type", label: "ประเภท", width: 44, align: "center" as const },
  { key: "docNo", label: "เลขที่", width: 56 },
  { key: "recordDate", label: "วันที่รายงาน", width: 84 },
  { key: "item", label: "รายการ", width: 142, wrap: true },
  { key: "vendor", label: "ผู้ขาย/ผู้รับจ้าง", width: 110, wrap: true },
  { key: "approval", label: "บันทึกขออนุมัติ", width: 84 },
  { key: "orderDate", label: "วันสั่งซื้อ/จ้าง", width: 84 },
  { key: "inspected", label: "วันตรวจรับ", width: 84 },
  { key: "amount", label: "จำนวนเงิน (บาท)", width: 72, align: "right" as const },
];

export function ProcurementRegisterDocument({ rows, schoolName, year }: { rows: ProcurementRegisterRow[]; schoolName: string; year: number | null }) {
  const cellLines = (text: string, width: number) =>
    wrapByWidth(text, FS, width - 12, width - 12, false, "THSarabunNew", text.split(/\s+/).filter((w) => w.length <= 12));
  return (
    <Document title="ทะเบียนคุมจัดซื้อจัดจ้าง">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{t(`ทะเบียนคุมการจัดซื้อจัดจ้าง ${schoolName}`)}</Text>
        {year ? <Text style={styles.sub}>{t(`ปีงบประมาณ ${year}`)}</Text> : <View style={{ marginBottom: 8 }} />}
        <View style={styles.table}>
          <View style={styles.row} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.cell, styles.head, { width: c.width }]}>
                {t(c.label)}
              </Text>
            ))}
          </View>
          {rows.map((r, i) => {
            const values: Record<string, string> = {
              no: String(i + 1),
              type: r.doc_type,
              docNo: r.doc_no,
              recordDate: formatThaiDate(r.record_date),
              item: r.item_name ?? "-",
              vendor: r.vendor_name ?? "-",
              approval: r.approval_no ?? "-",
              orderDate: formatThaiDate(r.order_date ?? r.record_date),
              inspected: r.inspected_date ? formatThaiDate(r.inspected_date) : "-",
              amount: formatBaht(r.amount),
            };
            return (
              <View key={r.id} style={styles.row} wrap={false}>
                {COLS.map((c) =>
                  "wrap" in c ? (
                    <View key={c.key} style={[styles.cell, { width: c.width }]}>
                      {cellLines(values[c.key], c.width).map((l, j) => (
                        <Text key={j}>{t(l)}</Text>
                      ))}
                    </View>
                  ) : (
                    <Text key={c.key} style={[styles.cell, { width: c.width, textAlign: c.align ?? "left" }]}>
                      {t(values[c.key])}
                    </Text>
                  ),
                )}
              </View>
            );
          })}
          {rows.length === 0 && (
            <View style={styles.row}>
              <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ไม่มีรายการ")}</Text>
            </View>
          )}
        </View>
        <Text
          style={{ position: "absolute", bottom: 14, right: 28, fontSize: 12, color: "#64748b" }}
          render={({ pageNumber, totalPages }) => `หน้า ${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
