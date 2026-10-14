import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText, THAI_MONTHS } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { measureText as measureWith, wrapByWidth as wrapWith } from "./thai-measure";

// ชุดเอกสารส่งมอบงานตามสัญญา ๔ หน้า (ตามแบบที่โรงเรียนใช้): ใบส่งมอบงาน, ใบตรวจรับพัสดุ (ระเบียบฯ ข้อ ๑๗๕),
// บันทึกข้อความรายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน, ใบสำคัญรับเงิน
// ฟอนต์ TH Sarabun New ๑๖ พอยท์ ขอบกระดาษเดียวกับบันทึกขออนุมัติ (ซ้าย ๒.๕ ขวา ๒ บน ๑.๕ ล่าง ๑ ซม.)

registerSarabunFont();
const FAMILY = "THSarabunNew";
Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Bold.ttf"), fontWeight: "bold" },
  ],
});
const measureText = (text: string, size: number, bold = false) => measureWith(text, size, bold, FAMILY);
const wrap = (text: string, size: number, first: number, rest: number) => wrapWith(text, size, first, rest, false, FAMILY);

const CM = 28.3465;
const PAGE_W = 595.28;
const PAD_LEFT = 2.5 * CM;
const PAD_RIGHT = 2 * CM;
const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT;
const FS = 16;
const INDENT = 2.5 * CM;
const SLACK = 10; // เผื่อความกว้างตอนตัดบรรทัดเอง (react-pdf วัดกว้างกว่าเล็กน้อย)

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.25, paddingTop: 1.5 * CM, paddingBottom: 1 * CM, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  bold: { fontWeight: "bold" },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  right: { alignItems: "flex-end" },
  gap: { marginBottom: 6 },
});

export type DeliveryPdfData = {
  contract_type: string; // จ้าง | ซื้อ
  contract_no: string;
  contract_date: string;
  detail: string | null; // งานที่จ้าง/ซื้อ เช่น "จ้างเพื่อปฏิบัติหน้าที่ลูกจ้างชั่วคราว ตำแหน่งครูอัตราจ้าง โรงเรียนตาเบาวิทยา"
  end_date: string | null;
  vendor_name: string;
  id_card: string | null;
  house_no: string | null;
  moo: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  zipcode: string | null;
  phone: string | null;
  delivery_date: string;
  period_month: string | null;
  amount: number;
  late_days: number | null;
  penalty_amount: number | null;
  withholding_tax: number | null;
  inspector_name: string | null;
  school_name: string;
  school_address: string | null;
  education_area: string | null;
  procurement_officer: string | null;
  procurement_head: string | null;
  finance_officer: string | null;
  director: string | null;
};

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/** บรรทัดแบบ "กระจายแบบไทย" (Thai Distributed) — แบ่งเป็นกลุ่มอักษร (grapheme: พยัญชนะ+สระ/วรรณยุกต์ไม่แยกกัน)
 * แล้วเกลี่ยช่องว่างระหว่างกลุ่มอักษรให้เต็มความกว้างบรรทัด */
function DistributedLine({ text, style }: { text: string; style?: Styles[string] }) {
  const parts = [...graphemes.segment(text)].map((g) => g.segment);
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between" }, style ?? {}]}>
      {parts.map((g, i) => (
        <Text key={i}>{g === " " ? "\u00a0" : g}</Text>
      ))}
    </View>
  );
}

/** ย่อหน้า — ตัดบรรทัดเองตามความกว้างจริงของฟอนต์ (Thai ไม่มีช่องว่างระหว่างคำ react-pdf ตัดเองผิด)
 * ทุกบรรทัดยกเว้นบรรทัดสุดท้ายจัดแบบกระจายแบบไทยให้เต็มความกว้าง */
function Para({ text, indent = INDENT, style }: { text: string; indent?: number; style?: Styles[string] }) {
  const lines = wrap(text, FS, CONTENT_W - indent - SLACK, CONTENT_W - SLACK);
  return (
    <View style={[styles.gap, style ?? {}]}>
      {lines.map((l, i) => {
        const lineStyle = i === 0 ? { marginLeft: indent } : undefined;
        return i < lines.length - 1 ? (
          <DistributedLine key={i} text={l} style={lineStyle} />
        ) : (
          <Text key={i} style={lineStyle}>
            {t(l)}
          </Text>
        );
      })}
    </View>
  );
}

/** ลายมือชื่อเริ่มที่แนวกึ่งกลางกระดาษ ชื่อในวงเล็บอยู่ใต้เส้น */
function Sign({ role, name, marginTop = 18, left = PAGE_W / 2 - PAD_LEFT }: { role: string; name: string | null; marginTop?: number; left?: number }) {
  return (
    <View style={{ marginLeft: left, marginTop }} wrap={false}>
      <Text>{t(`ลงชื่อ.......................................${role}`)}</Text>
      <Text style={{ marginLeft: measureText("ลงชื่อ", FS) - 4 }}>{t(name ? `(${name})` : "(.......................................)")}</Text>
    </View>
  );
}

function periodText(iso: string | null, fallbackDate: string) {
  const src = iso ?? fallbackDate;
  const m = Number(src.slice(5, 7));
  return THAI_MONTHS[m] ?? "";
}

function partyIntro(d: DeliveryPdfData) {
  const parts = [
    d.id_card ? `เลขประจำตัวประชาชน ${d.id_card}` : "",
    d.house_no ? `บ้านเลขที่ ${d.house_no}` : "",
    d.moo ? `หมู่ที่ ${d.moo}` : "",
    d.tambon ? `ตำบล${d.tambon}` : "",
    d.amphoe ? `อำเภอ${d.amphoe}` : "",
    d.province ? `จังหวัด${d.province}` : "",
    d.zipcode ? `รหัสไปรษณีย์ ${d.zipcode}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export function DeliveryDocument({ data: d }: { data: DeliveryPdfData }) {
  const verb = d.contract_type === "ซื้อ" ? "ซื้อ" : "จ้าง";
  const party = d.contract_type === "ซื้อ" ? "ผู้ขาย" : "ผู้รับจ้าง";
  const work = d.detail?.trim() || (verb === "จ้าง" ? "งานจ้าง" : "พัสดุ");
  const deliveryDate = formatThaiDate(d.delivery_date);
  const contractRef = `โดยวิธีเฉพาะเจาะจง ตามสัญญา${verb}เลขที่ ${d.contract_no} ลงวันที่ ${formatThaiDate(d.contract_date)} นั้น`;
  const address = partyIntro(d);
  const phone = d.phone ? ` โทรศัพท์ ${d.phone}` : "";
  const month = periodText(d.period_month, d.delivery_date);
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const tax = d.withholding_tax && d.withholding_tax > 0 ? d.withholding_tax : 0;
  const net = d.amount - tax;
  const late = d.late_days && d.late_days > 0 ? d.late_days : 0;
  const penaltyPerDay = late && d.penalty_amount ? d.penalty_amount / late : 0;
  const dash = (n: number) => (n > 0 ? formatBaht(n) : "-");

  return (
    <Document title={`ส่งมอบงาน ${d.contract_no} ${month}`}>
      {/* ๑. ใบส่งมอบงาน */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t("ใบส่งมอบงาน")}</Text>
        <View style={[styles.right, styles.gap]}>
          <Text>{t(`เขียนที่ ${d.school_name}`)}</Text>
          {d.amphoe || d.school_address ? <Text>{t(schoolDistrict(d.school_address))}</Text> : null}
        </View>
        <Text style={[styles.gap, { marginLeft: CONTENT_W / 2 - 40 }]}>{t(`วันที่ ${deliveryDate}`)}</Text>
        <Text>{t(`เรื่อง    ส่งมอบงาน${verb}และแจ้งหนี้ขอเบิกเงิน`)}</Text>
        <Text style={styles.gap}>{t(`เรียน    ผู้อำนวยการ${d.school_name}`)}</Text>
        <Para text={`ตามที่${d.school_name} ได้ตกลง${verb === "จ้าง" ? "ให้" : "ซื้อจาก"}ข้าพเจ้า${d.vendor_name} ${address} เพื่อดำเนินการ${work} ${contractRef}`} />
        <Para text={`บัดนี้ ข้าพเจ้าได้ปฏิบัติตามสัญญา${verb} งวดเดือน ${month} เสร็จเรียบร้อยแล้ว จึงขอส่งมอบงาน${verb}เพื่อตรวจรับและขอเบิกจ่ายเงินค่า${verb}ให้กับข้าพเจ้า จำนวน ${amount} บาท ${amountText} ต่อไป`} />
        <Text style={{ marginLeft: PAGE_W / 2 - PAD_LEFT + 30, marginTop: 10 }}>{t("ขอแสดงความนับถือ")}</Text>
        <Sign role="" name={d.vendor_name} />
      </Page>

      {/* ๒. ใบตรวจรับพัสดุ */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.title, { marginBottom: 2 }]}>{t("ใบตรวจรับพัสดุ")}</Text>
        <Text style={{ textAlign: "center", marginBottom: 8 }}>{t("ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175")}</Text>
        <View style={[styles.right, styles.gap]}>
          <Text>{t(`เขียนที่ ${d.school_name}`)}</Text>
        </View>
        <Text style={[styles.gap, { marginLeft: CONTENT_W / 2 - 40 }]}>{t(`วันที่ ${deliveryDate}`)}</Text>
        <Para text={`ตามที่${d.school_name} ได้ตกลง${verb} ${d.vendor_name} ${address}${phone} เพื่อดำเนินการ${work} ${contractRef} เพื่อให้ผู้ตรวจรับ ทำการตรวจรับพัสดุ ซึ่งผลการตรวจรับเป็นดังนี้`} />
        <View style={{ marginLeft: INDENT / 2 }}>
          <Text>{t(`1. ครบกำหนดส่งมอบวันที่ ${d.end_date ? formatThaiDate(d.end_date) : deliveryDate}`)}</Text>
          <Text>{t(`2. ส่งมอบเมื่อวันที่ ${deliveryDate}`)}</Text>
          <Text>{t(`3. ตรวจรับพัสดุตามใบส่งมอบงาน เลขที่...............ลงวันที่ ${deliveryDate}`)}</Text>
          <Text>{t(`4. ได้ตรวจรับงาน${verb}ถูกต้องทุกประการ ตั้งแต่วันที่ ${deliveryDate}`)}</Text>
          <Text style={styles.gap}>
            {t(`5. ส่งมอบงานเกินกำหนด ${late > 0 ? late : "-"} วัน ค่าปรับวันละ ${dash(penaltyPerDay)} บาท รวมค่าปรับ ${dash(d.penalty_amount ?? 0)} บาท`)}
          </Text>
        </View>
        <Para text={`จึงขอเสนอรายงานต่อผู้อำนวยการ${d.school_name} เพื่อโปรดทราบ ตามนัยข้อ 175 (4) แห่งระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560`} />
        <Sign role="ผู้ตรวจรับพัสดุ" name={d.inspector_name} />
      </Page>

      {/* ๓. บันทึกข้อความ รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน */}
      <Page size="A4" style={styles.page}>
        <MemoHeader
          unit={`${d.school_name}${d.education_area ? `  ${d.education_area}` : ""}`}
          docNumber={null}
          isoDate={d.delivery_date}
          subject="รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน"
        />
        <View style={{ marginBottom: 6 }} />
        <Text style={styles.gap}>{t(`เรียน   ผู้อำนวยการ${d.school_name}`)}</Text>
        <Para text={`ตามที่ ${d.school_name} ได้ตกลง${verb} ${d.vendor_name} ${address}${phone} เพื่อดำเนินการ${work} ${contractRef}`} />
        <Para text={`บัดนี้ผู้ตรวจรับพัสดุได้ตรวจรับพัสดุตามใบสั่ง${verb}ถูกต้อง และได้รับมอบพัสดุเมื่อวันที่ ${deliveryDate} ซึ่งจะต้องจ่ายเงินให้แก่${party} เป็นเงิน ${amount} บาท หักภาษี ณ ที่จ่าย ${dash(tax)} บาท คงเหลือ ${formatBaht(net)} บาท`} />
        <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนเพื่อโปรด")}</Text>
        <View style={{ marginLeft: INDENT + 20 }}>
          <Text>{t("1. ทราบผลการตรวจรับตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและ")}</Text>
          <Text style={{ marginLeft: 12 }}>{t("การบริหารพัสดุภาครัฐ พ.ศ. 2560")}</Text>
          <Text>{t(`2. อนุมัติเบิกจ่ายเงินให้แก่ ${d.vendor_name} เป็นเงิน ${formatBaht(net)} บาท`)}</Text>
          <Text style={{ marginLeft: 12 }}>{t(thaiBahtText(net))}</Text>
        </View>
        <Sign role="เจ้าหน้าที่" name={d.procurement_officer} marginTop={14} />
        <Sign role="หัวหน้าเจ้าหน้าที่" name={d.procurement_head} marginTop={10} />
        <View style={{ marginTop: 10 }} wrap={false}>
          <Text>{t("- ทราบ")}</Text>
          <Text>{t("- อนุมัติ")}</Text>
          <Text style={{ marginTop: 14 }}>{t("ลงชื่อ.......................................")}</Text>
          <Text style={{ marginLeft: 24 }}>{t(d.director ? `(${d.director})` : "(.......................................)")}</Text>
          <Text>{t(`ผู้อำนวยการ${d.school_name}`)}</Text>
          <Text>{t(`วันที่ ${deliveryDate}`)}</Text>
        </View>
      </Page>

      {/* ๔. ใบสำคัญรับเงิน */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t("ใบสำคัญรับเงิน")}</Text>
        <View style={[styles.right, styles.gap]}>
          <Text>{t(`เขียนที่ ${d.school_name}`)}</Text>
          {d.school_address ? <Text>{t(d.school_address)}</Text> : null}
        </View>
        <Text style={[styles.gap, { marginLeft: CONTENT_W / 2 - 40 }]}>{t("วันที่............เดือน...........................พ.ศ.............")}</Text>
        <Para text={`ข้าพเจ้า ${d.vendor_name} ${address}${phone} ได้รับเงินจาก${d.school_name} ดังรายการต่อไปนี้`} />
        <View style={{ borderWidth: 0.8, marginTop: 4 }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 0.8 }}>
            <Text style={[styles.bold, { width: 60, textAlign: "center", borderRightWidth: 0.8, padding: 3 }]}>{t("ลำดับที่")}</Text>
            <Text style={[styles.bold, { flex: 1, textAlign: "center", borderRightWidth: 0.8, padding: 3 }]}>{t("รายการ")}</Text>
            <Text style={[styles.bold, { width: 100, textAlign: "center", padding: 3 }]}>{t("จำนวนเงิน")}</Text>
          </View>
          <View style={{ flexDirection: "row", borderBottomWidth: 0.8, minHeight: 60 }}>
            <Text style={{ width: 60, textAlign: "center", borderRightWidth: 0.8, padding: 3 }}>1.</Text>
            <View style={{ flex: 1, borderRightWidth: 0.8, padding: 3 }}>
              {wrap(`ค่า${work.replace(/^จ้าง/, "จ้าง")} ประจำเดือน ${month}`, FS, CONTENT_W - 160 - 6 - SLACK, CONTENT_W - 160 - 6 - SLACK).map((l, i) => (
                <Text key={i}>{t(l)}</Text>
              ))}
            </View>
            <Text style={{ width: 100, textAlign: "right", padding: 3 }}>{amount}</Text>
          </View>
          <View style={{ flexDirection: "row", borderBottomWidth: 0.8 }}>
            <Text style={[styles.bold, { flex: 1, textAlign: "right", borderRightWidth: 0.8, padding: 3 }]}>{t("รวมเงิน")}</Text>
            <Text style={[styles.bold, { width: 100, textAlign: "right", padding: 3 }]}>{amount}</Text>
          </View>
          <Text style={{ padding: 3, textAlign: "center" }}>{t(`(ตัวอักษร) ${amountText}`)}</Text>
        </View>
        <Sign role="ผู้รับเงิน" name={d.vendor_name} marginTop={24} />
        <Sign role="ผู้จ่ายเงิน" name={d.finance_officer} marginTop={14} />
      </Page>
    </Document>
  );
}

/** "เลขที่ 99 หมู่ที่ 10 ตำบลตาเบา อำเภอปราสาท จังหวัดสุรินทร์" → "อำเภอปราสาท  จังหวัดสุรินทร์" */
function schoolDistrict(address: string | null) {
  if (!address) return "";
  const m = address.match(/(อำเภอ\S+)\s*(จังหวัด\S+)/);
  return m ? `${m[1]}  ${m[2]}` : "";
}
