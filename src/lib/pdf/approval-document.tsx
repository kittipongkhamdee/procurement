import path from "node:path";
import { Document, Image, Line, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, THAI_MONTHS } from "@/lib/thai";
import type { ApprovalPdfData } from "@/lib/pdf-overlay/approval-types";
import { registerSarabunFont, t } from "./thai-pdf";
import { measureText, wrapByWidth } from "./thai-measure";

// เอกสารบันทึกข้อความขออนุมัติที่วาดขึ้นใหม่ทั้งหมดด้วย react-pdf (ไม่ใช้เทมเพลต PDF เดิมซ้อนทับ) — ใช้ข้อมูลชุดเดียวกับ
// ApprovalPdfData เหมือนตัวเดิม ตามมาตรฐานขนาดฟอนต์/ระยะห่างใน CLAUDE.md: เนื้อหา 11pt, ชื่อเอกสาร 14pt,
// lineHeight ~1.2, ระยะห่างระหว่างแถว marginBottom 4

registerSarabunFont();

const PAGE_W = 595.28;
const PAD_LEFT = 72;
const PAD_RIGHT = 50;
const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT;
const FS = 11;
const INK = "#000000";
const GARUDA = path.join(process.cwd(), "src/lib/pdf/assets/garuda-emblem.png");

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: FS, lineHeight: 1.2, color: INK, paddingTop: 28, paddingBottom: 26, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  row: { flexDirection: "row", marginBottom: 4 },
  bold: { fontWeight: "bold" },
  // กรอบของช่องที่มีเส้นจุดไข่ปลาอยู่ใต้ค่า — เส้นจุดวาดด้วย <DotLeader /> (ไม่ใช้ borderBottomStyle: "dotted" เพราะ
  // react-pdf วาดเป็นเส้นทึบใต้ตัวหนังสือที่อยู่เหนือมัน)
  dotted: { position: "relative", paddingBottom: 1.5, overflow: "hidden" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center" },
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
  value: string;
  suffix?: string;
  /** ย่อหน้าบรรทัดแรก (pt) */
  indent?: number;
  /** ความกว้างทั้งแถว (ค่าเริ่มต้น = ความกว้างเนื้อหาหน้ากระดาษ) */
  width?: number;
  /** ความกว้างคงที่ของช่องค่า (บรรทัดเดียว) แทนการยืดเต็มบรรทัด */
  valueWidth?: number;
  align?: "left" | "center" | "right";
};

const GAP = 4;

/** แถว "ป้ายหน้า + ค่าบนเส้นจุดไข่ปลา + ป้ายท้าย" — ค่ายาวตัดขึ้นบรรทัดใหม่ล่วงหน้าตามความกว้างจริงของฟอนต์
 * โดยแต่ละบรรทัดมีเส้นจุดไข่ปลาของตัวเอง เหมือนฟอร์มกระดาษ */
function FieldRow({ prefix = "", prefixBold = false, value, suffix = "", indent = 0, width = CONTENT_W, valueWidth, align = "left" }: FieldRowProps) {
  const prefixW = prefix ? measureText(prefix, FS, prefixBold) + GAP : 0;
  const suffixW = suffix ? measureText(suffix, FS) + GAP : 0;

  if (valueWidth) {
    return (
      <View style={styles.row}>
        {indent > 0 && <View style={{ width: indent }} />}
        {prefix ? <Text style={[prefixBold ? styles.bold : {}, { marginRight: GAP }]}>{t(prefix)}</Text> : null}
        <Dotted style={{ width: valueWidth }}>
          <Text style={{ textAlign: align }}>{value ? t(value) : " "}</Text>
        </Dotted>
        {suffix ? <Text style={{ marginLeft: GAP }}>{t(suffix)}</Text> : null}
      </View>
    );
  }

  const first = width - indent - prefixW - suffixW;
  const rest = width - suffixW;
  const lines = wrapByWidth(value, FS, Math.max(first, 40), Math.max(rest, 40));
  return (
    <>
      {lines.map((line, i) => {
        const isFirst = i === 0;
        const isLast = i === lines.length - 1;
        return (
          <View key={i} style={styles.row}>
            {isFirst && indent > 0 && <View style={{ width: indent }} />}
            {isFirst && prefix ? <Text style={[prefixBold ? styles.bold : {}, { marginRight: GAP }]}>{t(prefix)}</Text> : null}
            <Dotted style={{ flex: 1 }}>
              <Text style={{ textAlign: align }}>{line ? t(line) : " "}</Text>
            </Dotted>
            {isLast && suffix ? <Text style={{ marginLeft: GAP }}>{t(suffix)}</Text> : null}
          </View>
        );
      })}
    </>
  );
}

/** ข้อความหลายบรรทัดแบบไม่มีเส้นจุด (เช่น "เรียน ...") ตัดคำเองล่วงหน้า */
function PlainRow({ prefix, value, width = CONTENT_W }: { prefix?: string; value: string; width?: number }) {
  const prefixW = prefix ? measureText(prefix, FS) + 8 : 0;
  const lines = wrapByWidth(value, FS, width - prefixW, width - prefixW);
  return (
    <View style={[styles.row, { alignItems: "flex-start" }]}>
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
    <View style={{ width: 11, height: 11, borderWidth: 0.8, borderColor: INK, marginRight: 4, marginTop: 1.5 }}>
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
    <View style={[styles.row, { alignItems: "flex-start" }]}>
      <CheckBox checked={checked} />
      {children}
    </View>
  );
}

const SUMMARY_DEFAULT_LABELS = ["จัดซื้อจัดจ้าง", "ค่าเบี้ยเลี้ยง/ค่าตอบแทน", "ค่าเดินทางไปราชการ", "ค่าสาธารณูปโภค", "อื่นๆ (ระบุ)"];

const SUMMARY_COLS = { no: 28, label: 0 /* flex */, amount: 84, note: 84 };

function SummaryTable({ data }: { data: ApprovalPdfData }) {
  const rows = SUMMARY_DEFAULT_LABELS.map((label, i) => data.summary_items[i] ?? { label, amount: null, note: null });
  const total = data.summary_items.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const cell = { borderRightWidth: 0.8, borderColor: INK, paddingHorizontal: 4, justifyContent: "center" as const };
  const rowStyle = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, minHeight: 17 };
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginBottom: 6 }}>
      <View style={[rowStyle, { minHeight: 20 }]}>
        <View style={[cell, { width: SUMMARY_COLS.no }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("ที่")}</Text></View>
        <View style={[cell, { flex: 1 }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("รายการ")}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.amount }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("จำนวนเงิน")}</Text></View>
        <View style={[cell, { width: SUMMARY_COLS.note, borderRightWidth: 0 }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("หมายเหตุ")}</Text></View>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={rowStyle}>
          <View style={[cell, { width: SUMMARY_COLS.no }]}><Text style={{ textAlign: "center" }}>{i + 1}</Text></View>
          <View style={[cell, { flex: 1 }]}><Text>{t(i === 4 && r.label !== "อื่นๆ (ระบุ)" ? r.label : r.label)}</Text></View>
          <View style={[cell, { width: SUMMARY_COLS.amount }]}><Text style={{ textAlign: "right" }}>{r.amount ? formatBaht(r.amount) : ""}</Text></View>
          <View style={[cell, { width: SUMMARY_COLS.note, borderRightWidth: 0 }]}><Text>{t(r.note ?? "")}</Text></View>
        </View>
      ))}
      <View style={[rowStyle, { borderBottomWidth: 0 }]}>
        <View style={[cell, { width: SUMMARY_COLS.no }]} />
        <View style={[cell, { flex: 1 }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("รวมทั้งสิ้น")}</Text></View>
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
    <Text style={{ marginBottom: 4 }}>
      {t(`${no}. `)}
      <Text style={{ textDecoration: "underline" }}>{t(title)}</Text>
    </Text>
  );
}

function SignOff({ name, role }: { name: string | null; role?: string }) {
  return (
    <View style={{ alignItems: "center", marginTop: 2 }}>
      <FieldRow prefix="(ลงชื่อ)" value="" valueWidth={130} width={CELL_W} />
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
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK }} wrap={false}>
      <View style={{ flexDirection: "row", borderBottomWidth: 0.8, borderColor: INK }}>
        <View style={[cellStyle, { borderRightWidth: 0.8, borderColor: INK }]}>
          <OpinionTitle no={1} title="ความเห็นงานแผนงาน" />
          <Text style={{ marginBottom: 4 }}>{t("- ตรวจสอบแล้วมีโครงการ")}</Text>
          <FieldRow prefix="- เงินโครงการทั้งสิ้น" value={data.budget != null ? formatBaht(data.budget) : ""} suffix="บาท" valueWidth={78} align="right" />
          <FieldRow prefix="- เงินขอใช้ครั้งนี้" value={formatBaht(data.requested_amount)} suffix="บาท" valueWidth={92} align="right" />
          <FieldRow prefix="- เงินโครงการเหลือ" value={data.remaining != null ? formatBaht(data.remaining) : ""} suffix="บาท" valueWidth={88} align="right" />
          <SignOff name={data.signer_planning} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={2} title="ความเห็นเจ้าหน้าที่การเงิน" />
          <Text style={{ marginBottom: 4 }}>{t("- ตรวจสอบแล้วมีงบประมาณ")}</Text>
          <CheckRow checked={data.fund_type === "งบค่าจัดการเรียนการสอน"}><Text>{t("งบค่าจัดการเรียนการสอน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน"}><Text>{t("งบค่าจัดกิจกรรมพัฒนาคุณภาพผู้เรียน")}</Text></CheckRow>
          <CheckRow checked={data.fund_type === "เงินรายได้สถานศึกษา"}><Text>{t("เงินรายได้สถานศึกษา")}</Text></CheckRow>
          <SignOff name={data.signer_finance} />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={[cellStyle, { borderRightWidth: 0.8, borderColor: INK }]}>
          <OpinionTitle no={3} title="ความเห็นของรองผู้อำนวยการ" />
          <Text style={{ marginBottom: 4 }}>{t("- ตรวจสอบแล้วมีโครงการและงบประมาณ")}</Text>
          <CheckRow checked={data.deputy_decision === "ควร"}><Text>{t("ควรอนุญาตและอนุมัติ")}</Text></CheckRow>
          <CheckRow checked={data.deputy_decision === "ไม่ควร"}>
            <Text>{t("ไม่ควรอนุญาตและอนุมัติเพราะ")}</Text>
            <Dotted style={{ flex: 1, marginLeft: GAP }}><Text> </Text></Dotted>
          </CheckRow>
          <SignOff name={data.signer_deputy} />
        </View>
        <View style={cellStyle}>
          <OpinionTitle no={4} title="ความเห็นของผู้อำนวยการโรงเรียน" />
          <Text style={{ marginBottom: 4 }}>{t("- ตรวจสอบโครงการและงบประมาณ")}</Text>
          <View style={styles.row}>
            <CheckRow checked={approved}><Text>{t("อนุมัติ")}</Text></CheckRow>
            <View style={{ width: 28 }} />
            <CheckRow checked={rejected}><Text>{t("ไม่อนุมัติ")}</Text></CheckRow>
          </View>
          <SignOff name={data.signer_director} role={`ผู้อำนวยการ${data.school_name.replace(/^โรงเรียน/, "โรงเรียน")}`} />
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

const ITEM_ROWS = 29;
const ITEM_ROW_H = 21.6;
const ITEM_COLS = { qty: 52, price: 74, total: 70, note: 62 };

function ItemsTable({ data }: { data: ApprovalPdfData }) {
  const rowsCount = Math.max(ITEM_ROWS, data.items.length);
  const cell = { borderRightWidth: 0.8, borderColor: INK, paddingHorizontal: 4, justifyContent: "center" as const };
  const row = { flexDirection: "row" as const, borderBottomWidth: 0.8, borderColor: INK, height: ITEM_ROW_H };
  return (
    <View style={{ borderWidth: 0.8, borderColor: INK, marginTop: 14 }}>
      <View style={[row, { height: 36 }]}>
        <View style={[cell, { flex: 1 }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("รายการ")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.qty }]}>
          <Text style={[styles.bold, { textAlign: "center" }]}>{t("จำนวน")}</Text>
          <Text style={[styles.bold, { textAlign: "center" }]}>{t("(หน่วย)")}</Text>
        </View>
        <View style={[cell, { width: ITEM_COLS.price }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("ราคา/หน่วย")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.total }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("จำนวนเงิน")}</Text></View>
        <View style={[cell, { width: ITEM_COLS.note, borderRightWidth: 0 }]}><Text style={[styles.bold, { textAlign: "center" }]}>{t("หมายเหตุ")}</Text></View>
      </View>
      {Array.from({ length: rowsCount }).map((_, i) => {
        const item = data.items[i];
        const last = i === rowsCount - 1;
        return (
          <View key={i} style={[row, last ? { borderBottomWidth: 0 } : {}]}>
            <View style={[cell, { flex: 1 }]}><Text>{t(item?.name ?? "")}</Text></View>
            <View style={[cell, { width: ITEM_COLS.qty }]}><Text style={{ textAlign: "center" }}>{item?.qty != null ? String(item.qty) : ""}</Text></View>
            <View style={[cell, { width: ITEM_COLS.price }]}><Text style={{ textAlign: "right" }}>{item?.unit_price != null ? formatBaht(item.unit_price) : ""}</Text></View>
            <View style={[cell, { width: ITEM_COLS.total }]}><Text style={{ textAlign: "right" }}>{item?.total != null ? formatBaht(item.total) : ""}</Text></View>
            <View style={[cell, { width: ITEM_COLS.note, borderRightWidth: 0 }]}><Text>{t(item?.note ?? "")}</Text></View>
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
        <FieldRow prefix={lead} value={data.plan_date_text ?? ""} suffix="และขออนุมัติงบประมาณ" valueWidth={170} />
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

export function ApprovalDocument({ data }: { data: ApprovalPdfData }) {
  return (
    <Document title={`บันทึกข้อความขออนุมัติ ${data.doc_number ?? ""}`}>
      <Page size="A4" style={styles.page}>
        <View style={{ height: 42, marginBottom: 2 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- <Image> ของ @react-pdf/renderer ไม่ใช่ <img> ของ HTML (ไม่มี prop alt) */}
          <Image src={GARUDA} style={{ position: "absolute", left: 0, top: 0, width: 42, height: 42 }} />
          <Text style={[styles.title, { paddingTop: 12 }]}>{t("บันทึกข้อความ")}</Text>
        </View>

        <View style={[styles.row, { marginBottom: 6 }]}>
          <Text style={[styles.bold, { marginRight: 8 }]}>{t("ส่วนราชการ")}</Text>
          <Text>{t(governmentUnit(data))}</Text>
        </View>

        <View style={[styles.row, { marginBottom: 6 }]}>
          <Text style={[styles.bold, { marginRight: GAP }]}>{t("ที่")}</Text>
          <Dotted style={{ width: 150 }}><Text>{t(docNumberText(data.doc_number)) || " "}</Text></Dotted>
          <Text style={[styles.bold, { marginLeft: 8, marginRight: GAP }]}>{t("วันที่")}</Text>
          <Dotted style={{ flex: 1 }}><Text>{t(data.doc_date ? formatThaiDate(data.doc_date) : "") || " "}</Text></Dotted>
        </View>

        <FieldRow prefix="เรื่อง" prefixBold value={subjectLine(data)} />
        <View style={{ borderBottomWidth: 0.9, borderBottomColor: INK, marginBottom: 6 }} />

        <PlainRow prefix="เรียน" value={data.addressed_to} />

        <FieldRow prefix="ด้วย (ฝ่าย/กลุ่ม/สาระฯ/งาน)" value={data.department ?? ""} suffix="จะดำเนินการจัดกิจกรรม" indent={28} />
        <FieldRow prefix="(ชื่อกิจกรรม)" value={data.activity_name ?? ""} />
        <FieldRow prefix="ตามโครงการ/งาน" value={data.project_name ?? ""} />
        <PlanDateAndAmount data={data} />
        <View style={[styles.row, { paddingLeft: 28 }]}>
          <Text>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุญาตและอนุมัติ")}</Text>
        </View>

        <View style={{ alignSelf: "flex-end", width: 250, marginTop: 4, marginBottom: 6, alignItems: "center" }}>
          <FieldRow prefix="(ลงชื่อ)" value="" suffix="ผู้รับผิดชอบโครงการ" valueWidth={110} />
          <Text>{t(data.requested_by_name ? `(${data.requested_by_name})` : "(                                    )")}</Text>
        </View>

        <SummaryTable data={data} />
        <OpinionBoxes data={data} />
      </Page>

      <Page size="A4" style={styles.page}>
        <FieldRow prefix="รายการวัสดุ อุปกรณ์" prefixBold value={data.project_name ?? ""} />
        <FieldRow prefix="กิจกรรม" prefixBold value={data.activity_name ?? ""} />
        <ItemsTable data={data} />
      </Page>
    </Document>
  );
}
