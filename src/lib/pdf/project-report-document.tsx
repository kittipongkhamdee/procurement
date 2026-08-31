import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
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
  subtitle: { fontSize: 13, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 130 },
  value: { flex: 1, paddingRight: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  // paddingRight leaves slack against a reproducible @react-pdf/renderer bug where a
  // wrapped line's last 1-2 glyphs get clipped instead of wrapped — see thai-pdf.ts.
  paragraph: { marginBottom: 4, lineHeight: 1.5, paddingRight: 24 },
  bulletRow: { flexDirection: "row", marginBottom: 2, paddingRight: 24 },
  bulletMark: { width: 14 },
  bulletText: { flex: 1, lineHeight: 1.5 },
  budgetTable: { marginTop: 4, borderWidth: 1, borderColor: "#111827" },
  budgetRow: { flexDirection: "row" },
  budgetLabel: {
    fontSize: 10,
    padding: 4,
    width: "50%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  budgetValue: {
    fontSize: 10,
    padding: 4,
    width: "50%",
    textAlign: "right",
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  signBlock: { marginTop: 40, alignItems: "center", alignSelf: "flex-end", width: "50%" },
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

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) =>
        wrapText(item).map((line, j) => (
          <View style={styles.bulletRow} key={`${i}-${j}`}>
            <Text style={styles.bulletMark}>{j === 0 ? t(`${i + 1}.`) : ""}</Text>
            <Text style={styles.bulletText}>{t(line)}</Text>
          </View>
        )),
      )}
    </>
  );
}

export type ProjectReportPdfData = {
  project_name: string | null;
  responsible_name: string | null;
  period_start: string | null;
  period_end: string | null;
  background: string | null;
  objectives: string[];
  quantity_goal: string | null;
  quantity_actual: string | null;
  quality_result: string | null;
  satisfaction_percent: number | null;
  budget_approved: number | null;
  budget_used: number | null;
  highlights: string | null;
  problems: string | null;
  recommendations: string | null;
  reporter_name: string | null;
};

export function ProjectReportDocument({ data }: { data: ProjectReportPdfData }) {
  const budgetRemaining =
    data.budget_approved != null && data.budget_used != null ? data.budget_approved - data.budget_used : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("รายงานสรุปโครงการ")}</Text>
          <Text>{t("โรงเรียนตาเบาวิทยา")}</Text>
        </View>

        <View style={styles.hr} />

        <Text style={styles.subtitle}>{t("1. ส่วนหัวรายงาน")}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{t("ชื่อโครงการ")}</Text>
          <Text style={styles.value}>{t(data.project_name)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("ผู้รับผิดชอบโครงการ")}</Text>
          <Text style={styles.value}>{t(data.responsible_name)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("ระยะเวลาดำเนินงาน")}</Text>
          <Text style={styles.value}>
            {t(
              data.period_start
                ? `${formatThaiDate(data.period_start)} - ${formatThaiDate(data.period_end ?? data.period_start)}`
                : "-",
            )}
          </Text>
        </View>

        <Text style={styles.subtitle}>{t("2. หลักการและวัตถุประสงค์")}</Text>
        {data.background && <Paragraph text={`ความเป็นมา: ${data.background}`} />}
        {data.objectives.length > 0 && (
          <>
            <Text style={{ marginTop: 2, marginBottom: 2 }}>{t("วัตถุประสงค์")}</Text>
            <Bullets items={data.objectives} />
          </>
        )}

        <Text style={styles.subtitle}>{t("3. ผลการดำเนินงานโครงการ")}</Text>
        {(data.quantity_goal || data.quantity_actual) && (
          <Paragraph
            text={`เชิงปริมาณ: เป้าหมาย ${data.quantity_goal ?? "-"} ผลที่ทำได้จริง ${data.quantity_actual ?? "-"}`}
          />
        )}
        {data.quality_result && <Paragraph text={`เชิงคุณภาพ: ${data.quality_result}`} />}
        {data.satisfaction_percent != null && (
          <Paragraph text={`ผลการประเมินความพึงพอใจ: ร้อยละ ${data.satisfaction_percent}`} />
        )}
        <View style={styles.budgetTable}>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>{t("งบประมาณที่ได้รับอนุมัติ")}</Text>
            <Text style={styles.budgetValue}>
              {data.budget_approved != null ? `${formatBaht(data.budget_approved)} บาท` : "-"}
            </Text>
          </View>
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>{t("งบประมาณที่ใช้ไปจริง")}</Text>
            <Text style={styles.budgetValue}>{data.budget_used != null ? `${formatBaht(data.budget_used)} บาท` : "-"}</Text>
          </View>
          <View style={[styles.budgetRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.budgetLabel, { fontWeight: "bold" }]}>{t("คงเหลือ")}</Text>
            <Text style={[styles.budgetValue, { fontWeight: "bold" }]}>
              {budgetRemaining != null ? `${formatBaht(budgetRemaining)} บาท` : "-"}
            </Text>
          </View>
        </View>

        <Text style={styles.subtitle}>{t("4. สรุปภาพรวมและข้อเสนอแนะ")}</Text>
        {data.highlights && <Paragraph text={`จุดเด่น/ประสบความสำเร็จ: ${data.highlights}`} />}
        {data.problems && <Paragraph text={`ปัญหาและอุปสรรค: ${data.problems}`} />}
        {data.recommendations && <Paragraph text={`ข้อเสนอแนะในการปรับปรุงครั้งต่อไป: ${data.recommendations}`} />}

        <Text style={styles.subtitle}>{t("5. ส่วนท้าย (ลงนาม)")}</Text>
        <View style={styles.signBlock}>
          <Text style={styles.signLine}>ลงชื่อ...........................................</Text>
          <Text style={styles.signLine}>{t(`(${data.reporter_name ?? "..........................................."})`)}</Text>
          <Text>{t("ผู้รายงาน")}</Text>
        </View>
      </Page>
    </Document>
  );
}
