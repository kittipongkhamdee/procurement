import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 11,
    padding: 40,
    color: "#111827",
  },
  center: { textAlign: "center" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 6 },
  headerRow: { flexDirection: "row", marginBottom: 4 },
  bold: { fontWeight: "bold" },
  dotted: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#111827", borderStyle: "dotted" },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 6 },
  paragraph: { marginBottom: 4, lineHeight: 1.2 },

  table: { marginTop: 6, marginBottom: 8, borderWidth: 1, borderColor: "#111827" },
  tr: { flexDirection: "row" },
  th: {
    fontWeight: "bold",
    fontSize: 11,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    textAlign: "center",
  },
  td: {
    fontSize: 11,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  colNo: { width: "6%", textAlign: "center" },
  colItem: { width: "54%" },
  colAmount: { width: "20%", textAlign: "right" },
  colNote: { width: "20%", borderRightWidth: 0 },

  boxGrid: { borderWidth: 1, borderColor: "#111827" },
  boxRow: { flexDirection: "row" },
  box: { width: "50%", padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  boxNoRight: { borderRightWidth: 0 },
  boxNoBottom: { borderBottomWidth: 0 },
  boxTitle: { fontWeight: "bold", fontSize: 11, marginBottom: 4, textDecoration: "underline" },
  boxLine: { fontSize: 11, lineHeight: 1.2, marginBottom: 2 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: "#111827",
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: { fontSize: 7, fontWeight: "bold" },
  signBlock: { marginTop: 10, alignItems: "center" },
  signLine: { fontSize: 11, marginBottom: 2 },

  itemsTable: { marginTop: 10, borderWidth: 1, borderColor: "#111827" },
  itemsTh: {
    fontWeight: "bold",
    fontSize: 11,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    textAlign: "center",
  },
  itemsTd: {
    fontSize: 11,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    minHeight: 20,
  },
  iColName: { width: "40%" },
  iColQty: { width: "13%", textAlign: "center" },
  iColPrice: { width: "15%", textAlign: "right" },
  iColTotal: { width: "15%", textAlign: "right" },
  iColNote: { width: "17%", borderRightWidth: 0 },
});

function Checkbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkbox}>{checked && <Text style={styles.checkboxMark}>X</Text>}</View>
      <Text style={styles.boxLine}>{t(label)}</Text>
    </View>
  );
}

export type ApprovalPdfData = {
  doc_number: string | null;
  doc_date: string;
  subject: string;
  addressed_to: string;
  department: string | null;
  activity_name: string | null;
  project_name: string | null;
  plan_date_text: string | null;
  requested_amount: number;
  summary_items: { label: string; amount: number | null; note: string | null }[];
  requested_by_name: string | null;
  requested_by_position: string | null;

  budget: number | null;
  remaining: number | null;

  fund_type: string | null;

  deputy_decision: "ควร" | "ไม่ควร" | null;
  deputy_note: string | null;

  status: "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ";
  approve_note: string | null;
  approved_at: string | null;

  signer_planning: string | null;
  signer_finance: string | null;
  signer_deputy: string | null;
  signer_director: string | null;

  school_name: string;

  group_name: string | null;
  budget_year_text: string | null;
  items: {
    seq: number;
    name: string | null;
    qty: number | null;
    unit_price: number | null;
    total: number | null;
    note: string | null;
  }[];
};

function approvedDateParts(approvedAt: string | null) {
  if (!approvedAt) return { day: "", month: "", year: "" };
  const d = new Date(approvedAt);
  const THAI_MONTHS = [
    "",
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];
  return { day: String(d.getDate()), month: THAI_MONTHS[d.getMonth() + 1], year: String(d.getFullYear() + 543) };
}

export function ApprovalDocument({ data }: { data: ApprovalPdfData }) {
  const summaryTotal = data.summary_items.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const itemsGrandTotal = data.items.reduce((sum, i) => sum + (i.total ?? 0), 0);
  const approvedDate = approvedDateParts(data.approved_at);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("บันทึกข้อความ")}</Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.bold}>{t("ส่วนราชการ ")}</Text>
          <Text>{t(`${data.school_name} อำเภอปราสาท จังหวัดสุรินทร์`)}</Text>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.bold}>{t("ที่ ")}</Text>
          <Text>{t(data.doc_number ? `งป/${data.doc_number}` : "งป/")}</Text>
          <Text style={[styles.bold, { marginLeft: 24 }]}>{t("วันที่ ")}</Text>
          <Text>{t(data.doc_date)}</Text>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.bold}>{t("เรื่อง ")}</Text>
          <Text>{t(data.subject)}</Text>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.bold}>{t("เรียน ")}</Text>
          <Text>{t(data.addressed_to)}</Text>
        </View>

        <View style={styles.hr} />

        <Text style={styles.paragraph}>
          {t(
            `ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน) ${data.department ?? "-"} จะดำเนินการจัดกิจกรรม (ชื่อกิจกรรม) ${
              data.activity_name ?? "-"
            }`,
          )}
        </Text>
        <Text style={styles.paragraph}>{t(`ตามโครงการ/งาน ${data.project_name ?? "-"}`)}</Text>
        <Text style={styles.paragraph}>
          {t(
            `จะดำเนินการวันที่ ${data.plan_date_text ?? "-"} และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน ${formatBaht(
              data.requested_amount,
            )} บาท`,
          )}
        </Text>
        <Text style={styles.paragraph}>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตและอนุมัติ")}</Text>

        <View style={styles.signBlock}>
          <Text style={styles.signLine}>{t("(ลงชื่อ)........................................... ผู้รับผิดชอบโครงการ")}</Text>
          <Text style={styles.signLine}>
            {t(`(${data.requested_by_name ?? "..........................................."})`)}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colNo]}>{t("ที่")}</Text>
            <Text style={[styles.th, styles.colItem]}>{t("รายการ")}</Text>
            <Text style={[styles.th, styles.colAmount]}>{t("จำนวนเงิน")}</Text>
            <Text style={[styles.th, styles.colNote, { borderRightWidth: 0 }]}>{t("หมายเหตุ")}</Text>
          </View>
          {data.summary_items.map((row, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.td, styles.colNo]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colItem]}>{t(row.label)}</Text>
              <Text style={[styles.td, styles.colAmount]}>{row.amount ? formatBaht(row.amount) : ""}</Text>
              <Text style={[styles.td, styles.colNote]}>{t(row.note)}</Text>
            </View>
          ))}
          <View style={styles.tr}>
            <Text style={[styles.td, { width: "60%", textAlign: "right", fontWeight: "bold" }]}>
              {t("รวมทั้งสิ้น")}
            </Text>
            <Text style={[styles.td, styles.colAmount, { fontWeight: "bold" }]}>{formatBaht(summaryTotal)}</Text>
            <Text style={[styles.td, styles.colNote]}></Text>
          </View>
        </View>

        <View style={styles.boxGrid}>
          <View style={styles.boxRow}>
            <View style={styles.box}>
              <Text style={styles.boxTitle}>{t("1. ความเห็นงานแผนงาน")}</Text>
              <Text style={styles.boxLine}>{t("- ตรวจสอบแล้วมีโครงการ")}</Text>
              <Text style={styles.boxLine}>
                {t(`- เงินโครงการทั้งสิ้น ${data.budget != null ? formatBaht(data.budget) : "-"} บาท`)}
              </Text>
              <Text style={styles.boxLine}>{t(`- เงินขอใช้ครั้งนี้ ${formatBaht(data.requested_amount)} บาท`)}</Text>
              <Text style={styles.boxLine}>
                {t(`- เงินโครงการเหลือ ${data.remaining != null ? formatBaht(data.remaining) : "-"} บาท`)}
              </Text>
              <View style={styles.signBlock}>
                <Text style={styles.signLine}>{t("(ลงชื่อ)...................................")}</Text>
                <Text style={styles.signLine}>{t(`(${data.signer_planning ?? "-"})`)}</Text>
              </View>
            </View>
            <View style={[styles.box, styles.boxNoRight]}>
              <Text style={styles.boxTitle}>{t("2. ความเห็นเจ้าหน้าที่การเงิน")}</Text>
              <Text style={styles.boxLine}>{t("- ตรวจสอบแล้วมีงบประมาณ")}</Text>
              <Checkbox checked={data.fund_type === "งบค่าจัดการเรียนการสอน"} label="งบค่าจัดการเรียนการสอน" />
              <Checkbox
                checked={data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน"}
                label="งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน"
              />
              <Checkbox checked={data.fund_type === "เงินรายได้สถานศึกษา"} label="เงินรายได้สถานศึกษา" />
              <View style={styles.signBlock}>
                <Text style={styles.signLine}>{t("(ลงชื่อ)...................................")}</Text>
                <Text style={styles.signLine}>{t(`(${data.signer_finance ?? "-"})`)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.boxRow}>
            <View style={[styles.box, styles.boxNoBottom]}>
              <Text style={styles.boxTitle}>{t("3. ความเห็นของรองผู้อำนวยการ")}</Text>
              <Text style={styles.boxLine}>{t("- ตรวจสอบแล้วมีโครงการและงบประมาณ")}</Text>
              <Checkbox checked={data.deputy_decision === "ควร"} label="ควรอนุญาตและอนุมัติ" />
              <Checkbox
                checked={data.deputy_decision === "ไม่ควร"}
                label={`ไม่ควรอนุญาตและอนุมัติเพราะ ${data.deputy_note ?? "..."}`}
              />
              <View style={styles.signBlock}>
                <Text style={styles.signLine}>{t("(ลงชื่อ)...................................")}</Text>
                <Text style={styles.signLine}>{t(`(${data.signer_deputy ?? "-"})`)}</Text>
              </View>
            </View>
            <View style={[styles.box, styles.boxNoRight, styles.boxNoBottom]}>
              <Text style={styles.boxTitle}>{t("4. ความเห็นของผู้อำนวยการโรงเรียน")}</Text>
              <Text style={styles.boxLine}>{t("- ตรวจสอบโครงการและงบประมาณ")}</Text>
              <Checkbox checked={data.status === "อนุมัติ"} label="อนุมัติ" />
              <Checkbox checked={data.status === "ไม่อนุมัติ"} label="ไม่อนุมัติ" />
              <View style={styles.signBlock}>
                <Text style={styles.signLine}>{t("(ลงชื่อ)...................................")}</Text>
                <Text style={styles.signLine}>{t(`(${data.signer_director ?? "-"})`)}</Text>
                <Text style={styles.signLine}>{t("ผู้อำนวยการโรงเรียนตาเบาวิทยา")}</Text>
                <Text style={styles.signLine}>
                  {t(
                    `วันที่ ${approvedDate.day || "........."} เดือน ${
                      approvedDate.month || "........."
                    } พ.ศ. ${approvedDate.year || "........."}`,
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.paragraph}>{t(`รายการวัสดุ อุปกรณ์ งาน/โครงการ ${data.project_name ?? "-"}`)}</Text>
        <Text style={styles.paragraph}>{t(`กิจกรรม ${data.activity_name ?? "-"}`)}</Text>
        <View style={styles.headerRow}>
          <Text>{t(`กลุ่มสาระ/งาน ${data.department ?? "-"}`)}</Text>
          <Text style={{ marginLeft: 24 }}>{t(`กลุ่มงาน ${data.group_name ?? "-"}`)}</Text>
          <Text style={{ marginLeft: 24 }}>{t(`ปีการศึกษา ${data.budget_year_text ?? "-"}`)}</Text>
        </View>

        <View style={styles.itemsTable}>
          <View style={styles.tr}>
            <Text style={[styles.itemsTh, styles.iColName]}>{t("รายการ")}</Text>
            <Text style={[styles.itemsTh, styles.iColQty]}>{t("จำนวน (หน่วย)")}</Text>
            <Text style={[styles.itemsTh, styles.iColPrice]}>{t("ราคา/หน่วย")}</Text>
            <Text style={[styles.itemsTh, styles.iColTotal]}>{t("จำนวนเงิน")}</Text>
            <Text style={[styles.itemsTh, styles.iColNote, { borderRightWidth: 0 }]}>{t("หมายเหตุ")}</Text>
          </View>
          {data.items.map((item) => (
            <View style={styles.tr} key={item.seq}>
              <Text style={[styles.itemsTd, styles.iColName]}>{t(item.name)}</Text>
              <Text style={[styles.itemsTd, styles.iColQty]}>{item.qty ?? ""}</Text>
              <Text style={[styles.itemsTd, styles.iColPrice]}>
                {item.unit_price != null ? formatBaht(item.unit_price) : ""}
              </Text>
              <Text style={[styles.itemsTd, styles.iColTotal]}>{item.total != null ? formatBaht(item.total) : ""}</Text>
              <Text style={[styles.itemsTd, styles.iColNote]}>{t(item.note)}</Text>
            </View>
          ))}
          {data.items.length > 0 && (
            <View style={styles.tr}>
              <Text style={[styles.itemsTd, { width: "68%", textAlign: "right", fontWeight: "bold" }]}>
                {t("รวมทั้งสิ้น")}
              </Text>
              <Text style={[styles.itemsTd, styles.iColTotal, { fontWeight: "bold" }]}>
                {formatBaht(itemsGrandTotal)}
              </Text>
              <Text style={[styles.itemsTd, styles.iColNote]}></Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
