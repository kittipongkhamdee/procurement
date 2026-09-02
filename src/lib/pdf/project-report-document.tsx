import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
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
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  subtitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 6,
    marginBottom: 4,
  },
  subheading: { fontWeight: "bold", marginTop: 4, marginBottom: 2 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 130 },
  value: { flex: 1, paddingRight: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  // paddingRight leaves slack against a reproducible @react-pdf/renderer bug where a
  // wrapped line's last 1-2 glyphs get clipped instead of wrapped — see thai-pdf.ts.
  // marginBottom lives on paragraphBlock (once per paragraph), not here — putting it on
  // every wrapped line stacked with lineHeight made multi-line paragraphs look double-spaced.
  paragraphBlock: { marginBottom: 4 },
  paragraph: { lineHeight: 1.2, paddingRight: 24 },
  bulletRow: { flexDirection: "row", marginBottom: 2, paddingRight: 24 },
  bulletMark: { width: 14 },
  bulletText: { flex: 1, lineHeight: 1.2 },
  budgetTable: { marginTop: 4, borderWidth: 1, borderColor: "#111827" },
  budgetRow: { flexDirection: "row" },
  budgetLabel: {
    fontSize: 11,
    padding: 4,
    width: "50%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  budgetValue: {
    fontSize: 11,
    padding: 4,
    width: "50%",
    textAlign: "right",
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  indicatorTable: {
    marginTop: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#111827",
  },
  indicatorHeaderRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  indicatorRow: { flexDirection: "row" },
  indicatorCellIndicator: {
    fontSize: 11,
    padding: 4,
    width: "50%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  indicatorCellTarget: {
    fontSize: 11,
    padding: 4,
    width: "25%",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  indicatorCellActual: {
    fontSize: 11,
    padding: 4,
    width: "25%",
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
    <View style={styles.paragraphBlock}>
      {wrapText(text).map((line, i) => (
        <Text key={i} style={styles.paragraph}>
          {t(line)}
        </Text>
      ))}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) =>
        wrapText(item).map((line, j) => (
          <View style={styles.bulletRow} key={`${i}-${j}`}>
            <Text style={styles.bulletMark}>
              {j === 0 ? t(`${i + 1}.`) : ""}
            </Text>
            <Text style={styles.bulletText}>{t(line)}</Text>
          </View>
        )),
      )}
    </>
  );
}

function BulletSection({
  heading,
  items,
}: {
  heading: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.subheading}>{t(heading)}</Text>
      <Bullets items={items} />
    </>
  );
}

export type IndicatorResult = {
  indicator: string;
  target: string;
  actual: string;
};

function IndicatorTable({
  heading,
  rows,
}: {
  heading: string;
  rows: IndicatorResult[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <Text style={styles.subheading}>{t(heading)}</Text>
      <View style={styles.indicatorTable}>
        <View style={styles.indicatorHeaderRow}>
          <Text style={[styles.indicatorCellIndicator, { fontWeight: "bold" }]}>
            {t("ตัวชี้วัด")}
          </Text>
          <Text style={[styles.indicatorCellTarget, { fontWeight: "bold" }]}>
            {t("ค่าเป้าหมาย")}
          </Text>
          <Text style={[styles.indicatorCellActual, { fontWeight: "bold" }]}>
            {t("ผลการดำเนินงาน")}
          </Text>
        </View>
        {rows.map((row, i) => (
          <View style={styles.indicatorRow} key={i}>
            <Text style={styles.indicatorCellIndicator}>
              {t(row.indicator)}
            </Text>
            <Text style={styles.indicatorCellTarget}>
              {t(row.target || "-")}
            </Text>
            <Text style={styles.indicatorCellActual}>
              {t(row.actual || "-")}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

export type ProjectReportPhoto = { data: Buffer; format: "png" | "jpg" };

export type ProjectReportPdfData = {
  project_name: string | null;
  not_implemented: boolean;
  not_implemented_reason: string | null;
  strategy_alignment: string | null;
  standard: string | null;
  responsible_name: string | null;
  period_start: string | null;
  period_end: string | null;
  location: string | null;
  background: string | null;
  objectives: string[];
  activities_done: string[];
  indicator_results_quantity: IndicatorResult[];
  indicator_results_quality: IndicatorResult[];
  satisfaction_percent: number | null;
  /** คำนวณสดจากคำตอบแบบ Likert ของแบบประเมินออนไลน์ที่ผูกกับโครงการนี้ (ไม่ได้เก็บไว้ในฐานข้อมูล
   * จึงอาจไม่ตรงกับ satisfaction_percent เป๊ะๆ ถ้าครูแก้ตัวเลขร้อยละเองหลังดึงมาแล้ว) */
  satisfaction_survey_summary: { avg: number; sd: number; count: number; label: string | null } | null;
  budget_approved: number | null;
  budget_used: number | null;
  highlights: string[];
  problems: string[];
  recommendations: string[];
  photos: ProjectReportPhoto[];
};

export function ProjectReportDocument({
  data,
}: {
  data: ProjectReportPdfData;
}) {
  const budgetRemaining =
    data.budget_approved != null && data.budget_used != null
      ? data.budget_approved - data.budget_used
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("รายงานสรุปโครงการ")}</Text>
          <Text>{t("โรงเรียนตาเบาวิทยา")}</Text>
        </View>

        <View style={styles.hr} />

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

        {data.not_implemented ? (
          <>
            <Text style={styles.subtitle}>{t("ผลการดำเนินงาน")}</Text>
            <Paragraph text="ไม่ได้ดำเนินการโครงการนี้" />
            {data.not_implemented_reason && (
              <Paragraph text={`เหตุผล: ${data.not_implemented_reason}`} />
            )}
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {t("1. หลักการและวัตถุประสงค์")}
            </Text>
            {data.background && (
              <Paragraph text={`ความเป็นมา: ${data.background}`} />
            )}
            {data.objectives.length > 0 && (
              <>
                <Text style={{ marginTop: 2, marginBottom: 2 }}>
                  {t("วัตถุประสงค์")}
                </Text>
                <Bullets items={data.objectives} />
              </>
            )}

            <Text style={styles.subtitle}>{t("2. ผลการดำเนินงานโครงการ")}</Text>
            <BulletSection
              heading="สรุปการดำเนินงาน/กิจกรรมที่ทำจริง"
              items={data.activities_done}
            />
            <IndicatorTable
              heading="ตัวชี้วัดเชิงปริมาณ"
              rows={data.indicator_results_quantity}
            />
            <IndicatorTable
              heading="ตัวชี้วัดเชิงคุณภาพ"
              rows={data.indicator_results_quality}
            />
            {data.satisfaction_percent != null && (
              <Paragraph
                text={`ผลการประเมินความพึงพอใจ: ร้อยละ ${data.satisfaction_percent}`}
              />
            )}
            {data.satisfaction_survey_summary && (
              <Paragraph
                text={`ข้อมูลจากแบบประเมินออนไลน์: ค่าเฉลี่ย ${data.satisfaction_survey_summary.avg.toFixed(2)}/5.00 (S.D. ${data.satisfaction_survey_summary.sd.toFixed(2)}) จาก ${data.satisfaction_survey_summary.count} คำตอบ${data.satisfaction_survey_summary.label ? ` — ระดับ: ${data.satisfaction_survey_summary.label}` : ""}`}
              />
            )}
            <View style={styles.budgetTable}>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>
                  {t("งบประมาณที่ได้รับอนุมัติ")}
                </Text>
                <Text style={styles.budgetValue}>
                  {data.budget_approved != null
                    ? `${formatBaht(data.budget_approved)} บาท`
                    : "-"}
                </Text>
              </View>
              <View style={styles.budgetRow}>
                <Text style={styles.budgetLabel}>
                  {t("งบประมาณที่ใช้ไปจริง")}
                </Text>
                <Text style={styles.budgetValue}>
                  {data.budget_used != null
                    ? `${formatBaht(data.budget_used)} บาท`
                    : "-"}
                </Text>
              </View>
              <View style={[styles.budgetRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.budgetLabel, { fontWeight: "bold" }]}>
                  {t("คงเหลือ")}
                </Text>
                <Text style={[styles.budgetValue, { fontWeight: "bold" }]}>
                  {budgetRemaining != null
                    ? `${formatBaht(budgetRemaining)} บาท`
                    : "-"}
                </Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              {t("3. สรุปภาพรวมและข้อเสนอแนะ")}
            </Text>
            <BulletSection
              heading="จุดเด่น / ประสบความสำเร็จ"
              items={data.highlights}
            />
            <BulletSection heading="ปัญหาและอุปสรรค" items={data.problems} />
            <BulletSection
              heading="ข้อเสนอแนะในการปรับปรุงครั้งต่อไป"
              items={data.recommendations}
            />

            {data.photos.length > 0 && (
              // wrap={false} กันหัวข้อ "5. ภาพถ่ายกิจกรรม" ถูกทิ้งไว้ท้ายหน้าเดี่ยวๆ (orphan) และกัน
              // รูปโดนตัดครึ่งข้ามหน้า — รูปสูงสุด 4 รูป (จำกัดตอนอัปโหลด) รวมกับหัวข้อสูงไม่เกินหน้า
              // เดียวแน่นอน จึงบังคับให้ทั้งบล็อกย้ายไปทั้งก้อนถ้าที่เหลือในหน้าปัจจุบันไม่พอ
              <View wrap={false}>
                <Text style={styles.subtitle}>{t("4. ภาพถ่ายกิจกรรม")}</Text>
                <View style={styles.photoGrid}>
                  {data.photos.map((photo, i) => (
                    <View style={styles.photoCell} key={i}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF node, not an HTML <img> */}
                      <Image
                        style={styles.photoImage}
                        src={{ data: photo.data, format: photo.format }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </Page>
    </Document>
  );
}
