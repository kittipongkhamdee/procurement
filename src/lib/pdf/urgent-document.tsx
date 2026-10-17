import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { Tick } from "./w119-document";
import { CM, INDENT, Para, Sign, styles } from "./procurement-set-document";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) — รายงานขอซื้อ/จ้างหลังดำเนินการไปก่อน ตามระเบียบกระทรวงการคลังว่าด้วย
// การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 วรรคสอง ประกอบหนังสือ กค (กวจ) 0405.2/ว 119 ลว. 7 มี.ค. 2561
// แบบตามไฟล์ที่โรงเรียนใช้ (บันทึกข้อความ "รายงานขอซื้อ/จ้าง") — เมื่อเห็นชอบแล้วให้ถือเป็นหลักฐานการตรวจรับโดยอนุโลม

export type UrgentData = {
  doc_no: string | null;
  doc_type: "ซื้อ" | "จ้าง";
  record_date: string;
  purchase_date: string;
  subject: string;
  reason: string | null;
  work_text: string;
  amount: number;
  payee: string | null;
  receipt_book: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  school_name: string;
  education_area: string | null;
  procurement_officer: string | null;
  procurement_head: string | null;
  director: string | null;
};

export function UrgentDocument({ data: d }: { data: UrgentData }) {
  const school = d.school_name;
  const unit = `${school}${d.education_area ? `  ${d.education_area}` : ""}`;
  const keep = [school.replace(/^โรงเรียน/, ""), d.responsible_name ?? "", d.payee ?? ""].filter(Boolean);
  const amount = formatBaht(d.amount);
  const receipt = [d.receipt_book && `เล่มที่ ${d.receipt_book}`, d.receipt_no && `เลขที่ ${d.receipt_no}`, d.receipt_date && `ลงวันที่ ${formatThaiDate(d.receipt_date)}`]
    .filter(Boolean)
    .join(" ");
  const L = 595.28 / 2 - 2.5 * CM;
  return (
    <Document title={`รายงานขอ${d.doc_type} ${d.doc_no ?? ""}`}>
      <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
        <View style={{ marginTop: -CM }}>
          <MemoHeader unit={unit} docNumber={d.doc_no ?? ""} isoDate={d.record_date} subject={`รายงานขอ${d.doc_type} ${d.subject}`} />
        </View>
        <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
        {d.reason && <Para keep={keep} text={`ด้วย ${d.reason}`} />}
        <Para
          keep={keep}
          text={`เพื่อให้เป็นไปตามแนวทางการปฏิบัติในการดำเนินการจัดหาพัสดุที่เกี่ยวกับค่าใช้จ่ายในการบริหารงาน ค่าใช้จ่ายในการฝึกอบรม การจัดงานและการประชุมของหน่วยงานของรัฐ ตามหนังสือกรมบัญชีกลาง ด่วนที่สุด ที่ กค (กวจ) 0405.2/ว 119 ลงวันที่ 7 มีนาคม 2561 และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 วรรคสอง ดังนั้น ข้าพเจ้า ${
            d.responsible_name ?? "...................."
          }${d.responsible_position ? ` ตำแหน่ง ${d.responsible_position}` : ""} จึงได้ดำเนินการ${d.work_text} เมื่อวันที่ ${formatThaiDate(d.purchase_date)} จำนวนเงิน ${amount} บาท ${thaiBahtText(
            d.amount,
          )} รายละเอียดตามเอกสารใบเสร็จรับเงิน${receipt ? ` ${receipt}` : ""} ที่แนบมาพร้อมนี้`}
        />
        <View wrap={false}>
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณา")}</Text>
          <Text style={{ marginLeft: INDENT + 20 }}>{t(`1. ให้ความเห็นชอบการจัด${d.doc_type}`)}</Text>
          <Text style={{ marginLeft: INDENT + 20 }}>{t("2. ขออนุมัติรายงานฉบับนี้เป็นหลักฐานการตรวจรับโดยอนุโลม")}</Text>
          <Para keep={keep} indent={INDENT + 20} text={`3. อนุมัติให้เบิกจ่ายเงินค่าจัด${d.doc_type}ดังกล่าว ให้แก่ ${d.payee ?? "...................."}`} />
          <Sign role="" name={d.responsible_name} extra={d.responsible_position ? [`ตำแหน่ง ${d.responsible_position}`] : []} style={{ marginLeft: L - 50, marginTop: 6 }} />

          <View style={{ flexDirection: "row", marginTop: 14 }}>
            <View style={{ width: L + 20 }}>
              <Text style={{ textDecoration: "underline" }}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
              <Text style={{ marginLeft: 20 }}>{t("- ตรวจสอบแล้ว มีรายละเอียดเป็นไปตามระเบียบฯ")}</Text>
              <Text style={{ marginLeft: 20 }}>{t("- เห็นควรอนุมัติให้เบิกจ่ายได้")}</Text>
              <Sign role="เจ้าหน้าที่" name={d.procurement_officer} style={{ marginTop: 10 }} />
              <Sign role="หัวหน้าเจ้าหน้าที่" name={d.procurement_head} style={{ marginTop: 6 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{t("คำสั่ง")}</Text>
              <Tick text="เห็นชอบ/อนุมัติ" />
              <Tick text="ไม่เห็นชอบ/ไม่อนุมัติ เนื่องจาก............" />
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, formatThaiDate(d.record_date)]} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
