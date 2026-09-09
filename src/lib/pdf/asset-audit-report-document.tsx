import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

// ฟอนต์/ระยะห่างตามมาตรฐาน CLAUDE.md (อ้างอิง project-report-document.tsx): เนื้อหา 11pt, หัวเรื่องใหญ่
// 14pt, หัวข้อย่อย 11pt, row marginBottom 4, subtitle marginTop 6/marginBottom 4
const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 11, padding: 32, color: "#111827" },
  center: { textAlign: "center" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 140 },
  value: { flex: 1 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  table: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#111827" },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  tRow: { flexDirection: "row" },
  cell: { fontSize: 11, padding: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  cellLast: { fontSize: 11, padding: 4, borderBottomWidth: 1, borderColor: "#111827" },
  headLine: { fontSize: 11, fontWeight: "bold", textAlign: "center" },
  // 3+22+10+13+13+39 = 100
  colSeq: { width: "3%", textAlign: "center" },
  colName: { width: "22%" },
  colCode: { width: "10%" },
  colBook: { width: "13%", textAlign: "center" },
  colResult: { width: "13%", textAlign: "center" },
  colNote: { width: "39%" },
  signRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 40 },
  signBox: { width: "45%", textAlign: "center" },
  signLine: { marginBottom: 4 },
});

export type AssetAuditReportRow = {
  seq: number;
  name: string;
  assetCode: string | null;
  bookConditionName: string;
  resultLabel: string;
  note: string | null;
};

export type AssetAuditReportPdfData = {
  school_name: string;
  fiscal_year: number;
  appointment_doc_ref: string | null;
  appointment_date: string | null;
  start_date: string;
  due_date: string;
  inspector_names: string[];
  total: number;
  match: number;
  diff: number;
  not_found: number;
  pending: number;
  report_note: string | null;
  diff_rows: AssetAuditReportRow[];
};

function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

export function AssetAuditReportDocument({ data }: { data: AssetAuditReportPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{guard(`รายงานผลการตรวจสอบพัสดุประจำปีงบประมาณ พ.ศ. ${data.fiscal_year}`)}</Text>
          <Text>{guard(data.school_name)}</Text>
        </View>

        <Text style={styles.subtitle}>{guard("ข้อมูลการตรวจสอบ")}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{guard("เลขที่คำสั่งแต่งตั้ง")}</Text>
          <Text style={styles.value}>{guard(data.appointment_doc_ref ?? "-")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{guard("วันเริ่มตรวจสอบ")}</Text>
          <Text style={styles.value}>{guard(data.start_date)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{guard("วันครบกำหนดรายงาน")}</Text>
          <Text style={styles.value}>{guard(data.due_date)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{guard("คณะผู้ตรวจสอบ")}</Text>
          <Text style={styles.value}>{guard(data.inspector_names.join(", ") || "-")}</Text>
        </View>

        <Text style={styles.subtitle}>{guard("สรุปผลการตรวจนับ")}</Text>
        <View style={styles.row}>
          <Text style={styles.value}>
            {guard(
              `ตรวจนับทั้งหมด ${data.total} รายการ — พบตรงบัญชี ${data.match} รายการ, สภาพต่างจากบัญชี ${data.diff} รายการ, ตรวจไม่พบ ${data.not_found} รายการ, ยังไม่ตรวจ ${data.pending} รายการ`,
            )}
          </Text>
        </View>

        {data.diff_rows.length > 0 && (
          <>
            <Text style={styles.subtitle}>{guard("รายการที่มีผลต่างจากบัญชี")}</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow} fixed>
                <Text style={[styles.cell, styles.colSeq, styles.headLine]}>{guard("ลำดับ")}</Text>
                <Text style={[styles.cell, styles.colName, styles.headLine]}>{guard("รายการ")}</Text>
                <Text style={[styles.cell, styles.colCode, styles.headLine]}>{guard("รหัสครุภัณฑ์")}</Text>
                <Text style={[styles.cell, styles.colBook, styles.headLine]}>{guard("สภาพตามบัญชี")}</Text>
                <Text style={[styles.cell, styles.colResult, styles.headLine]}>{guard("ผลตรวจนับ")}</Text>
                <Text style={[styles.cellLast, styles.colNote, styles.headLine]}>{guard("หมายเหตุ")}</Text>
              </View>
              {data.diff_rows.map((row) => (
                <View style={styles.tRow} key={row.seq}>
                  <Text style={[styles.cell, styles.colSeq]}>{guard(row.seq)}</Text>
                  <Text style={[styles.cell, styles.colName]}>{guard(row.name)}</Text>
                  <Text style={[styles.cell, styles.colCode]}>{guard(row.assetCode ?? "ยังไม่ติดป้าย")}</Text>
                  <Text style={[styles.cell, styles.colBook]}>{guard(row.bookConditionName)}</Text>
                  <Text style={[styles.cell, styles.colResult]}>{guard(row.resultLabel)}</Text>
                  <Text style={[styles.cellLast, styles.colNote]}>{guard(row.note ?? "-")}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.subtitle}>{guard("สรุปผล/ข้อเสนอแนะ")}</Text>
        <Text>{guard(data.report_note ?? "-")}</Text>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLine}>{guard("ลงชื่อ ...................................................")}</Text>
            <Text>{guard("ผู้ตรวจสอบพัสดุ")}</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLine}>{guard("ลงชื่อ ...................................................")}</Text>
            <Text>{guard("หัวหน้าหน่วยงาน")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
