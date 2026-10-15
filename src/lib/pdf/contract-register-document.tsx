import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import type { ContractRegisterRow } from "@/lib/contract-register";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// ทะเบียนสัญญา (A4 แนวนอน) — ฟอนต์ TH Sarabun New 16pt (มาตรฐานเอกสารของระบบ) หัวเรื่องตัวหนา 20pt

registerThSarabunFont();
const FS = 16;
/** ตัวอักษรในตาราง 15pt (หัวเอกสาร 16/18/20pt) — แบบเดียวกับทะเบียนคุมจัดซื้อจัดจ้าง */
const FS_TABLE = 15;

const styles = StyleSheet.create({
  page: { fontFamily: "THSarabunNew", fontSize: FS, padding: 28, lineHeight: 1.15 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", lineHeight: 1.3, marginBottom: 2 },
  sub: { textAlign: "center", lineHeight: 1.3, marginBottom: 10 },
  table: { borderTopWidth: 0.8, borderLeftWidth: 0.8, marginBottom: 4, fontSize: FS_TABLE },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 0.8, borderBottomWidth: 0.8, paddingHorizontal: 4, paddingVertical: 2 },
  head: { fontWeight: "bold", backgroundColor: "#f1f5f9", textAlign: "center" },
});

const COLS = [
  { key: "no", label: "ที่", width: 26, align: "center" as const },
  { key: "type", label: "ประเภท", width: 62 },
  { key: "contractNo", label: "เลขที่สัญญา", width: 70 },
  { key: "contractDate", label: "วันที่ทำสัญญา", width: 82 },
  { key: "vendor", label: "คู่สัญญา", width: 128, wrap: true },
  { key: "project", label: "โครงการ", width: 170, wrap: true },
  { key: "source", label: "แหล่งงบประมาณ", width: 82, wrap: true },
  { key: "endDate", label: "สิ้นสุดสัญญา", width: 82 },
  { key: "amount", label: "จำนวนเงิน (บาท)", width: 84, align: "right" as const },
];

export function ContractRegisterDocument({
  rows,
  schoolName,
  educationArea,
  filterText,
}: {
  rows: ContractRegisterRow[];
  schoolName: string;
  educationArea: string | null;
  filterText: string;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const colStyle = (c: (typeof COLS)[number]) => ({ width: c.width });
  // ข้อความไทยยาว react-pdf ตัดบรรทัดเองไม่ได้ (ไม่มีช่องว่างระหว่างคำ) — ตัดล่วงหน้าตามความกว้างคอลัมน์ (หักขอบเซลล์)
  const cellLines = (text: string, width: number) =>
    wrapByWidth(text, FS_TABLE, width - 12, width - 12, false, "THSarabunNew", text.split(/\s+/).filter((w) => w.length <= 12));
  return (
    <Document title="ทะเบียนสัญญา">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{t("ทะเบียนสัญญา")}</Text>
        <Text style={{ textAlign: "center", fontSize: 18, lineHeight: 1.3 }}>{t(`${schoolName}${educationArea ? ` ${educationArea}` : ""}`)}</Text>
        <Text style={styles.sub}>{t(`${filterText ? `${filterText} · ` : ""}ข้อมูล ณ วันที่ ${formatThaiDate(today)}`)}</Text>
        <View style={styles.table}>
          <View style={styles.row} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.cell, styles.head, colStyle(c)]}>
                {t(c.label)}
              </Text>
            ))}
          </View>
          {rows.map((r, i) => {
            const values: Record<string, string> = {
              no: String(i + 1),
              type: `สัญญา${r.contract_type}`,
              contractNo: r.contract_no,
              contractDate: formatThaiDate(r.contract_date),
              vendor: r.vendor_name,
              project: r.project_name ?? "-",
              endDate: r.end_date ? formatThaiDate(r.end_date) : "-",
              source: r.budget_source_name ?? "-",
              amount: formatBaht(r.amount),
            };
            return (
              <View key={i} style={styles.row} wrap={false}>
                {COLS.map((c) =>
                  "wrap" in c ? (
                    <View key={c.key} style={[styles.cell, colStyle(c)]}>
                      {cellLines(values[c.key], c.width).map((l, j) => (
                        <Text key={j}>{t(l)}</Text>
                      ))}
                    </View>
                  ) : (
                    <Text key={c.key} style={[styles.cell, colStyle(c), { textAlign: c.align ?? "left" }]}>
                      {t(values[c.key])}
                    </Text>
                  ),
                )}
              </View>
            );
          })}
          {rows.length === 0 && (
            <View style={styles.row}>
              <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ไม่มีสัญญา")}</Text>
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
