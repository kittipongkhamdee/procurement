import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { Tick } from "./w119-document";
import { CM, CONTENT_W, INDENT, Para, Sign, styles } from "./procurement-set-document";

// จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน) — รายงานขอซื้อ/ขอจ้างหลังดำเนินการไปก่อน ตามระเบียบกระทรวงการคลังว่าด้วย
// การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 วรรคสอง — แบบตามตัวอย่างที่โรงเรียนใช้ (ศรีปทุมพิทยาคม/ดอนแรดวิทยา):
// ย่อหน้าเหตุผล → "จึงได้ดำเนินการดังนี้" + รายการ (ซื้อ/จ้าง แต่ละรายการมีจำนวนเงิน) → รวม → ข้อเสนอ 3 ข้อ → เจ้าหน้าที่/หัวหน้าเจ้าหน้าที่
// เสนอ ผอ. → คำสั่ง (เห็นชอบ / อนุมัติ) — เมื่อเห็นชอบแล้วให้ถือเป็นหลักฐานการตรวจรับโดยอนุโลม

import { urgentKindLabel, type UrgentItem } from "@/lib/urgent";

export { urgentKindLabel };

export type UrgentData = {
  doc_no: string | null;
  record_date: string;
  purchase_date: string;
  subject: string;
  reason: string | null;
  work_text: string;
  amount: number;
  payee: string | null;
  receipt_type: string | null;
  receipt_book: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  admin_group: string | null;
  project_name: string | null;
  activity_name: string | null;
  items: UrgentItem[];
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
  const kind = urgentKindLabel(d.items);
  const plan = [d.project_name, d.activity_name && `กิจกรรม${d.activity_name}`].filter(Boolean).join(" ");
  const receipt = [d.receipt_book && `เล่มที่ ${d.receipt_book}`, d.receipt_no && `เลขที่ ${d.receipt_no}`, d.receipt_date && `ลงวันที่ ${formatThaiDate(d.receipt_date)}`]
    .filter(Boolean)
    .join(" ");
  const L = 595.28 / 2 - 2.5 * CM;
  const amountX = CONTENT_W - 150;
  return (
    <Document title={`รายงานขอ${kind} ${d.doc_no ?? ""}`}>
      <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
        <View style={{ marginTop: -CM }}>
          <MemoHeader unit={unit} docNumber={d.doc_no ?? ""} isoDate={d.record_date} subject={`รายงานขอ${kind}${d.subject} กรณีมีความจำเป็นเร่งด่วน`} />
        </View>
        <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
        <Para
          keep={keep}
          text={`ด้วย${d.reason ? `${d.reason} และ` : ""}${d.admin_group ?? ""} ได้ดำเนินการ${d.work_text}${plan ? ` ประกอบการดำเนินงาน${plan}` : ""} เมื่อวันที่ ${formatThaiDate(
            d.purchase_date,
          )} เนื่องจากเป็นเรื่องจำเป็นเร่งด่วน ดังนั้น ข้าพเจ้า ${d.responsible_name ?? "...................."}${d.responsible_position ? ` ตำแหน่ง ${d.responsible_position}` : ""} ${school} จึงได้ดำเนินการดังนี้`}
          style={{ marginBottom: 0 }}
        />
        {d.items.map((i, idx) => (
          <View key={idx} style={{ flexDirection: "row", marginLeft: INDENT }} wrap={false}>
            <Text style={{ width: amountX - INDENT }}>{t(`${idx + 1}. ${i.kind === "จ้าง" ? "จ้าง" : "ซื้อ"}${i.name}`)}</Text>
            <Text style={{ width: 150, textAlign: "right" }}>{t(`เป็นเงิน  ${formatBaht(i.amount)}  บาท`)}</Text>
          </View>
        ))}
        <Text style={{ textAlign: "right" }}>{t(`รวมเป็นเงิน  ${formatBaht(d.amount)}  บาท  ${thaiBahtText(d.amount)}`)}</Text>
        <Para keep={keep} indent={0} text={`รายละเอียดตามเอกสาร${d.receipt_type?.trim() || "ใบเสร็จรับเงิน"}${receipt ? ` ${receipt} ` : ""}ที่แนบมาพร้อมนี้`} />
        <View wrap={false}>
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณา")}</Text>
          <Para
            keep={keep}
            indent={INDENT + 20}
            text="1. ให้ความเห็นชอบการจัดซื้อจัดจ้างกรณีมีความจำเป็นเร่งด่วน ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 79 วรรค 2"
            style={{ marginBottom: 0 }}
          />
          <Text style={{ marginLeft: INDENT + 20 }}>{t("2. ขออนุมัติรายงานฉบับนี้เป็นหลักฐานการตรวจรับพัสดุโดยอนุโลม")}</Text>
          <Para keep={keep} indent={INDENT + 20} text={`3. อนุมัติให้เบิกจ่ายเงินค่าจัดซื้อจัดจ้างดังกล่าว ให้แก่ ${d.payee ?? d.responsible_name ?? "...................."}`} />
          <Sign
            role=""
            name={d.responsible_name}
            extra={d.responsible_position ? [`ตำแหน่ง ${d.responsible_position}`] : []}
            style={{ marginLeft: L - 50, marginTop: 6 }}
          />

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <View style={{ width: L + 20 }}>
              <Text>{t(`เสนอผู้อำนวยการ${school}`)}</Text>
              <Text style={{ marginLeft: 20 }}>{t("- ตรวจสอบแล้ว มีรายละเอียดเป็นไปตามระเบียบฯ")}</Text>
              <Text style={{ marginLeft: 20 }}>{t("- เห็นควรอนุมัติให้เบิกจ่ายได้")}</Text>
              <Sign role="เจ้าหน้าที่" name={d.procurement_officer} style={{ marginTop: 10 }} />
              <Sign role="หัวหน้าเจ้าหน้าที่" name={d.procurement_head} style={{ marginTop: 6 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{t("คำสั่ง")}</Text>
              <Tick text="เห็นชอบ" />
              <Tick text="อนุมัติ" />
              <Tick text="ไม่เห็นชอบ/ไม่อนุมัติ เนื่องจาก............" />
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, formatThaiDate(d.record_date)]} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
