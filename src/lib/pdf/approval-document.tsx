import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { registerSarabunFont, t, wrapText } from "./thai-pdf";

registerSarabunFont();

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 11,
    padding: 40,
    color: "#111827",
  },
  center: { textAlign: "center" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 90 },
  value: { flex: 1, paddingRight: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  paragraph: { marginBottom: 4, lineHeight: 1.5, paddingRight: 24 },
  summaryTable: { marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: "#111827" },
  summaryRow: { flexDirection: "row" },
  summaryLabel: {
    flex: 3,
    fontSize: 10,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  summaryValue: {
    flex: 1,
    fontSize: 10,
    padding: 4,
    textAlign: "right",
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#111827" },
  tr: { flexDirection: "row" },
  th: {
    fontWeight: "bold",
    fontSize: 10,
    padding: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    textAlign: "center",
  },
  td: {
    fontSize: 10,
    padding: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  colNo: { width: "6%" },
  colName: { width: "40%" },
  colQty: { width: "12%", textAlign: "center" },
  colUnit: { width: "12%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right", borderRightWidth: 0 },
  signBlock: { marginTop: 36, alignItems: "center", width: "45%", alignSelf: "center" },
  signLine: { marginBottom: 4 },
});

function Paragraph({ text }: { text: string }) {
  return (
    <>
      {wrapText(text).map((line, i) => (
        <Text key={i} style={styles.paragraph}>
          {t(line)}
        </Text>
      ))}
    </>
  );
}

export type ApprovalPdfData = {
  doc_date: string;
  subject: string;
  addressed_to: string;
  project_name: string | null;
  fund_type: string | null;
  budget: number | null;
  paid: number | null;
  requested_amount: number;
  remaining: number | null;
  requested_by_name: string | null;
  requested_by_position: string | null;
  items: { seq: number; name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null }[];
};

export function ApprovalDocument({ data }: { data: ApprovalPdfData }) {
  const grandTotal = data.items.reduce((sum, i) => sum + (i.total ?? 0), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("บันทึกข้อความ")}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t("ส่วนราชการ")}</Text>
          <Text style={styles.value}>{t("โรงเรียนตาเบาวิทยา")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("วันที่")}</Text>
          <Text style={styles.value}>{t(formatThaiDate(data.doc_date))}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("เรื่อง")}</Text>
          <Text style={styles.value}>{t(data.subject)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("เรียน")}</Text>
          <Text style={styles.value}>{t(data.addressed_to)}</Text>
        </View>

        <View style={styles.hr} />

        <Paragraph
          text={`ด้วยข้าพเจ้ามีความประสงค์จะขออนุมัติใช้งบประมาณตามโครงการ ${
            data.project_name ?? "-"
          } ประเภทเงิน ${data.fund_type ?? "-"} เป็นจำนวนเงิน ${formatBaht(
            data.requested_amount,
          )} บาท ${thaiBahtText(data.requested_amount)}`}
        />

        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("งบประมาณทั้งหมด")}</Text>
            <Text style={styles.summaryValue}>{data.budget != null ? formatBaht(data.budget) : "-"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t("เบิกจ่ายไปแล้ว")}</Text>
            <Text style={styles.summaryValue}>{data.paid != null ? formatBaht(data.paid) : "-"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: "bold" }]}>{t("ขออนุมัติครั้งนี้")}</Text>
            <Text style={[styles.summaryValue, { fontWeight: "bold", color: "#dc2626" }]}>
              {formatBaht(data.requested_amount)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { borderBottomWidth: 0, fontWeight: "bold" }]}>
              {t("คงเหลือสุทธิ")}
            </Text>
            <Text style={[styles.summaryValue, { borderBottomWidth: 0, fontWeight: "bold", color: "#059669" }]}>
              {data.remaining != null ? formatBaht(data.remaining) : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colNo]}>{t("ลำดับ")}</Text>
            <Text style={[styles.th, styles.colName]}>{t("ชื่อรายการ")}</Text>
            <Text style={[styles.th, styles.colQty]}>{t("จำนวน")}</Text>
            <Text style={[styles.th, styles.colUnit]}>{t("หน่วยนับ")}</Text>
            <Text style={[styles.th, styles.colPrice]}>{t("ราคา/หน่วย")}</Text>
            <Text style={[styles.th, styles.colTotal, { borderRightWidth: 0 }]}>{t("ราคารวม")}</Text>
          </View>
          {data.items.map((item) => (
            <View style={styles.tr} key={item.seq}>
              <Text style={[styles.td, styles.colNo, { textAlign: "center" }]}>{item.seq}</Text>
              <Text style={[styles.td, styles.colName]}>{t(item.name)}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.qty ?? ""}</Text>
              <Text style={[styles.td, styles.colUnit]}>{t(item.unit)}</Text>
              <Text style={[styles.td, styles.colPrice]}>
                {item.unit_price != null ? formatBaht(item.unit_price) : ""}
              </Text>
              <Text style={[styles.td, styles.colTotal]}>
                {item.total != null ? formatBaht(item.total) : ""}
              </Text>
            </View>
          ))}
          {data.items.length > 0 && (
            <View style={styles.tr}>
              <Text style={[styles.td, { width: "85%", textAlign: "right", fontWeight: "bold" }]}>
                {t("รวมทั้งหมด")}
              </Text>
              <Text style={[styles.td, styles.colTotal, { fontWeight: "bold" }]}>
                {formatBaht(grandTotal)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.signBlock}>
          <Text style={styles.signLine}>ลงชื่อ...........................................</Text>
          <Text style={styles.signLine}>
            {t(`(${data.requested_by_name ?? "..........................................."})`)}
          </Text>
          <Text>{t(data.requested_by_position || "ผู้ขออนุมัติ")}</Text>
        </View>
      </Page>
    </Document>
  );
}
