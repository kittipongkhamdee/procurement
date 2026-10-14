import path from "node:path";
import { Document, Font, Image, Line, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, THAI_MONTHS } from "@/lib/thai";
import type { ApprovalPdfData } from "./approval-types";
import { registerSarabunFont, t } from "./thai-pdf";
import { measureText as measureWith, wrapByWidth as wrapWith } from "./thai-measure";

// เอกสารบันทึกข้อความขออนุมัติที่วาดขึ้นใหม่ทั้งหมดด้วย react-pdf (ไม่ใช้เทมเพลต PDF เดิมซ้อนทับ) — ใช้ข้อมูลชุดเดียวกับ
// ApprovalPdfData เหมือนตัวเดิม
//
// รูปแบบหน้า 1 ทำตามแบบกระดาษบันทึกข้อความ (แบบที่ ๒๙ ท้ายระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. ๒๕๒๖)
// และ "คำแนะนำและแบบมาตรฐานการพิมพ์หนังสือราชการภาษาไทยด้วยโปรแกรมการพิมพ์ในเครื่องคอมพิวเตอร์":
//   - ขอบกระดาษ ซ้าย ๒.๕ ซม. ขวา ๒ ซม. บน ๑.๕ ซม. ล่าง ๑ ซม. (แบบกำหนดซ้าย ๓/บน ๒.๕/ล่าง ๒ ซม. — ผู้ใช้ขอลดเอง) (พื้นที่พิมพ์กว้าง ๑๖.๕ ซม.)
//   - ตราครุฑสูง ๑.๕ ซม. ชิดขอบบนของพื้นที่พิมพ์ ชิดซ้าย
//   - ตัวอักษรเนื้อหา ๑๖ พอยท์; "บันทึกข้อความ" ตัวหนา ๒๙ พอยท์ ระยะบรรทัดแน่นอน ๓๕ พอยท์;
//     "ส่วนราชการ ที่ วันที่ เรื่อง" ตัวหนา ๒๐ พอยท์; ใช้จุดไข่ปลาเป็นเส้นบรรทัดหลังคำเหล่านี้
//   - "วันที่" ตรงกับตัวอักษร "ข" ของ "บันทึกข้อความ" และตัวแรกของชื่อเดือนตรงกับแนวหลังของ "ม"
//   - คำขึ้นต้นห่างจากเรื่อง ๑ บรรทัด + ๖ พอยท์; ย่อหน้าข้อความ ๒.๕ ซม.
//   - ลายมือชื่อเริ่มที่แนวกึ่งกลางกระดาษ; ชื่อในวงเล็บและตำแหน่งอยู่กึ่งกลางซึ่งกันและกัน
// ตารางรายการเงิน กรอบความเห็น ๔ ช่อง และตารางรายการวัสดุ (ไม่มีกำหนดในแบบ) ใช้ตัวอักษร ๑๖ พอยท์เท่าเนื้อหา
// (กรอบความเห็นอยู่ท้ายหน้า ๑ ถ้าพื้นที่พอ — ใช้ตัวอักษร ๑๔ พอยท์ และตารางรายการเงินหน้า ๑ ใช้ ๑๕ พอยท์เพื่อให้พอดี;
//  ถ้าข้อความหน้า ๑ ยาวจนไม่พอ กรอบจะย้ายไปหน้า ๒ ทั้งกรอบ; รายการวัสดุอยู่หน้าสุดท้าย ๑๕ พอยท์)
// ฟอนต์: TH Sarabun New (ดูด้านล่าง)

registerSarabunFont();

// ฟอนต์ TH Sarabun New (ออกแบบโดย คุณศุภกิจ เฉลิมลาภ, ลิขสิทธิ์ SIPA) — ฟอนต์สารบรรณตามที่ระเบียบกำหนด (ตระกูลเดียวกับ TH Sarabun PSK)
// ไฟล์ต้นฉบับจากชุดดาวน์โหลดของ f0nt.com (SIPA) ใช้เฉพาะเอกสารนี้ เอกสารอื่นยังใช้ Sarabun เดิม
const FAMILY = "THSarabunNew";
Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Bold.ttf"), fontWeight: "bold" },
  ],
});
const measureText = (text: string, size: number, bold = false) => measureWith(text, size, bold, FAMILY);
const wrapByWidth = (text: string, size: number, first: number, rest: number, bold = false) =>
  wrapWith(text, size, first, rest, bold, FAMILY);

const PAGE_W = 595.28;
const CM = 28.3465; // 1 ซม. เป็นพอยท์
const PAD_LEFT = 2.5 * CM; // ผู้ใช้ขอลดจาก ๓ ซม. ตามแบบ เหลือ ๒.๕ ซม.
const PAD_RIGHT = 2 * CM;
const PAD_TOP = 1.5 * CM; // ผู้ใช้ขอลดจาก ๒.๕ ซม. ตามแบบ เหลือ ๑.๕ ซม.
const PAD_BOTTOM = 1 * CM; // ผู้ใช้ขอลดจาก ๒ ซม. ตามแบบ เหลือ ๑ ซม.
const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT; // ≈ 16.5 ซม.
const FS = 16; // ตัวอักษรเนื้อหา
const FS_LABEL = 20; // "ส่วนราชการ ที่ วันที่ เรื่อง"
const FS_TITLE = 29; // "บันทึกข้อความ"
const TITLE_LINE = 35; // ระยะบรรทัดแน่นอนของ "บันทึกข้อความ"
const FS_TABLE = 15; // ตารางรายการเงิน (หน้า ๑ ต้องเหลือที่ให้กรอบความเห็น จึงเล็กกว่าเนื้อหาเล็กน้อย)
const FS_P23 = 15; // ตัวอักษรหน้า ๒ (กรอบความเห็น ๔ ช่อง) และหน้า ๓ (รายการวัสดุ) — ผู้ใช้กำหนด ๑๕ พอยท์
const FS_BOX = 16; // กรอบความเห็น ๔ ช่อง (อยู่ท้ายหน้า ๑) ใช้ 16pt เท่าเนื้อหา
const FS_BOX_COMPACT = 15; // ย่อเหลือ 15pt เมื่อเนื้อหาด้านบนยาวจนกรอบ 16pt จะล้นหน้า ๑ (ดู boxFontSize)
/** จำนวนบรรทัด (หลังตัดคำ) ของ เรื่อง/ด้วย/จัดกิจกรรม/ตามโครงการ ที่กรอบ 16pt ยังพอดีหน้า ๑ — วัดจากเอกสารทดสอบ:
 * ๗ บรรทัดเหลือที่ว่างล่างราว ๑๑pt, ๘ บรรทัดเกินราว ๗pt (๑๕pt ประหยัดได้ราว ๑๗pt) */
const BOX_MAX_BODY_LINES_AT_FULL = 7;
const GARUDA_H = 1.5 * CM;
const GARUDA_W = (GARUDA_H * 659) / 738;
const INDENT = 2.5 * CM; // ย่อหน้า
const INK = "#000000";
const GARUDA = path.join(process.cwd(), "src/lib/pdf/assets/garuda-emblem.png");

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.3, color: INK, paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  // แถวที่มีเส้นจุดไข่ปลา: จัดชิดขอบล่าง + ทุกองค์ประกอบในแถวใช้ lineHeight เท่ากัน เส้นจุดจึงอยู่ห่างจากตัวอักษรเท่ากันทุกแถว
  // (ถ้าปล่อยเป็น stretch ช่องที่เป็นเส้นจุดจะถูกยืดตามป้ายหน้า/หลังที่สูงกว่า ทำให้เส้นอยู่ห่างตัวอักษรไม่เท่ากัน)
  row: { flexDirection: "row", alignItems: "flex-end", lineHeight: 1.0, marginBottom: 1.5 },
  bold: { fontWeight: "bold" },
  // กรอบของช่องที่มีเส้นจุดไข่ปลาอยู่ใต้ค่า — เส้นจุดวาดด้วย <DotLeader /> (ไม่ใช้ borderBottomStyle: "dotted" เพราะ
  // react-pdf วาดเป็นเส้นทึบใต้ตัวหนังสือที่อยู่เหนือมัน)
  dotted: { position: "relative", paddingBottom: 0.5, overflow: "hidden", lineHeight: 1.0 },
});

/** เส้นจุดไข่ปลาใต้ช่อง — ใส่เป็นลูกตัวสุดท้ายของ View ที่ใช้ style dotted */
function DotLeader() {
  return (
    <Svg width={1200} height={1.5} style={{ position: "absolute", left: 0, bottom: 0 }}>
      <Line x1={0} y1={0.75} x2={1200} y2={0.75} stroke={INK} strokeWidth={0.7} strokeDasharray="0.7 2.1" strokeLinecap="round" />
    </Svg>
  );
}

type Style = NonNullable<React.ComponentProps<typeof View>["style"]>;

function Dotted({ style, children }: { style?: Style; children: React.ReactNode }) {
  return (
    <View style={[styles.dotted, style ?? {}]}>
      {children}
      <DotLeader />
    </View>
  );
}

type FieldRowProps = {
  prefix?: string;
  prefixBold?: boolean;
  /** ขนาดตัวอักษรของป้ายหน้า (ค่าเริ่มต้น = size) */
  prefixSize?: number;
  value: string;
  suffix?: string;
  /** ขนาดตัวอักษรของค่าและป้ายท้าย */
  size?: number;
  /** ย่อหน้าบรรทัดแรก (pt) */
  indent?: number;
  /** ความกว้างทั้งแถว (ค่าเริ่มต้น = ความกว้างเนื้อหาหน้ากระดาษ) */
  width?: number;
  /** ความกว้างคงที่ของช่องค่า (บรรทัดเดียว) แทนการยืดเต็มบรรทัด */
  valueWidth?: number;
  align?: "left" | "center" | "right";
  /** ระยะห่างใต้แถว (ค่าเริ่มต้น 2pt) */
  rowGap?: number;
};

const GAP = 4;
/** เผื่อความกว้างตอนตัดบรรทัดเอง — react-pdf วัดข้อความ (รวมช่องว่างท้าย) กว้างกว่าที่เราวัดเล็กน้อย ถ้าไม่เผื่อจะตัดซ้ำเอง */
const WRAP_SLACK = 10;

/** ตัดบรรทัดของ FieldRow แบบไม่มี valueWidth — ใช้ร่วมกันระหว่างการวาดและการนับบรรทัดเพื่อเลือกขนาดกรอบความเห็น */
function fieldRowLines(o: {
  prefix?: string;
  prefixBold?: boolean;
  prefixSize?: number;
  value: string;
  suffix?: string;
  size?: number;
  indent?: number;
  width?: number;
}): string[] {
  const { prefix = "", prefixBold = false, value, suffix = "", size = FS, indent = 0, width = CONTENT_W } = o;
  const pSize = o.prefixSize ?? size;
  const prefixW = prefix ? measureText(prefix, pSize, prefixBold) + GAP : 0;
  const suffixW = suffix ? measureText(suffix, size) + GAP : 0;
  const first = width - indent - prefixW - suffixW - WRAP_SLACK;
  const rest = width - suffixW - WRAP_SLACK;
  return wrapByWidth(value, size, Math.max(first, 40), Math.max(rest, 40));
}

/** แถว "ป้ายหน้า + ค่าบนเส้นจุดไข่ปลา + ป้ายท้าย" — ค่ายาวตัดขึ้นบรรทัดใหม่ล่วงหน้าตามความกว้างจริงของฟอนต์
 * โดยแต่ละบรรทัดมีเส้นจุดไข่ปลาของตัวเอง เหมือนฟอร์มกระดาษ */
function FieldRow({
  prefix = "",
  prefixBold = false,
  prefixSize,
  value,
  suffix = "",
  size = FS,
  indent = 0,
  width = CONTENT_W,
  valueWidth,
  align = "left",
  rowGap = 1.5,
}: FieldRowProps) {
  const pSize = prefixSize ?? size;
  const prefixEl = prefix ? (
    <Text style={[prefixBold ? styles.bold : {}, { fontSize: pSize, marginRight: GAP }]}>{t(prefix)}</Text>
  ) : null;
  const suffixEl = suffix ? <Text style={{ fontSize: size, marginLeft: GAP }}>{t(suffix)}</Text> : null;

  if (valueWidth) {
    return (
      <View style={[styles.row, { marginBottom: rowGap }]}>
        {indent > 0 && <View style={{ width: indent }} />}
        {prefixEl}
        <Dotted style={{ width: valueWidth }}>
          <Text style={{ fontSize: size, textAlign: align }}>{value ? t(value) : " "}</Text>
        </Dotted>
        {suffixEl}
      </View>
    );
  }

  const lines = fieldRowLines({ prefix, prefixBold, prefixSize, value, suffix, size, indent, width });
  return (
    <>
      {lines.map((line, i) => {
        const isFirst = i === 0;
        const isLast = i === lines.length - 1;
        return (
          <View key={i} style={[styles.row, { marginBottom: rowGap }]}>
            {isFirst && indent > 0 && <View style={{ width: indent }} />}
            {isFirst ? prefixEl : null}
            <Dotted style={{ flex: 1 }}>
              {!isLast && line ? (
                <DistributedLine text={line} size={size} />
              ) : (
                <Text style={{ fontSize: size, textAlign: align }}>{line ? t(line) : " "}</Text>
              )}
            </Dotted>
            {isLast ? suffixEl : null}
          </View>
        );
      })}
    </>
  );
}

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/** บรรทัดแบบ "กระจายแบบไทย" (Thai Distributed) — ใช้กับทุกบรรทัดของข้อความหลายบรรทัดยกเว้นบรรทัดสุดท้าย:
 * แบ่งเป็นกลุ่มอักษร (พยัญชนะ+สระ/วรรณยุกต์ไม่แยกกัน) แล้วเกลี่ยช่องว่างให้เต็มความกว้าง */
function DistributedLine({ text, size }: { text: string; size: number }) {
  const parts = [...graphemes.segment(text)].map((g) => g.segment);
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {parts.map((g, i) => (
        <Text key={i} style={{ fontSize: size }}>
          {g === " " ? "\u00a0" : g}
        </Text>
      ))}
    </View>
  );
}

/** ข้อความหลายบรรทัดแบบไม่มีเส้นจุด (เช่น "เรียน ...") ตัดคำเองล่วงหน้า */
function PlainRow({ prefix, value, width = CONTENT_W }: { prefix?: string; value: string; width?: number }) {
  const prefixW = prefix ? measureText(prefix, FS) + 8 : 0;
  const lines = wrapByWidth(value, FS, width - prefixW - WRAP_SLACK, width - prefixW - WRAP_SLACK);
  return (
    <View style={[styles.row, { alignItems: "flex-start", lineHeight: 1.3 }]}>
      {prefix ? <Text style={{ width: prefixW }}>{t(prefix)}</Text> : null}
      <View style={{ flex: 1 }}>
        {lines.map((l, i) => (i < lines.length - 1 ? <DistributedLine key={i} text={l} size={FS} /> : <Text key={i}>{t(l)}</Text>))}
      </View>
    </View>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={{ width: 11, height: 11, borderWidth: 0.8, borderColor: INK, marginRight: 4, marginTop: 2 }}>
      {checked && (
        <Svg width={9.4} height={9.4} viewBox="0 0 10 10" style={{ position: "absolute", top: 0, left: 0 }}>
          <Path d="M1.8 5.4 L4.1 7.9 L8.6 1.9" stroke={INK} strokeWidth={1.3} fill="none" />
        </Svg>
      )}
    </View>
  );
}

function CheckRow({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.row, { alignItems: "flex-start", marginBottom: 0 }]}>
      <CheckBox checked={checked} />
      {children}
    </View>
  );
}

const SUMMARY_DEFAULT_LABELS = ["จัดซื้อจัดจ้าง", "ค่าเบี้ยเลี้ยง/ค่าตอบแทน", "ค่าเดินทางไปราชการ", "ค่าสาธารณูปโภค", "อื่นๆ (ระบุ)"];

const SUMMARY_COLS = { no: 30, amount: 84, note: 84 };

function SummaryTable({ data }: { data: ApprovalPdfData }) {
  const rows = SUMMARY_DEFAULT_LABELS.map((label, i) => data.summary_items[i] ?? { label, amount: null, note: null });
  const total = data.summary_items.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const cell = { borderRightWidth: 0.8, borderColor: INK, paddingHorizontal: 4, justifyContent: "center" as const };
  const rowStyle = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, minHeight: 17 };
  const hd = [styles.bold, { textAlign: "center" as const }];
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginBottom: 2, fontSize: FS_TABLE, lineHeight: 1.05 }}>
      <View style={rowStyle}>
        <View style={[cell, { width: SUMMARY_COLS.no }]}><Text style={hd}>{t("ที่")}</Text></View>
        <View style={[cell, { flex: 1 }]}><Text style={hd}>{t("รายการ")}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.amount }]}><Text style={hd}>{t("จำนวนเงิน")}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.note, borderRightWidth: 0 }]}><Text style={hd}>{t("หมายเหตุ")}</Text></View>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={rowStyle}>
          <View style={[cell, { width: SUMMARY_COLS.no }]}><Text style={{ textAlign: "center" }}>{i + 1}</Text></View>
          <View style={[cell, { flex: 1 }]}><Text>{t(r.label)}</Text></View>
          <View style={[cell, { width: SUMMARY_COLS.amount }]}><Text style={{ textAlign: "right" }}>{r.amount ? formatBaht(r.amount) : ""}</Text></View>
          <View style={[cell, { width: SUMMARY_COLS.note, borderRightWidth: 0 }]}><Text>{t(r.note ?? "")}</Text></View>
        </View>
      ))}
      <View style={[rowStyle, { borderBottomWidth: 0 }]}>
        <View style={[cell, { width: SUMMARY_COLS.no }]} />
        <View style={[cell, { flex: 1 }]}><Text style={hd}>{t("รวมทั้งสิ้น")}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.amount }]}><Text style={[styles.bold, { textAlign: "right" }]}>{formatBaht(total)}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.note, borderRightWidth: 0 }]} />
      </View>
    </View>
  );
}

/** ลายมือชื่อ "(ลงชื่อ)……… <ตำแหน่ง>" + ชื่อในวงเล็บใต้เส้น — ชื่อเริ่มที่แนวเดียวกับ ")" ของ "(ลงชื่อ)" */
function SignatureBlock({ suffix, name, size = FS, valueWidth = 90 }: { suffix: string; name: string | null; size?: number; valueWidth?: number }) {
  const nameLeft = measureText("(ลงชื่อ", size);
  return (
    <View style={{ alignItems: "flex-start" }}>
      <FieldRow prefix="(ลงชื่อ)" value="" suffix={suffix} size={size} valueWidth={valueWidth} />
      <Text style={{ fontSize: size, marginLeft: nameLeft }}>{t(name ? `(${name})` : "(                                    )")}</Text>
    </View>
  );
}

const CELL_PAD = 2.5;
const CELL_W = CONTENT_W / 2 - CELL_PAD * 2;

function OpinionTitle({ no, title }: { no: number; title: string }) {
  return (
    <Text>
      {t(`${no}. `)}
      <Text style={{ textDecoration: "underline" }}>{t(title)}</Text>
    </Text>
  );
}

function SignOff({ name, role, size = FS_BOX }: { name: string | null; role?: string; size?: number }) {
  return (
    <View style={{ alignItems: "center", marginTop: 1, lineHeight: 1.05 }}>
      <FieldRow prefix="(ลงชื่อ)" value="" valueWidth={120} width={CELL_W} size={size} rowGap={0} />
      <Text>{t(name ? `(${name})` : "(                                    )")}</Text>
      {role ? <Text>{t(role)}</Text> : null}
    </View>
  );
}

function OpinionBoxes({ data, size }: { data: ApprovalPdfData; size: number }) {
  const cellStyle = { flex: 1, padding: CELL_PAD };
  const approved = data.status === "อนุมัติ";
  const rejected = data.status === "ไม่อนุมัติ";
  const d = data.approved_at ? new Date(data.approved_at) : null;
  const line = { marginBottom: 0 };
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, fontSize: size, lineHeight: 1.05 }} wrap={false}>
      <View style={{ flexDirection: "row", borderBottomWidth: 0.8, borderColor: INK }}>
        <View style={[cellStyle, { borderRightWidth: 0.8, borderColor: INK }]}>
          <OpinionTitle no={1} title="ความเห็นงานแผนงาน" />
          <Text style={line}>{t("- ตรวจสอบแล้วมีโครงการ")}</Text>
          <FieldRow size={size} prefix="- เงินโครงการทั้งสิ้น" value={data.budget != null ? formatBaht(data.budget) : ""} suffix="บาท" valueWidth={74} align="right" rowGap={0} />
          <FieldRow size={size} prefix="- เงินขอใช้ครั้งนี้" value={formatBaht(data.requested_amount)} suffix="บาท" valueWidth={86} align="right" rowGap={0} />
          <FieldRow size={size} prefix="- เงินโครงการเหลือ" value={data.remaining != null ? formatBaht(data.remaining) : ""} suffix="บาท" valueWidth={80} align="right" rowGap={0} />
          <SignOff size={size} name={data.signer_planning} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={2} title="ความเห็นเจ้าหน้าที่การเงิน" />
          <Text style={line}>{t("- ตรวจสอบแล้วมีงบประมาณ")}</Text>
          <CheckRow checked={data.fund_type === "งบค่าจัดการเรียนการสอน"}><Text>{t("งบค่าจัดการเรียนการสอน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน"}><Text>{t("งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "เงินรายได้สถานศึกษา"}><Text>{t("เงินรายได้สถานศึกษา")}</Text></CheckRow>
          <SignOff size={size} name={data.signer_finance} />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={[cellStyle, { borderRightWidth: 0.8, borderColor: INK }]}>
          <OpinionTitle no={3} title="ความเห็นของรองผู้อำนวยการ" />
          <Text style={line}>{t("- ตรวจสอบแล้วมีโครงการและงบประมาณ")}</Text>
          <CheckRow checked={data.deputy_decision === "ควร"}><Text>{t("ควรอนุญาตและอนุมัติ")}</Text></CheckRow>
          <CheckRow checked={data.deputy_decision === "ไม่ควร"}>
            <Text>{t("ไม่ควรอนุญาตและอนุมัติเพราะ")}</Text>
            <Dotted style={{ flex: 1, marginLeft: GAP }}><Text> </Text></Dotted>
          </CheckRow>
          <SignOff size={size} name={data.signer_deputy} role={`รองผู้อำนวยการ${data.school_name}`} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={4} title="ความเห็นของผู้อำนวยการโรงเรียน" />
          <Text style={line}>{t("- ตรวจสอบโครงการและงบประมาณ")}</Text>
          <View style={styles.row}>
            <CheckRow checked={approved}><Text>{t("อนุมัติ")}</Text></CheckRow>
            <View style={{ width: 28 }} />
            <CheckRow checked={rejected}><Text>{t("ไม่อนุมัติ")}</Text></CheckRow>
          </View>
          <SignOff size={size} name={data.signer_director} role={`ผู้อำนวยการ${data.school_name}`} />
          <View style={[styles.row, { marginTop: 2, marginBottom: 0, justifyContent: "center" }]}>
            <Text>{t("วันที่")}</Text>
            <Dotted style={{ width: 26, marginHorizontal: GAP }}><Text style={{ textAlign: "center" }}>{d ? String(d.getDate()) : " "}</Text></Dotted>
            <Text>{t("เดือน")}</Text>
            <Dotted style={{ width: 62, marginHorizontal: GAP }}><Text style={{ textAlign: "center" }}>{d ? t(THAI_MONTHS[d.getMonth() + 1]) : " "}</Text></Dotted>
            <Text>{t("พ.ศ.")}</Text>
            <Dotted style={{ width: 36, marginLeft: GAP }}><Text style={{ textAlign: "center" }}>{d ? String(d.getFullYear() + 543) : " "}</Text></Dotted>
          </View>
        </View>
      </View>
    </View>
  );
}

/** ข้อความบรรทัดเดียวในช่องตารางที่กว้างจำกัด — ย่อขนาดตัวอักษรลงทีละน้อยจนพอดีช่อง (ไม่ต่ำกว่า minSize) ก่อนที่
 * react-pdf จะตัดเป็น "…" เอง เพราะแถวสูงตายตัว ถ้าย่อถึงขั้นต่ำแล้วยังไม่พอจึงปล่อยให้ตัดท้าย */
function FitText({ text, width, size, minSize = 9.5, bold = false, align = "left" }: {
  text: string;
  width: number;
  size: number;
  minSize?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
}) {
  let fs = size;
  while (fs > minSize && measureText(text, fs, bold) > width) fs -= 0.5;
  return <Text style={[bold ? styles.bold : {}, { fontSize: fs, textAlign: align }]}>{text ? t(text) : ""}</Text>;
}

/** จำนวนแถวรายการวัสดุต่อหน้า — เกินนี้ขึ้นหน้าถัดไปพร้อมหัวตารางซ้ำ (ผ่านการทดสอบว่าพอดีหน้าแม้หัวตารางยาว ๔ บรรทัด) */
const ITEMS_PER_PAGE = 29;
/** จำนวนแถวมากสุดของหน้าสุดท้าย — ต้องเหลือที่ให้บล็อกลงชื่อผู้ขออนุมัติท้ายตาราง */
const ITEMS_LAST_PAGE = 24;
/** รายการน้อยกว่านี้ให้เติมแถวว่างจนครบ (ไว้เขียนเพิ่มด้วยมือ) */
const ITEMS_MIN_ROWS = 5;

/** แบ่งรายการเป็นหน้า: หน้าละไม่เกิน ITEMS_PER_PAGE และหน้าสุดท้ายไม่เกิน ITEMS_LAST_PAGE (เหลือที่ให้ลายมือชื่อ) —
 * ถ้าเกิน จะดึงแถวมาเหลือไว้หน้าสุดท้ายอย่างน้อย ๕ แถว ไม่ปล่อยให้หน้าสุดท้ายมีแต่ลายมือชื่อ */
function paginateItems<T>(items: T[]): T[][] {
  const pages: T[][] = [];
  let rest = items;
  while (rest.length > ITEMS_LAST_PAGE) {
    const take = Math.min(ITEMS_PER_PAGE, rest.length - ITEMS_MIN_ROWS);
    pages.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  if (rest.length > 0 || pages.length === 0) pages.push(rest);
  return pages;
}
const ITEM_ROW_H = 20.4;
const ITEM_COLS = { no: 30, qty: 68, price: 68, total: 68, note: 56 };

function ItemsTable({ items, startNo = 1 }: { items: ApprovalPdfData["items"]; startNo?: number }) {
  // พิมพ์เฉพาะแถวที่ใช้จริง ยกเว้นน้อยกว่า ITEMS_MIN_ROWS รายการ ให้เติมแถวว่างจนครบ
  const rowsCount = Math.max(ITEMS_MIN_ROWS, items.length);
  const nameW = CONTENT_W - ITEM_COLS.no - ITEM_COLS.qty - ITEM_COLS.price - ITEM_COLS.total - ITEM_COLS.note;
  const cell = { borderRightWidth: 0.8, borderColor: INK, paddingHorizontal: 4, justifyContent: "center" as const };
  const row = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, height: ITEM_ROW_H };
  const hd = [styles.bold, { textAlign: "center" as const }];
  // lineHeight ต่ำ: Text ในแถวที่กำหนดความสูงตายตัวจะถูกซ่อน/ตัดเป็น "…" ถ้าความสูงบรรทัดเกินความสูงแถว
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginTop: 8, fontSize: FS_P23, lineHeight: 1.05 }}>
      <View style={[row, { height: 38 }]}>
        <View style={[cell, { width: ITEM_COLS.no }]}><Text style={hd}>{t("ที่")}</Text></View>
        <View style={[cell, { flex: 1 }]}><Text style={hd}>{t("รายการ")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.qty }]}>
          <Text style={hd}>{t("จำนวน")}</Text>
          <Text style={hd}>{t("(หน่วย)")}</Text>
        </View>
        <View style={[cell, { width: ITEM_COLS.price }]}><Text style={hd}>{t("ราคา/หน่วย")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.total }]}><Text style={hd}>{t("จำนวนเงิน")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.note, borderRightWidth: 0 }]}><Text style={hd}>{t("หมายเหตุ")}</Text></View>
      </View>
      {Array.from({ length: rowsCount }).map((_, i) => {
        const item = items[i];
        const last = i === rowsCount - 1;
        return (
          <View key={i} style={[row, last ? { borderBottomWidth: 0 } : {}]}>
            <View style={[cell, { width: ITEM_COLS.no }]}><FitText text={String(startNo + i)} width={ITEM_COLS.no - 8} size={FS_P23} align="center" /></View>
            <View style={[cell, { flex: 1 }]}><FitText text={item?.name ?? ""} width={nameW - 10} size={FS_P23} /></View>
            <View style={[cell, { width: ITEM_COLS.qty }]}><FitText text={item?.qty != null ? `${item.qty}${item.unit ? ` ${item.unit}` : ""}` : ""} width={ITEM_COLS.qty - 10} size={FS_P23} align="center" /></View>
            <View style={[cell, { width: ITEM_COLS.price }]}><FitText text={item?.unit_price != null ? formatBaht(item.unit_price) : ""} width={ITEM_COLS.price - 10} size={FS_P23} align="right" /></View>
            <View style={[cell, { width: ITEM_COLS.total }]}><FitText text={item?.total != null ? formatBaht(item.total) : ""} width={ITEM_COLS.total - 10} size={FS_P23} align="right" /></View>
            <View style={[cell, { width: ITEM_COLS.note, borderRightWidth: 0 }]}><FitText text={item?.note ?? ""} width={ITEM_COLS.note - 10} size={FS_P23} /></View>
          </View>
        );
      })}
    </View>
  );
}

/** "ส่วนราชการ" — ชื่อโรงเรียน + อำเภอ/จังหวัดที่ดึงจากที่อยู่โรงเรียนในหน้าตั้งค่า (ถ้าไม่มีใช้เฉพาะชื่อโรงเรียน) */
function governmentUnit(data: ApprovalPdfData): string {
  const address = data.school_address ?? "";
  const amphoe = address.match(/อำเภอ\s*\S+/)?.[0]?.replace(/\s+/, "");
  const province = address.match(/จังหวัด\s*\S+/)?.[0]?.replace(/\s+/, "");
  return [data.school_name, amphoe, province].filter(Boolean).join(" ");
}

/** เรื่อง = หัวเรื่องที่กรอก + ชื่อโครงการ (ตัดคำว่า "โครงการ" ท้ายหัวเรื่องออกถ้าชื่อโครงการขึ้นต้นด้วยคำนี้อยู่แล้ว) */
function subjectLine(data: ApprovalPdfData): string {
  const project = data.project_name?.trim() ?? "";
  if (!project) return data.subject;
  const base = project.startsWith("โครงการ") ? data.subject.replace(/โครงการ\s*$/, "") : data.subject;
  return `${base.trim()} ${project}`;
}

function docNumberText(raw: string | null): string {
  if (!raw) return "";
  return /^\d/.test(raw) ? `งป/${raw}` : raw;
}

/** "จะดำเนินการวันที่ … และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน … บาท ดังนี้" ต่อกันในบรรทัดเดียว — ช่องวันที่ขยายตาม
 * พื้นที่ที่เหลือ (ถ้าแคบเกินไปจริงๆ จะแยกส่วนจำนวนเงินลงบรรทัดใหม่แทน) */
function PlanDateAndAmount({ data }: { data: ApprovalPdfData }) {
  const lead = "จะดำเนินการวันที่";
  const mid = "และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน";
  const tail = "บาท ดังนี้";
  const amount = formatBaht(data.requested_amount);
  const amountW = Math.max(50, measureText(amount, FS) + 10);
  const fixed = [lead, mid, tail].reduce((sum, txt) => sum + measureText(txt, FS), 0) + GAP * 4;
  const dateW = CONTENT_W - fixed - amountW;
  // วันที่จริงต้องใส่ในช่องได้ ไม่งั้นแยกส่วนจำนวนเงินลงบรรทัดใหม่
  const dateNeeded = measureText(data.plan_date_text ?? "", FS) + 10;
  if (dateW < dateNeeded) {
    return (
      <>
        <FieldRow prefix={lead} value={data.plan_date_text ?? ""} suffix="และขออนุมัติงบประมาณ" valueWidth={Math.max(dateNeeded, 120)} />
        <FieldRow prefix="ในครั้งนี้ จำนวนเงิน" value={amount} suffix={tail} valueWidth={110} align="right" />
      </>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={{ marginRight: GAP }}>{t(lead)}</Text>
      <Dotted style={{ width: dateW }}>
        <Text>{data.plan_date_text ? t(data.plan_date_text) : " "}</Text>
      </Dotted>
      <Text style={{ marginHorizontal: GAP }}>{t(mid)}</Text>
      <Dotted style={{ width: amountW }}>
        <Text style={{ textAlign: "right" }}>{amount}</Text>
      </Dotted>
      <Text style={{ marginLeft: GAP }}>{t(tail)}</Text>
    </View>
  );
}

const TITLE = "บันทึกข้อความ";
const TITLE_W = measureText(TITLE, FS_TITLE, true);
const TITLE_LEFT = (CONTENT_W - TITLE_W) / 2;
/** ตำแหน่ง (จากขอบซ้ายของพื้นที่พิมพ์) ของตัวอักษร "ข" ใน "บันทึกข้อความ" — "วันที่" พิมพ์ตรงกับตำแหน่งนี้ */
const X_KHO = TITLE_LEFT + measureText("บันทึก", FS_TITLE, true);
/** แนวหลังของตัวอักษร "ม" — ตัวแรกของชื่อเดือนพิมพ์ตรงกับตำแหน่งนี้ */
const X_MO_END = TITLE_LEFT + TITLE_W;

/** แถว "ที่ … วันที่ …" ตามแบบ: "วันที่" ตรงกับ "ข", ชื่อเดือนเริ่มที่แนวหลังของ "ม" */
function DocNumberAndDate({ data }: { data: ApprovalPdfData }) {
  const thi = "ที่";
  const wanThi = "วันที่";
  const thiW = measureText(thi, FS_LABEL, true) + GAP;
  const wanThiW = measureText(wanThi, FS_LABEL, true) + GAP;
  const [day, ...rest] = (data.doc_date ? formatThaiDate(data.doc_date) : "").split(" ");
  return (
    <View style={[styles.row, { marginBottom: 2 }]}>
      <Text style={[styles.bold, { fontSize: FS_LABEL, marginRight: GAP }]}>{t(thi)}</Text>
      <Dotted style={{ width: X_KHO - thiW - GAP }}>
        <Text>{t(docNumberText(data.doc_number)) || " "}</Text>
      </Dotted>
      <Text style={[styles.bold, { fontSize: FS_LABEL, marginLeft: GAP, marginRight: GAP }]}>{t(wanThi)}</Text>
      <Dotted style={{ width: X_MO_END - X_KHO - wanThiW - GAP }}>
        <Text style={{ textAlign: "center" }}>{day || " "}</Text>
      </Dotted>
      <Dotted style={{ flex: 1, marginLeft: GAP }}>
        <Text>{rest.length ? t(rest.join(" ")) : " "}</Text>
      </Dotted>
    </View>
  );
}

/** หัวบันทึกข้อความ (ตราครุฑ + "บันทึกข้อความ" + ส่วนราชการ / ที่ … วันที่ … / เรื่อง + เส้นคั่น) ตามแบบที่ ๒๙ —
 * ใช้ร่วมกับเอกสารอื่นที่เป็นบันทึกข้อความ (เช่น หน้า ๓ ของชุดเอกสารส่งมอบงาน) ให้ตำแหน่งและเส้นจุดเหมือนกัน */
export function MemoHeader({ unit, docNumber, isoDate, subject }: { unit: string; docNumber: string | null; isoDate: string | null; subject: string }) {
  const thiW = measureText("ที่", FS_LABEL, true) + GAP;
  const wanThiW = measureText("วันที่", FS_LABEL, true) + GAP;
  const [day, ...rest] = (isoDate ? formatThaiDate(isoDate) : "").split(" ");
  return (
    <View style={{ fontFamily: FAMILY, fontSize: FS }}>
      <View style={{ height: GARUDA_H, marginBottom: 3 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> ของ @react-pdf/renderer ไม่ใช่ <img> ของ HTML (ไม่มี prop alt) */}
        <Image src={GARUDA} style={{ position: "absolute", left: 0, top: 0, width: GARUDA_W, height: GARUDA_H }} />
        <View style={{ position: "absolute", left: 0, right: 0, top: (GARUDA_H - TITLE_LINE) / 2 }}>
          <Text style={{ fontSize: FS_TITLE, fontWeight: "bold", lineHeight: TITLE_LINE / FS_TITLE, textAlign: "center" }}>{t(TITLE)}</Text>
        </View>
      </View>
      <View style={[styles.row, { marginBottom: 2 }]}>
        <Text style={[styles.bold, { fontSize: FS_LABEL, marginRight: GAP }]}>{t("ส่วนราชการ")}</Text>
        <Dotted style={{ flex: 1 }}>
          <Text>{t(unit)}</Text>
        </Dotted>
      </View>
      <View style={[styles.row, { marginBottom: 2 }]}>
        <Text style={[styles.bold, { fontSize: FS_LABEL, marginRight: GAP }]}>{t("ที่")}</Text>
        <Dotted style={{ width: X_KHO - thiW - GAP }}>
          <Text>{t(docNumber ?? "") || " "}</Text>
        </Dotted>
        <Text style={[styles.bold, { fontSize: FS_LABEL, marginLeft: GAP, marginRight: GAP }]}>{t("วันที่")}</Text>
        <Dotted style={{ width: X_MO_END - X_KHO - wanThiW - GAP }}>
          <Text style={{ textAlign: "center" }}>{day || " "}</Text>
        </Dotted>
        <Dotted style={{ flex: 1, marginLeft: GAP }}>
          <Text>{rest.length ? t(rest.join(" ")) : " "}</Text>
        </Dotted>
      </View>
      <FieldRow prefix="เรื่อง" prefixBold prefixSize={FS_LABEL} value={subject} />
      <View style={{ borderBottomWidth: 0.9, borderBottomColor: INK, marginTop: 2, marginBottom: 2 }} />
    </View>
  );
}

/** ขนาดฟอนต์กรอบความเห็น: 16pt ถ้าเนื้อหาด้านบนไม่ยาวเกิน ไม่เช่นนั้นย่อเป็น 15pt ให้ยังพอดีหน้า ๑ */
function boxFontSize(data: ApprovalPdfData): number {
  const lines =
    fieldRowLines({ prefix: "เรื่อง", prefixBold: true, prefixSize: FS_LABEL, value: subjectLine(data) }).length +
    fieldRowLines({ prefix: "ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน)", value: data.department ?? "", indent: INDENT }).length +
    fieldRowLines({ prefix: "จะดำเนินการจัดกิจกรรม (ชื่อกิจกรรม)", value: data.activity_name ?? "" }).length +
    fieldRowLines({ prefix: "ตามโครงการ/งาน", value: data.project_name ?? "" }).length;
  return lines > BOX_MAX_BODY_LINES_AT_FULL ? FS_BOX_COMPACT : FS_BOX;
}

export function ApprovalDocument({ data }: { data: ApprovalPdfData }) {
  // ไม่มีรายการเลย = ไม่มีหน้ารายการวัสดุ
  const itemPages = data.items.length > 0 ? paginateItems(data.items) : [];
  return (
    <Document title={`บันทึกข้อความขออนุมัติ ${data.doc_number ?? ""}`}>
      <Page size="A4" style={styles.page}>
        {/* ตราครุฑสูง 1.5 ซม. ชิดซ้าย — ชื่อ "บันทึกข้อความ" ตัวหนา 29 พอยท์ ระยะบรรทัด 35 พอยท์ อยู่กลางพื้นที่พิมพ์ */}
        <View style={{ height: GARUDA_H, marginBottom: 3 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> ของ @react-pdf/renderer ไม่ใช่ <img> ของ HTML (ไม่มี prop alt) */}
          <Image src={GARUDA} style={{ position: "absolute", left: 0, top: 0, width: GARUDA_W, height: GARUDA_H }} />
          <View style={{ position: "absolute", left: 0, right: 0, top: (GARUDA_H - TITLE_LINE) / 2 }}>
            <Text style={{ fontSize: FS_TITLE, fontWeight: "bold", lineHeight: TITLE_LINE / FS_TITLE, textAlign: "center" }}>{t(TITLE)}</Text>
          </View>
        </View>

        <View style={[styles.row, { marginBottom: 2 }]}>
          <Text style={[styles.bold, { fontSize: FS_LABEL, marginRight: GAP }]}>{t("ส่วนราชการ")}</Text>
          <Dotted style={{ flex: 1 }}>
            <Text>{t(governmentUnit(data))}</Text>
          </Dotted>
        </View>

        <DocNumberAndDate data={data} />

        <FieldRow prefix="เรื่อง" prefixBold prefixSize={FS_LABEL} value={subjectLine(data)} />
        <View style={{ borderBottomWidth: 0.9, borderBottomColor: INK, marginTop: 2, marginBottom: 2 }} />

        <View style={{ marginTop: 4 }}>
          <PlainRow prefix="เรียน" value={data.addressed_to} />
        </View>

        <FieldRow prefix="ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน)" value={data.department ?? ""} indent={INDENT} />
        <FieldRow prefix="จะดำเนินการจัดกิจกรรม (ชื่อกิจกรรม)" value={data.activity_name ?? ""} />
        <FieldRow prefix="ตามโครงการ/งาน" value={data.project_name ?? ""} />
        <PlanDateAndAmount data={data} />

        {/* ตารางรายการเงิน ต่อจาก "ดังนี้" แล้วจึงตามด้วย "จึงเรียนมา…" และลายมือชื่อ */}
        <View wrap={false} style={{ marginTop: 2 }}>
          <SummaryTable data={data} />
        </View>

        <View style={[styles.row, { paddingLeft: INDENT }]}>
          <Text>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตและอนุมัติ")}</Text>
        </View>

        {/* ลายมือชื่อเริ่มที่แนวกึ่งกลางกระดาษ; ชื่อในวงเล็บเริ่มที่แนวเดียวกับ ")" ของ "(ลงชื่อ)" */}
        <View style={{ marginLeft: PAGE_W / 2 - PAD_LEFT, marginTop: 8, marginBottom: 2 }}>
          <SignatureBlock suffix="ผู้รับผิดชอบโครงการ" name={data.requested_by_name} />
        </View>

        {/* กรอบความเห็น ๔ ช่อง — ต่อท้ายหน้า ๑ ถ้าพื้นที่พอ ไม่พอจะย้ายทั้งกรอบไปหน้าถัดไป (wrap={false}) */}
        <OpinionBoxes data={data} size={boxFontSize(data)} />
      </Page>

      {/* หน้ารายการวัสดุ อุปกรณ์ (ไม่ใช่ส่วนบันทึกข้อความ) — ไม่มีรายการเลย = ไม่มีหน้านี้, น้อยกว่า ๕ รายการเติมแถวว่างให้ครบ ๕,
          แถวเกินต่อหน้าถัดไปพร้อมหัวข้อและหัวตารางซ้ำ, ท้ายตารางหน้าสุดท้ายมีลายมือชื่อผู้ขออนุมัติ */}
      {itemPages.map((pageItems, pi) => (
        <Page key={pi} size="A4" style={[styles.page, { paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }]}>
          <FieldRow prefix="รายการวัสดุ อุปกรณ์" prefixBold size={FS_P23} value={data.project_name ?? ""} />
          <FieldRow prefix="กิจกรรม" prefixBold size={FS_P23} value={data.activity_name ?? ""} />
          {itemPages.length > 1 && (
            <Text style={{ fontSize: FS_P23, textAlign: "right" }}>{t(`แผ่นที่ ${pi + 1}/${itemPages.length}`)}</Text>
          )}
          <ItemsTable items={pageItems} startNo={itemPages.slice(0, pi).reduce((n, p) => n + p.length, 1)} />
          {pi === itemPages.length - 1 && (
            <View wrap={false} style={{ marginLeft: PAGE_W / 2 - PAD_LEFT, marginTop: 14 }}>
              <SignatureBlock suffix="ผู้ขออนุมัติ" name={data.requested_by_name} size={FS_P23} />
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
}
