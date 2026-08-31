import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
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
  subheading: { fontWeight: "bold", marginTop: 4, marginBottom: 2 },
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
  photoGrid: { marginTop: 4, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoCell: {
    width: "47%",
    height: 190,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  // objectFit: "contain" keeps the photo's original aspect ratio, fitting it inside the
  // fixed cell without stretching or cropping — required since photos can be any shape.
  photoImage: { width: "100%", height: "100%", objectFit: "contain" },
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

function BulletSection({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.subheading}>{t(heading)}</Text>
      <Bullets items={items} />
    </>
  );
}

export type ProjectReportPhoto = { data: Buffer; format: "png" | "jpg" };

export type ProjectReportPdfData = {
  project_name: string | null;
  strategy_alignment: string | null;
  standard: string | null;
  responsible_name: string | null;
  period_start: string | null;
  period_end: string | null;
  location: string | null;
  background: string | null;
  objectives: string[];
  activities_done: string[];
  quantity_goal: string | null;
  quantity_actual: string | null;
  quality_result: string | null;
  satisfaction_percent: number | null;
  budget_approved: number | null;
  budget_used: number | null;
  highlights: string[];
  problems: string[];
  recommendations: string[];
  photos: ProjectReportPhoto[];
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
        {data.strategy_alignment && (
          <View style={styles.row}>
            <Text style={styles.label}>{t("สนองกลยุทธ์โรงเรียน")}</Text>
            <Text style={styles.value}>{t(data.strategy_alignment)}</Text>
          </View>
        )}
        {data.standard && (
          <View style={styles.row}>
            <Text style={styles.label}>{t("สอดคล้องมาตรฐานการศึกษา")}</Text>
            <Text style={styles.value}>{t(data.standard)}</Text>
          </View>
        )}
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
        <View style={styles.row}>
          <Text style={styles.label}>{t("สถานที่ดำเนินการ")}</Text>
          <Text style={styles.value}>{t(data.location)}</Text>
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
        <BulletSection heading="สรุปการดำเนินงาน/กิจกรรมที่ทำจริง" items={data.activities_done} />
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
        <BulletSection heading="จุดเด่น / ประสบความสำเร็จ" items={data.highlights} />
        <BulletSection heading="ปัญหาและอุปสรรค" items={data.problems} />
        <BulletSection heading="ข้อเสนอแนะในการปรับปรุงครั้งต่อไป" items={data.recommendations} />

        {data.photos.length > 0 && (
          <>
            <Text style={styles.subtitle}>{t("5. ภาพถ่ายกิจกรรม")}</Text>
            <View style={styles.photoGrid}>
              {data.photos.map((photo, i) => (
                <View style={styles.photoCell} key={i}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF node, not an HTML <img> */}
                  <Image style={styles.photoImage} src={{ data: photo.data, format: photo.format }} />
                </View>
              ))}
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}
