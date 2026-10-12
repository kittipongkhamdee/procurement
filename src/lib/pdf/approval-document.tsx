import path from "node:path";
import { Document, Font, Image, Line, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, THAI_MONTHS } from "@/lib/thai";
import type { ApprovalPdfData } from "@/lib/pdf-overlay/approval-types";
import { registerSarabunFont, t } from "./thai-pdf";
import { measureText as measureWith, wrapByWidth as wrapWith } from "./thai-measure";

// เอกสารบันทึกข้อความขออนุมัติที่วาดขึ้นใหม่ทั้งหมดด้วย react-pdf (ไม่ใช้เทมเพลต PDF เดิมซ้อนทับ) — ใช้ข้อมูลชุดเดียวกับ
// ApprovalPdfData เหมือนตัวเดิม
//
// รูปแบบหน้า 1 ทำตามแบบกระดาษบันทึกข้อความ (แบบที่ ๒๙ ท้ายระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ พ.ศ. ๒๕๒๖)
// และ "คำแนะนำและแบบมาตรฐานการพิมพ์หนังสือราชการภาษาไทยด้วยโปรแกรมการพิมพ์ในเครื่องคอมพิวเตอร์":
//   - ขอบกระดาษ ซ้าย ๓ ซม. ขวา ๒ ซม. บน ๑.๕ ซม. ล่าง ๑.๕ ซม. (แบบกำหนดบน ๒.๕/ล่าง ๒ ซม. — ผู้ใช้ขอลดเอง) (พื้นที่พิมพ์กว้าง ๑๖ ซม.)
//   - ตราครุฑสูง ๑.๕ ซม. ชิดขอบบนของพื้นที่พิมพ์ ชิดซ้าย
//   - ตัวอักษรเนื้อหา ๑๖ พอยท์; "บันทึกข้อความ" ตัวหนา ๒๙ พอยท์ ระยะบรรทัดแน่นอน ๓๕ พอยท์;
//     "ส่วนราชการ ที่ วันที่ เรื่อง" ตัวหนา ๒๐ พอยท์; ใช้จุดไข่ปลาเป็นเส้นบรรทัดหลังคำเหล่านี้
//   - "วันที่" ตรงกับตัวอักษร "ข" ของ "บันทึกข้อความ" และตัวแรกของชื่อเดือนตรงกับแนวหลังของ "ม"
//   - คำขึ้นต้นห่างจากเรื่อง ๑ บรรทัด + ๖ พอยท์; ย่อหน้าข้อความ ๒.๕ ซม.
//   - ลายมือชื่อเริ่มที่แนวกึ่งกลางกระดาษ; ชื่อในวงเล็บและตำแหน่งอยู่กึ่งกลางซึ่งกันและกัน
// ตารางรายการเงิน กรอบความเห็น ๔ ช่อง และตารางรายการวัสดุ (ไม่มีกำหนดในแบบ) ใช้ตัวอักษร ๑๖ พอยท์เท่าเนื้อหา
// (กรอบความเห็นอยู่หน้า ๒ เพราะหน้า ๑ ไม่พอ; รายการวัสดุอยู่หน้า ๓)
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
const PAD_LEFT = 3 * CM;
const PAD_RIGHT = 2 * CM;
const PAD_TOP = 1.5 * CM; // ผู้ใช้ขอลดจาก ๒.๕ ซม. ตามแบบ เหลือ ๑.๕ ซม.
const PAD_BOTTOM = 1.5 * CM; // ผู้ใช้ขอลดจาก ๒ ซม. ตามแบบ เหลือ ๑.๕ ซม. (เท่าขอบบน)
const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT; // ≈ 16 ซม.
const FS = 16; // ตัวอักษรเนื้อหา
const FS_LABEL = 20; // "ส่วนราชการ ที่ วันที่ เรื่อง"
const FS_TITLE = 29; // "บันทึกข้อความ"
const TITLE_LINE = 35; // ระยะบรรทัดแน่นอนของ "บันทึกข้อความ"
const FS_TABLE = 16; // ตารางรายการ
const FS_BOX = 16; // กรอบความเห็น ๔ ช่อง
const GARUDA_H = 1.5 * CM;
const GARUDA_W = (GARUDA_H * 659) / 738;
const INDENT = 2.5 * CM; // ย่อหน้า
const INK = "#000000";
const GARUDA = path.join(process.cwd(), "src/lib/pdf/assets/garuda-emblem.png");

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.3, color: INK, paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  // แถวที่มีเส้นจุดไข่ปลา: จัดชิดขอบล่าง + ทุกองค์ประกอบในแถวใช้ lineHeight เท่ากัน เส้นจุดจึงอยู่ห่างจากตัวอักษรเท่ากันทุกแถว
  // (ถ้าปล่อยเป็น stretch ช่องที่เป็นเส้นจุดจะถูกยืดตามป้ายหน้า/หลังที่สูงกว่า ทำให้เส้นอยู่ห่างตัวอักษรไม่เท่ากัน)
  row: { flexDirection: "row", alignItems: "flex-end", lineHeight: 1.05, marginBottom: 3 },
  bold: { fontWeight: "bold" },
  // กรอบของช่องที่มีเส้นจุดไข่ปลาอยู่ใต้ค่า — เส้นจุดวาดด้วย <DotLeader /> (ไม่ใช้ borderBottomStyle: "dotted" เพราะ
  // react-pdf วาดเป็นเส้นทึบใต้ตัวหนังสือที่อยู่เหนือมัน)
  dotted: { position: "relative", paddingBottom: 0.5, overflow: "hidden", lineHeight: 1.05 },
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
  /** ระยะห่างใต้แถว (ค่าเริ่มต้น 3pt) */
  rowGap?: number;
};

const GAP = 4;
/** เผื่อความกว้างตอนตัดบรรทัดเอง — react-pdf วัดข้อความ (รวมช่องว่างท้าย) กว้างกว่าที่เราวัดเล็กน้อย ถ้าไม่เผื่อจะตัดซ้ำเอง */
const WRAP_SLACK = 10;

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
  rowGap = 3,
}: FieldRowProps) {
  const pSize = prefixSize ?? size;
  const prefixW = prefix ? measureText(prefix, pSize, prefixBold) + GAP : 0;
  const suffixW = suffix ? measureText(suffix, size) + GAP : 0;
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

  const first = width - indent - prefixW - suffixW - WRAP_SLACK;
  const rest = width - suffixW - WRAP_SLACK;
  const lines = wrapByWidth(value, size, Math.max(first, 40), Math.max(rest, 40));
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
              <Text style={{ fontSize: size, textAlign: align }}>{line ? t(line) : " "}</Text>
            </Dotted>
            {isLast ? suffixEl : null}
          </View>
        );
      })}
    </>
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
        {lines.map((l, i) => (
          <Text key={i}>{t(l)}</Text>
        ))}
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
    <View style={[styles.row, { alignItems: "flex-start", marginBottom: 1 }]}>
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
  const rowStyle = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, minHeight: 18 };
  const hd = [styles.bold, { textAlign: "center" as const }];
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginBottom: 6, fontSize: FS_TABLE }}>
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

const CELL_PAD = 5;
const CELL_W = CONTENT_W / 2 - CELL_PAD * 2;

function OpinionTitle({ no, title }: { no: number; title: string }) {
  return (
    <Text style={{ marginBottom: 1 }}>
      {t(`${no}. `)}
      <Text style={{ textDecoration: "underline" }}>{t(title)}</Text>
    </Text>
  );
}

function SignOff({ name, role }: { name: string | null; role?: string }) {
  return (
    <View style={{ alignItems: "center", marginTop: 4, lineHeight: 1.1 }}>
      <FieldRow prefix="(ลงชื่อ)" value="" valueWidth={120} width={CELL_W} size={FS_BOX} rowGap={0} />
      <Text>{t(name ? `(${name})` : "(                                    )")}</Text>
      {role ? <Text>{t(role)}</Text> : null}
    </View>
  );
}

function OpinionBoxes({ data }: { data: ApprovalPdfData }) {
  const cellStyle = { flex: 1, padding: CELL_PAD };
  const approved = data.status === "อนุมัติ";
  const rejected = data.status === "ไม่อนุมัติ";
  const d = data.approved_at ? new Date(data.approved_at) : null;
  const line = { marginBottom: 1 };
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, fontSize: FS_BOX, lineHeight: 1.1 }} wrap={false}>
      <View style={{ flexDirection: "row", borderBottomWidth: 0.8, borderColor: INK }}>
        <View style={[cellStyle, { borderRightWidth: 0.8, borderColor: INK }]}>
          <OpinionTitle no={1} title="ความเห็นงานแผนงาน" />
          <Text style={line}>{t("- ตรวจสอบแล้วมีโครงการ")}</Text>
          <FieldRow size={FS_BOX} prefix="- เงินโครงการทั้งสิ้น" value={data.budget != null ? formatBaht(data.budget) : ""} suffix="บาท" valueWidth={74} align="right" rowGap={1} />
          <FieldRow size={FS_BOX} prefix="- เงินขอใช้ครั้งนี้" value={formatBaht(data.requested_amount)} suffix="บาท" valueWidth={86} align="right" rowGap={1} />
          <FieldRow size={FS_BOX} prefix="- เงินโครงการเหลือ" value={data.remaining != null ? formatBaht(data.remaining) : ""} suffix="บาท" valueWidth={80} align="right" rowGap={1} />
          <SignOff name={data.signer_planning} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={2} title="ความเห็นเจ้าหน้าที่การเงิน" />
          <Text style={line}>{t("- ตรวจสอบแล้วมีงบประมาณ")}</Text>
          <CheckRow checked={data.fund_type === "งบค่าจัดการเรียนการสอน"}><Text>{t("งบค่าจัดการเรียนการสอน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน"}><Text>{t("งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "เงินรายได้สถานศึกษา"}><Text>{t("เงินรายได้สถานศึกษา")}</Text></CheckRow>
          <SignOff name={data.signer_finance} />
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
          <SignOff name={data.signer_deputy} role={`รองผู้อำนวยการ${data.school_name}`} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={4} title="ความเห็นของผู้อำนวยการโรงเรียน" />
          <Text style={line}>{t("- ตรวจสอบโครงการและงบประมาณ")}</Text>
          <View style={styles.row}>
            <CheckRow checked={approved}><Text>{t("อนุมัติ")}</Text></CheckRow>
            <View style={{ width: 28 }} />
            <CheckRow checked={rejected}><Text>{t("ไม่อนุมัติ")}</Text></CheckRow>
          </View>
          <SignOff name={data.signer_director} role={`ผู้อำนวยการ${data.school_name}`} />
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

const ITEM_ROWS = 29;
const ITEM_ROW_H = 20.4;
const ITEM_COLS = { qty: 54, price: 70, total: 70, note: 62 };

function ItemsTable({ data }: { data: ApprovalPdfData }) {
  const rowsCount = Math.max(ITEM_ROWS, data.items.length);
  const nameW = CONTENT_W - ITEM_COLS.qty - ITEM_COLS.price - ITEM_COLS.total - ITEM_COLS.note;
  const cell = { borderRightWidth: 0.8, borderColor: INK, paddingHorizontal: 4, justifyContent: "center" as const };
  const row = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, height: ITEM_ROW_H };
  const hd = [styles.bold, { textAlign: "center" as const }];
  // lineHeight ต่ำ: Text ในแถวที่กำหนดความสูงตายตัวจะถูกซ่อน/ตัดเป็น "…" ถ้าความสูงบรรทัดเกินความสูงแถว
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginTop: 8, fontSize: 16, lineHeight: 1.05 }}>
      <View style={[row, { height: 38 }]}>
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
        const item = data.items[i];
        const last = i === rowsCount - 1;
        return (
          <View key={i} style={[row, last ? { borderBottomWidth: 0 } : {}]}>
            <View style={[cell, { flex: 1 }]}><FitText text={item?.name ?? ""} width={nameW - 10} size={16} /></View>
            <View style={[cell, { width: ITEM_COLS.qty }]}><FitText text={item?.qty != null ? String(item.qty) : ""} width={ITEM_COLS.qty - 10} size={16} align="center" /></View>
            <View style={[cell, { width: ITEM_COLS.price }]}><FitText text={item?.unit_price != null ? formatBaht(item.unit_price) : ""} width={ITEM_COLS.price - 10} size={16} align="right" /></View>
            <View style={[cell, { width: ITEM_COLS.total }]}><FitText text={item?.total != null ? formatBaht(item.total) : ""} width={ITEM_COLS.total - 10} size={16} align="right" /></View>
            <View style={[cell, { width: ITEM_COLS.note, borderRightWidth: 0 }]}><FitText text={item?.note ?? ""} width={ITEM_COLS.note - 10} size={16} /></View>
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

/** "จะดำเนินการวันที่ … และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน … บาท" ต่อกันในบรรทัดเดียว — ช่องวันที่ขยายตาม
 * พื้นที่ที่เหลือ (ถ้าแคบเกินไปจริงๆ จะแยกส่วนจำนวนเงินลงบรรทัดใหม่แทน) */
function PlanDateAndAmount({ data }: { data: ApprovalPdfData }) {
  const lead = "จะดำเนินการวันที่";
  const mid = "และขออนุมัติงบประมาณในครั้งนี้ จำนวนเงิน";
  const tail = "บาท";
  const amount = formatBaht(data.requested_amount);
  const amountW = Math.max(56, measureText(amount, FS) + 12);
  const fixed = [lead, mid, tail].reduce((sum, txt) => sum + measureText(txt, FS), 0) + GAP * 6;
  const dateW = CONTENT_W - fixed - amountW;
  // วันที่ที่ยาวที่สุดที่เป็นไปได้ (เช่น "30 กันยายน 2570") ต้องใส่ในช่องได้ ไม่งั้นแยกบรรทัด
  const dateNeeded = Math.max(measureText(data.plan_date_text ?? "", FS), measureText("30 กันยายน 2570", FS)) + 8;
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

export function ApprovalDocument({ data }: { data: ApprovalPdfData }) {
  return (
    <Document title={`บันทึกข้อความขออนุมัติ ${data.doc_number ?? ""}`}>
      <Page size="A4" style={styles.page}>
        {/* ตราครุฑสูง 1.5 ซม. ชิดซ้าย — ชื่อ "บันทึกข้อความ" ตัวหนา 29 พอยท์ ระยะบรรทัด 35 พอยท์ อยู่กลางพื้นที่พิมพ์ */}
        <View style={{ height: GARUDA_H, marginBottom: 6 }}>
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

        <View style={{ marginTop: 6 }}>
          <PlainRow prefix="เรียน" value={data.addressed_to} />
        </View>

        <FieldRow prefix="ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน)" value={data.department ?? ""} indent={INDENT} />
        <FieldRow prefix="จะดำเนินการจัดกิจกรรม (ชื่อกิจกรรม)" value={data.activity_name ?? ""} />
        <FieldRow prefix="ตามโครงการ/งาน" value={data.project_name ?? ""} />
        <PlanDateAndAmount data={data} />
        <View style={[styles.row, { paddingLeft: INDENT }]}>
          <Text>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตและอนุมัติ")}</Text>
        </View>

        {/* ลายมือชื่อเริ่มที่แนวกึ่งกลางกระดาษ; ชื่อในวงเล็บอยู่กึ่งกลางใต้ลายมือชื่อ */}
        <View style={{ marginLeft: PAGE_W / 2 - PAD_LEFT, marginTop: 14, marginBottom: 8, alignItems: "center" }}>
          <FieldRow prefix="(ลงชื่อ)" value="" suffix="ผู้รับผิดชอบโครงการ" valueWidth={90} />
          <Text>{t(data.requested_by_name ? `(${data.requested_by_name})` : "(                                    )")}</Text>
        </View>

        <View wrap={false}>
          <SummaryTable data={data} />
        </View>

        {/* กรอบความเห็น ๔ ช่อง ขึ้นหน้าใหม่เสมอ (ที่ตัวอักษร ๑๖ พอยท์ หน้า ๑ ไม่พอสำหรับทั้งสองส่วน) */}
        <View break>
          <Text style={{ fontWeight: "bold", lineHeight: 1.1, marginBottom: 1 }}>{t("ความเห็นประกอบการพิจารณา")}</Text>
          <Text style={{ lineHeight: 1.1, marginBottom: 6 }}>
            {t(`ประกอบบันทึกข้อความ ที่ ${docNumberText(data.doc_number)} ลงวันที่ ${data.doc_date ? formatThaiDate(data.doc_date) : ""}`)}
          </Text>
          <OpinionBoxes data={data} />
        </View>
      </Page>

      {/* หน้ารายการวัสดุ อุปกรณ์ (ไม่ใช่ส่วนบันทึกข้อความ) ใช้ขอบบน/ล่างแคบลงเพื่อให้ตาราง ๒๙ แถวพอดีหน้าเดียว */}
      <Page size="A4" style={[styles.page, { paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }]}>
        <FieldRow prefix="รายการวัสดุ อุปกรณ์" prefixBold value={data.project_name ?? ""} />
        <FieldRow prefix="กิจกรรม" prefixBold value={data.activity_name ?? ""} />
        <ItemsTable data={data} />
      </Page>
    </Document>
  );
}
