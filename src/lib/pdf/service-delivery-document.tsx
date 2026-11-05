import React from "react";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Svg, Path, Text, View, type Styles } from "@react-pdf/renderer";
import { thaiBahtText } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";
import { wrapByWidth as wrapWith } from "./thai-measure";
import { SignBody } from "./sign-block";

// ใบส่งมอบงาน + ใบตรวจรับพัสดุในงานซื้อหรืองานจ้าง "แบบสัญญาจ้างงานบริการ" (ธุรการ/นักการภารโรง) — ตามไฟล์ตัวอย่างของโรงเรียน
// (ช่องติ๊กประเภทเอกสาร, ผลการตรวจรับแบบช่องติ๊ก, คณะกรรมการตรวจรับ ๓ คน) ใช้กับสัญญาที่สร้างจากฟอร์ม "สัญญาจ้างเหมาบริการ"
// ส่วนงานซื้อ/จ้างอื่นยังใช้ชุดเดิม (delivery-document.tsx) — ฟอนต์ TH Sarabun New 16pt ขอบเดียวกับชุดเดิม

registerSarabunFont();
const FAMILY = "THSarabunNew";
Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Bold.ttf"), fontWeight: "bold" },
  ],
});
const wrap = (text: string, first: number, rest: number, keep: string[] = []) => wrapWith(text, FS, first, rest, false, FAMILY, keep);

const CM = 28.3465;
const PAGE_W = 595.28;
const PAD_LEFT = 2.5 * CM;
const PAD_RIGHT = 2 * CM;
const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT;
const FS = 16;
const INDENT = 2.5 * CM;
const SLACK = 10;

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.25, paddingTop: 2.5 * CM, paddingBottom: 1 * CM, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  gap: { marginBottom: 8 },
});

export type ServiceDeliveryData = {
  school_name: string;
  contract_no: string;
  contract_date: string; // ข้อความไทยพร้อมแสดง
  vendor_name: string;
  role: string; // ตำแหน่ง เช่น นักการภารโรง
  project: string; // ชื่อโครงการในใบตรวจรับ
  monthly: string; // "9,000" หรือ "9,000.50"
  delivery_date: string;
  amount: string;
  amount_text: string;
  month_name: string;
  period_from: string;
  period_to: string;
  late_days: number;
  penalty_amount: number;
  committee: { role: string; name: string | null }[];
};

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
/** ช่องติ๊กแบบอยู่ในบรรทัด — ในข้อความเขียน "( )" = ไม่ติ๊ก, "(.)" = ติ๊ก */
function InlineBox({ on }: { on: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text>(</Text>
      <View style={{ width: 9, height: 11 }}>
        {on && (
          <Svg width={11} height={11} viewBox="0 0 10 10" style={{ position: "absolute", top: 0, left: -1 }}>
            <Path d="M1.5 5.4 L4 8 L9 1.5" stroke="#000" strokeWidth={1.3} fill="none" />
          </Svg>
        )}
      </View>
      <Text>)</Text>
    </View>
  );
}
function inlineParts(text: string): { key: number; node: React.ReactNode }[] {
  const g = [...graphemes.segment(text)].map((x) => x.segment);
  const out: { key: number; node: React.ReactNode }[] = [];
  for (let i = 0; i < g.length; i++) {
    if (g[i] === "(" && (g[i + 1] === " " || g[i + 1] === ".") && g[i + 2] === ")") {
      out.push({ key: i, node: <InlineBox on={g[i + 1] === "."} /> });
      i += 2;
    } else out.push({ key: i, node: <Text>{g[i]}</Text> });
  }
  return out;
}
function DistributedLine({ text, style, last }: { text: string; style?: Styles[string]; last?: boolean }) {
  return (
    <View style={[{ flexDirection: "row", justifyContent: last ? "flex-start" : "space-between" }, style ?? {}]}>
      {inlineParts(last ? t(text) : text).map((p) => (
        <React.Fragment key={p.key}>{p.node}</React.Fragment>
      ))}
    </View>
  );
}

/** ย่อหน้า — ตัดบรรทัดเองตามความกว้างจริง ทุกบรรทัดยกเว้นบรรทัดสุดท้ายจัดกระจายแบบไทย */
function Para({ text, indent = INDENT, keep }: { text: string; indent?: number; keep?: string[] }) {
  const lines = wrap(text, CONTENT_W - indent - SLACK, CONTENT_W - SLACK, keep);
  return (
    <View style={styles.gap}>
      {lines.map((l, i) => {
        const lineStyle = i === 0 ? { marginLeft: indent } : undefined;
        return <DistributedLine key={i} text={l} style={lineStyle} last={i === lines.length - 1} />;
      })}
    </View>
  );
}

/** "( ) ข้อความ" / "(✓) ข้อความ" — ฟอนต์ไม่มีตัว ✓ จึงวาดเครื่องหมายถูกเอง */
function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
      <Text>(</Text>
      <View style={{ width: 11, height: 11, marginHorizontal: 1 }}>
        {on && (
          <Svg width={11} height={11} viewBox="0 0 10 10" style={{ position: "absolute", top: 0, left: 0 }}>
            <Path d="M1.5 5.4 L4 8 L9 1.5" stroke="#000" strokeWidth={1.3} fill="none" />
          </Svg>
        )}
      </View>
      <Text>)</Text>
      <Text style={{ marginLeft: 4 }}>{t(label)}</Text>
    </View>
  );
}

function Sign({ role, name, marginTop = 18 }: { role: string; name: string | null; marginTop?: number }) {
  return (
    <View style={{ marginLeft: PAGE_W / 2 - PAD_LEFT, marginTop, alignSelf: "flex-start" }} wrap={false}>
      <SignBody role={role} name={name} size={FS} />
    </View>
  );
}

export function ServiceDeliveryDocument({ data: d }: { data: ServiceDeliveryData }) {
  const keep = [d.school_name.replace(/^โรงเรียน/, ""), ...d.vendor_name.split(/\s+/), ...[d.contract_date, d.delivery_date].map((x) => x.replace(/^.*?(พ\.ศ\. \d+)$/, "$1")).filter((x) => x.startsWith("พ.ศ."))];
  const hasPenalty = d.penalty_amount > 0;
  const complete = d.late_days <= 0;
  const right = { alignItems: "flex-end" as const, marginBottom: 6 };
  return (
    <Document title={`ส่งมอบงาน ${d.contract_no} ${d.month_name}`}>
      {/* ๑. ใบส่งมอบงาน */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t("ใบส่งมอบงาน")}</Text>
        <View style={right}>
          <Text>{t(`เขียนที่ ${d.school_name}`)}</Text>
          <Text>{t(`วันที่ ${d.delivery_date}`)}</Text>
        </View>
        <Text>{t("เรื่อง    ส่งมอบงานจ้างและแจ้งหนี้ขอเบิกเงิน")}</Text>
        <Text style={styles.gap}>{t(`เรียน    ผู้อำนวยการ${d.school_name}`)}</Text>
        <Para keep={keep} text={`ตามที่ ${d.school_name} ได้ตกลงจ้างเหมาบริการให้ข้าพเจ้าปฏิบัติงานในตำแหน่ง ${d.role} ตาม ( ) ใบสั่งจ้าง ( ) บันทึกตกลงจ้าง (.) สัญญาจ้าง เลขที่ ${d.contract_no} ลงวันที่ ${d.contract_date} ในวงเงิน ${d.monthly} บาทต่อเดือน นั้น`} />
        <Para keep={keep} text={`บัดนี้ ข้าพเจ้าได้ปฏิบัติตาม ( ) ใบสั่งจ้าง ( ) บันทึกตกลงจ้าง (.) สัญญาจ้าง เสร็จเรียบร้อยแล้ว จึงขอส่งมอบงานจ้าง เพื่อตรวจรับและขอเบิกจ่ายเงิน จำนวน ${d.amount} บาท ${d.amount_text} ต่อไป`} />
        <View style={{ marginLeft: PAGE_W / 2 - PAD_LEFT, marginTop: 14, alignSelf: "flex-start", alignItems: "center" }} wrap={false}>
          <Text>{t("ขอแสดงความนับถือ")}</Text>
          <View style={{ marginTop: 22 }}>
            <SignBody role="" name={d.vendor_name} size={FS} />
          </View>
        </View>
      </Page>

      {/* ๒. ใบตรวจรับพัสดุในงานซื้อหรืองานจ้าง */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t("ใบตรวจรับพัสดุในงานซื้อหรืองานจ้าง")}</Text>
        <View style={right}>
          <Text>{t(`วันที่ ${d.delivery_date}`)}</Text>
        </View>
        <Para keep={keep} text={`ตามหนังสือสัญญา/ข้อตกลง เลขที่ ${d.contract_no} ลงวันที่ ${d.contract_date} ${d.school_name} ได้ตกลงซื้อ/จ้าง กับ ${d.vendor_name} สำหรับโครงการ ${d.project} โดยวิธีเฉพาะเจาะจง เป็นจำนวนเงิน ${d.monthly} บาทต่อเดือน นั้น`} />
        <Para keep={keep} text={`ผู้ตรวจรับพัสดุ/คณะกรรมการตรวจรับพัสดุ ได้ตรวจรับงานประจำเดือน ${d.month_name} ตั้งแต่วันที่ ${d.period_from} ถึงวันที่ ${d.period_to} แล้ว ผลปรากฏว่า`} />
        <Text style={{ marginLeft: INDENT, fontWeight: "bold" }}>{t("ผลการตรวจรับ")}</Text>
        <View style={{ marginLeft: INDENT + 30 }}>
          <View style={{ flexDirection: "row" }}>
            <Check on label="ถูกต้อง" />
          </View>
          <View style={{ flexDirection: "row" }}>
            <Check on={complete} label="ครบถ้วนตามสัญญา" />
          </View>
          <View style={{ flexDirection: "row" }}>
            <Check on={!complete} label="ไม่ครบถ้วนตามสัญญา" />
          </View>
          <Text style={{ marginLeft: 24 }}>{t(complete ? "เนื่องจาก………………………………………………………………………………………………." : `เนื่องจากส่งมอบงานเกินกำหนด ${d.late_days} วัน`)}</Text>
        </View>
        <Text style={{ marginLeft: INDENT, marginTop: 6, fontWeight: "bold" }}>{t("ค่าปรับ")}</Text>
        <View style={{ marginLeft: INDENT + 30 }}>
          <View style={{ flexDirection: "row" }}>
            <Check on={hasPenalty} label={hasPenalty ? `มีค่าปรับ จำนวน ${d.penalty_amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท (${thaiBahtText(d.penalty_amount).replace(/^\(|\)$/g, "")})` : "มีค่าปรับ …………………………………………………………………………………………."} />
          </View>
          <View style={{ flexDirection: "row" }}>
            <Check on={!hasPenalty} label="ไม่มีค่าปรับ" />
          </View>
        </View>
        {d.committee.map((m, i) => (
          <Sign key={i} role={m.role} name={m.name} marginTop={i === 0 ? 22 : 12} />
        ))}
      </Page>
    </Document>
  );
}
