import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

/** wrapText() (thai-pdf.ts) only splits on spaces, so a long run of Thai text with no
 * spaces at all (common in project names/labels) stays as one "word" longer than the
 * column and falls back to @react-pdf/renderer's own auto-wrap — which clips the last
 * 1-2 characters of interior lines. Hard-break any overlong word at the character level
 * too so nothing is ever left for react-pdf to auto-wrap on its own. */
function wrapAny(text: string, maxChars: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let word of words) {
    while (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 11, padding: 36, color: "#111827" },
  center: { textAlign: "center" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { fontWeight: "bold", width: 150 },
  value: { flex: 1, paddingRight: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  sectionTitle: { fontWeight: "bold", fontSize: 12, marginTop: 10, marginBottom: 4 },
  paragraph: { marginBottom: 2, lineHeight: 1.5, paddingRight: 12 },
  table: { marginTop: 4, borderWidth: 1, borderColor: "#111827" },
  tr: { flexDirection: "row" },
  th: {
    fontWeight: "bold",
    fontSize: 9,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    textAlign: "center",
  },
  td: {
    fontSize: 9,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  signRow: { flexDirection: "row", marginTop: 30, justifyContent: "space-around" },
  signBlock: { alignItems: "center", width: "42%" },
  signLine: { marginBottom: 4, fontSize: 10 },
});

function Paragraph({ text }: { text: string | null | undefined }) {
  if (!text) return <Text style={styles.paragraph}>{t("-")}</Text>;
  const lines = text.split("\n").flatMap((line) => wrapAny(line, 40));
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i} style={styles.paragraph}>
          {t(line)}
        </Text>
      ))}
    </>
  );
}

/** Same clipping bug as Paragraph applies to any header value long enough to wrap — the
 * narrower value column needs a shorter wrap width than the full-page paragraph default. */
function FieldRow({ label, value }: { label: string; value: string }) {
  const lines = wrapAny(value, 28);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t(label)}</Text>
      <View style={styles.value}>
        {lines.map((line, i) => (
          <Text key={i}>{t(line)}</Text>
        ))}
      </View>
    </View>
  );
}

/** Same clipping bug again, this time for narrow table cells of free-text content. */
function CellText({ text, maxChars, bold }: { text: string; maxChars: number; bold?: boolean }) {
  const lines = wrapAny(text || "-", maxChars);
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i} style={bold ? { fontWeight: "bold" } : undefined}>
          {t(line)}
        </Text>
      ))}
    </>
  );
}

export type ProposalActivity = {
  name: string;
  period: string;
  responsible: string[];
  compensation: number;
  service: number;
  material: number;
};
export type ProposalEvaluationItem = { type: string; indicator: string; target: string; method: string; tool: string };

export type ProposalPdfData = {
  name: string;
  proposerName: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  projectType: string;
  responsible: string[];
  strategyAlignment: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  rationale: string | null;
  objectives: string | null;
  targetQuantity: string | null;
  targetQuality: string | null;
  activities: ProposalActivity[];
  budgetAmount: number;
  riskFactors: string | null;
  riskMitigation: string | null;
  evaluationItems: ProposalEvaluationItem[];
  expectedResults: string | null;
  endorsedByName: string | null;
  approvedByName: string | null;
};

export function ProposalDocument({ data }: { data: ProposalPdfData }) {
  const duration =
    data.startDate || data.endDate
      ? `${data.startDate ? formatThaiDate(data.startDate) : "-"} ถึง ${data.endDate ? formatThaiDate(data.endDate) : "-"}`
      : "-";

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.center}>
          <Text style={styles.title}>{t("แบบเสนอโครงการ")}</Text>
        </View>

        <FieldRow label="ชื่อโครงการ" value={data.name} />
        <FieldRow label="สนองกลยุทธ์โรงเรียน" value={data.strategyAlignment || "-"} />
        <FieldRow label="สอดคล้องกับมาตรฐานการศึกษา" value={data.standard || "-"} />
        <FieldRow label="กลุ่มงานที่รับผิดชอบ" value={data.adminGroup} />
        <FieldRow label="ลักษณะโครงการ" value={data.projectType} />
        <FieldRow label="ผู้รับผิดชอบโครงการ" value={data.responsible.join(", ") || data.proposerName || "-"} />
        <FieldRow label="ระยะเวลาดำเนินการ" value={duration} />
        <FieldRow label="สถานที่ดำเนินการ" value={data.location || "-"} />

        <View style={styles.hr} />

        <Text style={styles.sectionTitle}>{t("1. หลักการและเหตุผล")}</Text>
        <Paragraph text={data.rationale} />

        <Text style={styles.sectionTitle}>{t("2. วัตถุประสงค์")}</Text>
        <Paragraph text={data.objectives} />

        <Text style={styles.sectionTitle}>{t("3. เป้าหมาย")}</Text>
        <Text style={[styles.sectionTitle, { fontSize: 11, marginTop: 2 }]}>{t("3.1 เป้าหมายเชิงปริมาณ (ผลผลิต)")}</Text>
        <Paragraph text={data.targetQuantity} />
        <Text style={[styles.sectionTitle, { fontSize: 11 }]}>{t("3.2 เป้าหมายเชิงคุณภาพ (ผลลัพธ์)")}</Text>
        <Paragraph text={data.targetQuality} />

        <Text style={styles.sectionTitle}>{t("4. ขั้นตอนการดำเนินงาน และงบประมาณ")}</Text>
        <View style={styles.table} wrap>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "5%" }]}>{t("ที่")}</Text>
            <Text style={[styles.th, { width: "21%" }]}>{t("รายละเอียดการดำเนินงาน")}</Text>
            <Text style={[styles.th, { width: "10%" }]}>{t("ระยะเวลา")}</Text>
            <Text style={[styles.th, { width: "26%" }]}>{t("ผู้รับผิดชอบ")}</Text>
            <Text style={[styles.th, { width: "12.67%" }]}>{t("ค่าตอบแทน")}</Text>
            <Text style={[styles.th, { width: "12.66%" }]}>{t("ค่าใช้สอย")}</Text>
            <Text style={[styles.th, { width: "12.67%", borderRightWidth: 0 }]}>{t("ค่าวัสดุ")}</Text>
          </View>
          {data.activities.map((a, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.td, { width: "5%", textAlign: "center" }]}>{i + 1}</Text>
              <View style={[styles.td, { width: "21%" }]}>
                <CellText text={a.name} maxChars={10} />
              </View>
              <Text style={[styles.td, { width: "10%" }]}>{t(a.period || "-")}</Text>
              <View style={[styles.td, { width: "26%" }]}>
                <CellText text={a.responsible.join(", ")} maxChars={13} />
              </View>
              <Text style={[styles.td, { width: "12.67%", textAlign: "right" }]}>
                {a.compensation ? formatBaht(a.compensation) : "-"}
              </Text>
              <Text style={[styles.td, { width: "12.66%", textAlign: "right" }]}>
                {a.service ? formatBaht(a.service) : "-"}
              </Text>
              <Text style={[styles.td, { width: "12.67%", textAlign: "right", borderRightWidth: 0 }]}>
                {a.material ? formatBaht(a.material) : "-"}
              </Text>
            </View>
          ))}
          <View style={styles.tr}>
            <View style={[styles.td, { width: "62%", alignItems: "flex-end" }]}>
              <CellText
                text={`รวมงบประมาณทั้งสิ้น (แหล่งเงิน: ${data.budgetSource})`}
                maxChars={30}
                bold
              />
            </View>
            <Text style={[styles.td, { width: "38%", textAlign: "right", fontWeight: "bold", borderRightWidth: 0 }]}>
              {formatBaht(data.budgetAmount) + " บาท"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t("7. การวิเคราะห์ความเสี่ยงของโครงการ — ปัจจัยความเสี่ยง")}</Text>
        <Paragraph text={data.riskFactors} />
        <Text style={styles.sectionTitle}>{t("แนวทางการบริหารความเสี่ยง")}</Text>
        <Paragraph text={data.riskMitigation} />

        <Text style={styles.sectionTitle}>{t("8. ตัวชี้วัดและเป้าหมายความสำเร็จ")}</Text>
        <View style={styles.table} wrap>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "12%" }]}>{t("ประเภท")}</Text>
            <Text style={[styles.th, { width: "28%" }]}>{t("ตัวชี้วัด")}</Text>
            <Text style={[styles.th, { width: "12%" }]}>{t("ค่าเป้าหมาย")}</Text>
            <Text style={[styles.th, { width: "24%" }]}>{t("วิธีวัดและประเมินผล")}</Text>
            <Text style={[styles.th, { width: "24%", borderRightWidth: 0 }]}>{t("เครื่องมือที่ใช้")}</Text>
          </View>
          {data.evaluationItems.map((e, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.td, { width: "12%" }]}>{t(e.type)}</Text>
              <View style={[styles.td, { width: "28%" }]}>
                <CellText text={e.indicator} maxChars={14} />
              </View>
              <Text style={[styles.td, { width: "12%" }]}>{t(e.target || "-")}</Text>
              <View style={[styles.td, { width: "24%" }]}>
                <CellText text={e.method || "-"} maxChars={11} />
              </View>
              <View style={[styles.td, { width: "24%", borderRightWidth: 0 }]}>
                <CellText text={e.tool || "-"} maxChars={11} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t("9. ผลที่คาดว่าจะได้รับ")}</Text>
        <Paragraph text={data.expectedResults} />

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>{t("ลงชื่อ...........................................")}</Text>
            <Text style={styles.signLine}>{t(`(${data.responsible.join(", ") || data.proposerName || "..."})`)}</Text>
            <Text>{t("ผู้เสนอโครงการ")}</Text>
          </View>
        </View>
        <View style={styles.signRow} wrap={false}>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>{t("ลงชื่อ...........................................")}</Text>
            <Text style={styles.signLine}>{t(`(${data.endorsedByName || "..........................................."})`)}</Text>
            <Text>{t("ผู้เห็นชอบโครงการ")}</Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>{t("ลงชื่อ...........................................")}</Text>
            <Text style={styles.signLine}>{t(`(${data.approvedByName || "..........................................."})`)}</Text>
            <Text>{t("ผู้อนุมัติโครงการ")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
