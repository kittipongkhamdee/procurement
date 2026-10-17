import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { procurementSheets, W804_INLINE_MAX, type SheetKey } from "./procurement-sheets";
import { measureText as measureWith, wrapByWidth as wrapWith } from "./thai-measure";

// ชุดเอกสารงานซื้อ / งานจ้าง (วิธีเฉพาะเจาะจง) ๘ แผ่น ตามแบบที่โรงเรียนใช้ (เช่น ชุดซื้อเสารั้ว 81/2569):
//  1 บันทึกรายงานขอซื้อ/ขอจ้าง  2 รายละเอียดแนบท้ายบันทึก  3 ใบเสนอราคา  4 บันทึกรายงานผลการพิจารณาและขออนุมัติสั่งซื้อ/สั่งจ้าง
//  5 ใบสั่งซื้อ/ใบสั่งจ้าง  6 รายละเอียดแนบท้ายใบสั่งซื้อ/สั่งจ้าง  7 ใบตรวจรับพัสดุ  8 บันทึกรายงานผลการตรวจรับและขออนุมัติเบิกจ่ายเงิน
// พิมพ์ทั้งชุดหรือเลือกเฉพาะแผ่นได้ (prop `sheets`) — ฟอนต์ TH Sarabun New ๑๖ พอยท์ ขอบกระดาษเดียวกับบันทึกขออนุมัติ
// งานจ้างใช้แบบเดียวกัน เปลี่ยนถ้อยคำ ซื้อ→จ้าง, ผู้ขาย→ผู้รับจ้าง, ใบสั่งซื้อ→ใบสั่งจ้าง

registerSarabunFont();
export const FAMILY = "THSarabunNew";
Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/THSarabunNew-Bold.ttf"), fontWeight: "bold" },
  ],
});
export const measureText = (text: string, size: number, bold = false) => measureWith(text, size, bold, FAMILY);
export const wrap = (text: string, size: number, first: number, rest: number, keep: string[] = []) =>
  wrapWith(text, size, first, rest, false, FAMILY, keep);

export const CM = 28.3465;
const PAGE_W = 595.28;
const PAD_LEFT = 2.5 * CM;
const PAD_RIGHT = 2 * CM;
export const CONTENT_W = PAGE_W - PAD_LEFT - PAD_RIGHT;
export const FS = 16;
const FS_SMALL = 14;
export const INDENT = 2.5 * CM;
export const SLACK = 10;
const MIN_TABLE_ROWS = 15;
export const B = 0.8; // เส้นตาราง


export const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.2, paddingTop: 1.5 * CM, paddingBottom: 1 * CM, paddingLeft: PAD_LEFT, paddingRight: PAD_RIGHT },
  bold: { fontWeight: "bold" },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center" },
  gap: { marginBottom: 4 },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 },
});

export type ProcurementSetData = {
  doc_type: "ซื้อ" | "จ้าง";
  doc_no: string;
  record_date: string;
  delivery_date: string;
  order_date: string | null;
  delivered_date: string | null;
  inspected_date: string | null;
  report_date: string | null;
  work_days: number | null;
  admin_group: string | null;
  project_name: string | null;
  activity_name: string | null;
  item_name: string;
  reason: string | null;
  amount: number;
  penalty_rate: number | null;
  order_signer: "head" | "director" | null;
  inspector_name: string | null;
  inspector_position: string | null;
  vendor: {
    name: string;
    house_no: string | null;
    moo: string | null;
    tambon: string | null;
    amphoe: string | null;
    province: string | null;
    phone: string | null;
    tax_id: string | null;
  } | null;
  items: { name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null }[];
  school_name: string;
  school_address: string | null;
  school_phone: string | null;
  education_area: string | null;
  procurement_officer: string | null;
  procurement_head: string | null;
  director: string | null;
  /** วิธีจัดซื้อ: specific = เฉพาะเจาะจงปกติ, w804 = ซื้อไม่เกิน 50,000 ตามหนังสือ ว 804 */
  method: "specific" | "w804";
  receipt_type?: string | null;
  receipt_book: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  funding: "loan" | "advance" | null;
  loan_contract_no: string | null;
  loan_date: string | null;
  spec_author: string | null;
};


const W804_REF =
  "หนังสือคณะกรรมการวินิจฉัยปัญหาการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ ด่วนที่สุด ที่ กค (กวจ) 0405.2/ว 804 ลงวันที่ 12 พฤศจิกายน 2568 เรื่อง แนวทางปฏิบัติสำหรับการจัดซื้อวงเงินไม่เกิน 50,000 บาท";

/** ปีงบประมาณไทยของวันที่ ISO (ต.ค. ขึ้นปีงบใหม่) */
export function fiscalYearOf(iso: string) {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });

/** บรรทัดแบบ "กระจายแบบไทย" — เกลี่ยช่องว่างระหว่างกลุ่มอักษรให้เต็มความกว้างบรรทัด */
function DistributedLine({ text, style }: { text: string; style?: Styles[string] }) {
  const parts = [...graphemes.segment(text)].map((g) => g.segment);
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between" }, style ?? {}]}>
      {parts.map((g, i) => (
        <Text key={i}>{g === " " ? " " : g}</Text>
      ))}
    </View>
  );
}

/** ย่อหน้า — ตัดบรรทัดเองตามความกว้างจริงของฟอนต์ บรรทัดแรกเยื้อง `indent` บรรทัดถัดไปชิดซ้าย (หรือเยื้อง `restIndent`)
 * ทุกบรรทัดยกเว้นบรรทัดสุดท้ายจัดกระจายแบบไทย */
export function Para({ text, indent = INDENT, restIndent = 0, keep, style }: { text: string; indent?: number; restIndent?: number; keep?: string[]; style?: Styles[string] }) {
  const lines = wrap(text, FS, CONTENT_W - indent - SLACK, CONTENT_W - restIndent - SLACK, keep);
  return (
    <View style={[styles.gap, style ?? {}]}>
      {lines.map((l, i) => {
        const lineStyle = { marginLeft: i === 0 ? indent : restIndent };
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

/** ช่องติ๊กความเห็นผู้อำนวยการ (กรอบวาดเอง — ฟอนต์ไม่มีอักษร ☐) */
function DirectorTicks() {
  return (
    <View>
      {["เห็นชอบ/อนุมัติ", "ไม่เห็นชอบ/ไม่อนุมัติ เนื่องจาก.................."].map((x) => (
        <View key={x} style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ width: 9, height: 9, borderWidth: B, marginTop: 6, marginRight: 6 }} />
          <Text>{t(x)}</Text>
        </View>
      ))}
    </View>
  );
}

/** ลายมือชื่อ: "ลงชื่อ.......<ตำแหน่ง>" และชื่อในวงเล็บ (ไม่มีชื่อ = เส้นจุด) บรรทัดถัดไปเพิ่มได้ */
export function Sign({ role, name, extra = [], style }: { role: string; name: string | null; extra?: string[]; style?: Styles[string] }) {
  return (
    <View style={style ?? {}} wrap={false}>
      <Text>{t(`ลงชื่อ.......................................${role}`)}</Text>
      <Text style={{ marginLeft: measureText("ลงชื่อ", FS) - 4 }}>{t(name ? `(${name})` : "(.......................................)")}</Text>
      {extra.map((x, i) => (
        <Text key={i} style={{ marginLeft: measureText("ลงชื่อ", FS) - 4 }}>
          {t(x)}
        </Text>
      ))}
    </View>
  );
}

type Col = { label: string[]; width?: number; align?: "left" | "center" | "right" };

/** ตารางรายการ — หัวตาราง (รองรับหัวสองชั้นผ่าน `group`), แถวรายการ (ขั้นต่ำ MIN_TABLE_ROWS แถว), แถวรวมเงิน */
function ItemTable({
  cols,
  group,
  rows,
  totalLabel,
  total,
  minRows = MIN_TABLE_ROWS,
  footer,
}: {
  cols: Col[];
  /** หัวกลุ่มครอบ `span` คอลัมน์สุดท้าย เช่น "จำนวนและวงเงินที่ขอซื้อครั้งนี้" */
  group?: { label: string; span: number };
  rows: string[][];
  totalLabel: string;
  total: string;
  minRows?: number;
  /** ส่วนท้ายต่อจากแถวรวม (เช่น ลายมือชื่อ) — ไม่ถูกแยกไปหน้าใหม่ลำพัง */
  footer?: React.ReactNode;
}) {
  // minRows = 0 → ไม่เติมแถวว่าง
  const padded = [...rows, ...Array.from({ length: Math.max(0, minRows - rows.length) }, () => cols.map(() => ""))];
  const flexCol = (c: Col) => (c.width ? { width: c.width, flexShrink: 0 } : { flex: 1 });
  const lastIdx = cols.length - 1;
  const groupStart = group ? cols.length - group.span : cols.length;
  const groupWidth = group ? cols.slice(groupStart).reduce((s, c) => s + (c.width ?? 0), 0) : 0;
  const headCell = (c: Col, i: number, extra?: Styles[string]) => (
    <View key={i} style={[styles.cell, flexCol(c), { justifyContent: "center" }, extra ?? {}]}>
      {c.label.map((l, j) => (
        <Text key={j} style={{ textAlign: "center" }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
  // ความกว้างคอลัมน์ข้อความหลัก (flex) — ใช้ตัดบรรทัดชื่อรายการเอง
  const fixedW = cols.reduce((s, c) => s + (c.width ?? 0), 0);
  const flexW = CONTENT_W - fixedW - 2 * B - 6 - SLACK;
  return (
    // เส้นกรอบ: ตารางมีแค่เส้นบน/ซ้าย แต่ละช่องมีเส้นขวา/ล่างของตัวเอง (กันเส้นขอบนอกทับเส้นช่องสุดท้ายแล้วเหลื่อม)
    // หัวตาราง `fixed` = พิมพ์ซ้ำทุกหน้าเมื่อรายการยาวเกินหนึ่งหน้า (มีเส้นบนของตัวเอง)
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B }} fixed>
        {cols.slice(0, groupStart).map((c, i) => headCell(c, i))}
        {group && (
          <View style={{ width: groupWidth, flexShrink: 0 }}>
            <View style={styles.cell}>
              {wrap(group.label, FS, groupWidth - 8 - SLACK, groupWidth - 8 - SLACK).map((l, j) => (
                <Text key={j} style={{ textAlign: "center" }}>
                  {t(l)}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>{cols.slice(groupStart).map((c, i) => headCell(c, groupStart + i))}</View>
          </View>
        )}
      </View>
      {padded.map((r, ri) => (
        <View key={ri} style={{ flexDirection: "row", borderLeftWidth: B }} wrap={false}>
          {cols.map((c, i) => {
            const lines = !c.width && r[i] ? wrap(r[i], FS, flexW, flexW) : [r[i] || " "];
            return (
              <View key={i} style={[styles.cell, flexCol(c)]}>
                {lines.map((l, j) => (
                  <Text key={j} style={{ textAlign: c.align ?? "left" }}>
                    {t(l) || " "}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      ))}
      {/* แถวรวม + ลายมือชื่อท้ายตาราง อยู่หน้าเดียวกันเสมอ */}
      <View wrap={false}>
        <View style={{ flexDirection: "row", borderLeftWidth: B }}>
          <View style={[styles.cell, { flex: 1 }]}>
            <Text style={{ textAlign: "center" }}>{t(totalLabel)}</Text>
          </View>
          <View style={[styles.cell, { width: cols[lastIdx].width, flexShrink: 0 }]}>
            <Text style={{ textAlign: "right" }}>{total}</Text>
          </View>
        </View>
        {footer}
      </View>
    </View>
  );
}

const num = (n: number | null | undefined) => (n == null ? "" : Number.isInteger(Number(n)) ? Number(n).toLocaleString("th-TH") : formatBaht(Number(n)));

export function ProcurementSetDocument({ data: d, sheets }: { data: ProcurementSetData; sheets?: number[] }) {
  const keys = procurementSheets(d.doc_type, d.method === "w804", d.items.length).filter((x) => !sheets || sheets.length === 0 || sheets.includes(x.no)).map((x) => x.key);
  const show = (k: SheetKey) => keys.includes(k);
  const isHire = d.doc_type === "จ้าง";
  const verb = d.doc_type; // ซื้อ | จ้าง
  const party = isHire ? "ผู้รับจ้าง" : "ผู้ขาย";
  const thing = isHire ? "งาน" : "พัสดุ";
  const school = d.school_name;
  const schoolCore = school.replace(/^โรงเรียน/, "");
  const v = d.vendor;
  const vendorName = v?.name ?? "..............................";
  const keep = [schoolCore, ...(v?.name ?? "").split(/\s+/), v?.tambon, v?.amphoe, v?.province, d.inspector_name ?? ""].filter((x): x is string => !!x);
  const recordDate = formatThaiDate(d.record_date);
  const deliveryDate = formatThaiDate(d.delivery_date);
  // วันแต่ละขั้น ไม่กรอก = ใช้วันที่บันทึกข้อความ (ผู้ใช้กำหนด)
  const orderIso = d.order_date ?? d.record_date;
  const deliveredIso = d.delivered_date ?? d.record_date;
  const inspectedIso = d.inspected_date ?? d.record_date;
  const reportIso = d.report_date ?? d.record_date;
  const orderDate = formatThaiDate(orderIso);
  const deliveredDate = formatThaiDate(deliveredIso);
  const inspectedDate = formatThaiDate(inspectedIso);
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const amountTextBare = amountText.replace(/^\(|\)$/g, "");
  const days = d.work_days ?? 0;
  const penalty = d.penalty_rate ?? (isHire ? 0.1 : 0.2);
  // ค่าปรับ: ส่งมอบช้ากว่าวันครบกำหนด → วันละ (อัตรา% × ราคา) งานจ้างขั้นต่ำวันละ 100 บาท ตามเงื่อนไขในใบสั่ง
  const lateDays = Math.max(0, Math.round((Date.parse(deliveredIso) - Date.parse(d.delivery_date)) / 86_400_000));
  const finePerDay = lateDays > 0 ? Math.max(Math.round(d.amount * (penalty / 100) * 100) / 100, isHire ? 100 : 0) : 0;
  const fineTotal = Math.round(finePerDay * lateDays * 100) / 100;
  const payable = Math.round((d.amount - fineTotal) * 100) / 100;
  const dash = (n: number) => (n > 0 ? formatBaht(n) : "-");
  const unit = `${school}${d.education_area ? `  ${d.education_area}` : ""}`;
  const plan = [d.admin_group, d.project_name, d.activity_name].filter(Boolean).join(" ");
  const fy = fiscalYearOf(d.record_date);
  // ว.804 หัวข้อ 1: รายการละบรรทัด ย่อหน้าเข้าไปเท่าหัวข้อ — เกิน W804_INLINE_MAX รายการให้อ้างรายละเอียดที่แนบ (หน้าแรกจะล้น)
  const w804SpecText =
    d.items.length <= W804_INLINE_MAX
      ? d.items.map((it, i) => `${i + 1}) ${it.name ?? ""}${it.qty != null ? ` จำนวน ${it.qty.toLocaleString("th-TH")} ${it.unit ?? ""}` : ""}`.trim())
      : null;
  const officer = d.procurement_officer;
  const head = d.procurement_head;
  const itemRows = d.items.map((it, i) => ({ ...it, seq: i + 1 }));
  const L = PAGE_W / 2 - PAD_LEFT;
  // ผู้ลงนามสั่งซื้อ/สั่งจ้าง เลือกได้ระหว่างหัวหน้าเจ้าหน้าที่ (ค่าเริ่มต้น) กับผู้อำนวยการโรงเรียน
  const orderer =
    d.order_signer === "director"
      ? { name: d.director, position: `ผู้อำนวยการ${school}` }
      : { name: head, position: "หัวหน้าเจ้าหน้าที่" }; // แนวกึ่งกลางกระดาษ (สำหรับลายเซ็นฝั่งขวา)

  return (
    <Document title={`${verb} ${d.item_name} ${d.doc_no}`}>
      {/* ๑. บันทึกข้อความ รายงานขอซื้อ/ขอจ้าง */}
      {show("request") && (
        <Page size="A4" style={styles.page}>
          <MemoHeader unit={unit} docNumber={d.doc_no} isoDate={d.record_date} subject={isHire ? `รายงานขอจ้าง ${d.item_name}` : `รายงานขอซื้อพัสดุ ${d.item_name}`} />
          <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            text={`ด้วยกลุ่มสาระ/ฝ่าย ${d.admin_group ?? "-"} มีความประสงค์จะขอ${isHire ? "จ้าง" : "ซื้อพัสดุ"} ${d.item_name} เพื่อ${d.reason ?? "-"} ซึ่งได้รับอนุมัติเงินจากแผนงาน ${plan || "-"} รายละเอียดดังแนบ`}
          />
          <Para
            keep={keep}
            text={`งานพัสดุได้ตรวจสอบแล้วเห็นควร${isHire ? "จัดจ้าง" : "จัดซื้อ"}ตามเสนอ และเพื่อให้เป็นไปตามพระราชบัญญัติ การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 มาตรา 56 วรรคหนึ่ง (2) (ข) และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 22 ข้อ 79 ข้อ 25 (5) และกฎกระทรวงกำหนดวงเงินการจัดซื้อจัดจ้างพัสดุโดยวิธีเฉพาะเจาะจง วงเงินการจัดซื้อจัดจ้างที่ไม่ทำข้อตกลงเป็นหนังสือ และวงเงินการจัดซื้อจัดจ้างในการแต่งตั้งผู้ตรวจรับพัสดุ พ.ศ. 2560 ข้อ 1 และข้อ 5 จึงขอรายงานขอ${verb} ดังนี้`}
          />
          {[
            `1. เหตุผลและความจำเป็นที่ต้อง${verb} คือ ${d.reason ?? "-"}`,
            isHire ? `2. รายละเอียดของที่จะจ้างคือ ${d.item_name}` : "2. รายละเอียดของที่จะซื้อคือ....(ตามรายละเอียดบันทึกที่แนบท้าย)....",
            `3. ราคากลางของพัสดุที่จะ${verb}เป็นเงิน ${amount} บาท`,
            `4. วงเงินที่จะขอ${verb}ครั้งนี้ ${amount} บาท ${amountText}`,
            isHire
              ? `5. กำหนดเวลาทำงานแล้วเสร็จภายใน ${days} วัน นับถัดจากวันลงนามใบสั่งจ้าง`
              : `5. กำหนดเวลาที่ต้องการใช้พัสดุภายใน ${days} วัน นับถัดจากวันลงนามใบสั่งซื้อ`,
            `6. ${verb}โดยวิธีเฉพาะเจาะจง เนื่องจาก การจัดจ้างพัสดุที่มีการผลิต จำหน่าย ก่อสร้าง หรือให้บริการทั่วไป และมีวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน 500,000 บาท ที่กำหนดในกฎกระทรวง`,
            "7. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้เกณฑ์ราคา",
            "8. ข้อเสนออื่น ๆ เห็นควรแต่งตั้งผู้ตรวจรับพัสดุ ตามเสนอ",
          ].map((x, i) => (
            <Para key={i} keep={keep} text={x} indent={INDENT} style={{ marginBottom: 0 }} />
          ))}
          <Text style={{ marginLeft: INDENT - 20, marginTop: 6 }}>{t("จึงเรียนมาเพื่อโปรดพิจารณา")}</Text>
          <Para keep={keep} text={`1. เห็นชอบในรายงานขอ${verb}ดังกล่าวข้างต้น`} indent={INDENT + 10} style={{ marginBottom: 0 }} />
          <Para
            keep={keep}
            text={`2. อนุมัติให้แต่งตั้ง ${d.inspector_name ?? "...................."} ตำแหน่ง ${d.inspector_position ?? "...................."} เป็นผู้ตรวจรับพัสดุ โดยใช้บันทึกนี้แทนคำสั่งแต่งตั้ง`}
            indent={INDENT + 10}
          />
          <View style={{ flexDirection: "row", marginTop: 14 }} wrap={false}>
            <View style={{ width: L }}>
              <Sign role="เจ้าหน้าที่" name={officer} />
              <Sign role="หัวหน้าเจ้าหน้าที่" name={head} style={{ marginTop: 14 }} />
            </View>
            <View style={{ flex: 1 }}>
              <DirectorTicks />
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, recordDate]} style={{ marginTop: 14 }} />
            </View>
          </View>
        </Page>
      )}

      {/* ๒. รายละเอียดแนบท้ายบันทึกข้อความ */}
      {show("request_attach") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2 * CM }]}>
          <Text style={[styles.bold, { textAlign: "center" }]}>{t(`รายละเอียดแนบท้ายบันทึกข้อความที่ ${d.doc_no}  ลงวันที่ ${recordDate}`)}</Text>
          <Text style={{ textAlign: "center", marginBottom: 10 }}>{t(`${isHire ? "จ้าง" : "ซื้อพัสดุ"} ${d.item_name}`)}</Text>
          <ItemTable
            cols={[
              { label: ["ที่"], width: 26, align: "center" },
              { label: ["รายการ"] },
              { label: ["จำนวน"], width: 46, align: "center" },
              { label: ["หน่วย"], width: 46, align: "center" },
              { label: ["ราคาที่ได้มา", "จากการสืบ", "จากท้องตลาด"], width: 70, align: "right" },
              { label: ["ราคาต่อ", "หน่วย"], width: 56, align: "right" },
              { label: ["จำนวนเงิน"], width: 66, align: "right" },
            ]}
            group={{ label: `จำนวนและวงเงินที่ขอ${verb}ครั้งนี้`, span: 2 }}
            rows={itemRows.map((it) => [String(it.seq), it.name ?? "", num(it.qty), it.unit ?? "", num(it.unit_price), num(it.unit_price), num(it.total)])}
            totalLabel={`รวมเป็นเงินทั้งสิ้น  ( ${amountTextBare} )`}
            total={amount}
            footer={
              <View style={{ flexDirection: "row", marginTop: 24 }}>
                <Sign role="เจ้าหน้าที่" name={officer} style={{ width: L }} />
                <Sign role="หัวหน้าเจ้าหน้าที่" name={head} />
              </View>
            }
          />
        </Page>
      )}

      {/* ๓. ใบเสนอราคา */}
      {show("quote") && (
        <Page size="A4" style={styles.page}>
          <Text style={[styles.title, { marginBottom: 8 }]}>{t("ใบเสนอราคา")}</Text>
          <Text style={styles.gap}>{t(`เรียน      ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            indent={20}
            text={`1. ข้าพเจ้า ${vendorName} อยู่เลขที่ ${v?.house_no ?? "-"} หมู่ที่ ${v?.moo ?? "-"} ตำบล${v?.tambon ?? "-"} อำเภอ${v?.amphoe ?? "-"} จังหวัด${v?.province ?? "-"} โทรศัพท์ ${v?.phone ?? "-"} เลขประจำตัวผู้เสียภาษี ${v?.tax_id ?? "-"} ข้าพเจ้าเป็นผู้มีคุณสมบัติครบถ้วนตามที่กำหนด และไม่เป็นผู้ทิ้งงานของทางราชการ`}
          />
          <Text style={[styles.gap, { marginLeft: 20 }]}>{t("2. ข้าพเจ้าขอเสนอพัสดุ รวมทั้งบริการและกำหนดเวลาส่งมอบ ดังต่อไปนี้")}</Text>
          <ItemTable
            cols={[
              { label: ["ที่"], width: 26, align: "center" },
              { label: [`รายละเอียดพัสดุที่จะขอซื้อ/จ้าง`] },
              { label: ["จำนวนหน่วย"], width: 80, align: "left" },
              { label: ["ราคาต่อ", "หน่วย"], width: 60, align: "right" },
              { label: ["จำนวนเงิน"], width: 70, align: "right" },
            ]}
            rows={itemRows.map((it) => [String(it.seq), it.name ?? "", [num(it.qty), it.unit].filter(Boolean).join(" "), num(it.unit_price), num(it.total)])}
            totalLabel={`รวมเป็นเงินทั้งสิ้น  ( ${amountTextBare} )`}
            total={amount}
            footer={
              <View style={{ marginTop: 4 }}>
                <Text>{t("ซึ่งเป็นราคาที่รวมภาษีมูลค่าเพิ่ม รวมทั้งภาษีอากรอื่น และค่าใช้จ่ายทั้งปวงไว้ด้วยแล้ว")}</Text>
                <Text>{t("3. คำเสนอนี้จะยืนอยู่ในระยะเวลา  30 วัน  นับตั้งแต่วันที่ได้ยื่นใบเสนอราคา")}</Text>
                <Text>{t(`4. กำหนดส่งมอบพัสดุตามรายละเอียดรายการข้างต้น ภายใน ${days} วัน  นับถัดจากวันลงนามในใบสั่ง${verb}`)}</Text>
                <Text>{t(`เสนอมา   ณ   วันที่  ${recordDate}`)}</Text>
                <View style={{ flexDirection: "row", marginTop: 14 }}>
                  <Sign role="ผู้ต่อรองราคา" name={officer} extra={["          เจ้าหน้าที่"]} style={{ width: L }} />
                  <Sign role="ผู้เสนอราคา" name={null} extra={["        ประทับตรา(ถ้ามี)"]} />
                </View>
              </View>
            }
          />
        </Page>
      )}

      {/* ๔. บันทึกข้อความ รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ/สั่งจ้าง */}
      {show("consider") && (
        <Page size="A4" style={styles.page}>
          <MemoHeader unit={unit} docNumber={d.doc_no} isoDate={d.record_date} subject={`รายงานผลการพิจารณาและขออนุมัติสั่ง${verb}`} />
          <Text style={[styles.gap, { marginTop: 4 }]}>{t(isHire ? `เรียน   ผู้อำนวยการ${school}` : "เรียน   หัวหน้าเจ้าหน้าที่")}</Text>
          <Para
            keep={keep}
            text={`ตามที่ผู้อำนวยการ${school} เห็นชอบให้ดำเนินการ${verb} ${d.item_name} โดยวิธีเฉพาะเจาะจง วงเงินงบประมาณจำนวน ${amount} บาท ${amountText} นั้น ขอรายงานผลการพิจารณา${verb} ${d.item_name} โดยวิธีเฉพาะเจาะจง ดังนี้`}
          />
          <View style={{ borderWidth: B, borderBottomWidth: 0, marginTop: 4 }}>
            <View style={{ flexDirection: "row" }}>
              {["รายการพิจารณา", "รายชื่อผู้ยื่นข้อเสนอ", "ราคาที่เสนอ*", `ราคาที่ตกลง${verb}*`].map((h, i) => (
                <View key={i} style={[styles.cell, i < 2 ? { flex: 1 } : { width: 80 }, i === 3 ? { borderRightWidth: 0 } : {}]}>
                  <Text style={{ textAlign: "center" }}>{t(h)}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>
              {[d.item_name, vendorName].map((x, i) => (
                <View key={i} style={[styles.cell, { flex: 1 }]}>
                  {wrap(x, FS, (CONTENT_W - 160) / 2 - 8 - SLACK, (CONTENT_W - 160) / 2 - 8 - SLACK, keep).map((l, j) => (
                    <Text key={j}>{t(l)}</Text>
                  ))}
                </View>
              ))}
              <View style={[styles.cell, { width: 80 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
              <View style={[styles.cell, { width: 80, borderRightWidth: 0 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={[styles.cell, { flex: 1 }]}>
                <Text style={{ textAlign: "center" }}>{t(`รวม ( ${amountTextBare} )`)}</Text>
              </View>
              <View style={[styles.cell, { width: 80, borderRightWidth: 0 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: FS_SMALL, marginBottom: 8 }}>
            {t("* ราคาที่เสนอ และราคาที่ตกลงซื้อหรือจ้าง เป็นราคารวมภาษีมูลค่าเพิ่มและภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่นๆ ทั้งปวง")}
          </Text>
          <Text>{t("โดยเกณฑ์การพิจารณาผลการยื่นข้อเสนอครั้งนี้ จะพิจารณาตัดสินโดยใช้หลักเกณฑ์ราคา")}</Text>
          <Para keep={keep} text={`งานพัสดุ${school} พิจารณาแล้ว เห็นสมควร${isHire ? "จัดจ้าง" : "จัดซื้อ"}จากผู้เสนอราคาดังกล่าว`} style={{ marginBottom: 0 }} />
          <Para keep={keep} text="จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบขอได้โปรดอนุมัติให้สั่งซื้อสั่งจ้างจากผู้เสนอราคาดังกล่าว" />
          <Sign role="เจ้าหน้าที่" name={officer} style={{ marginLeft: L, marginTop: 14 }} />
          {isHire ? (
            <>
              <Sign role="หัวหน้าเจ้าหน้าที่" name={head} style={{ marginLeft: L, marginTop: 12 }} />
              <View style={{ marginTop: 12 }} wrap={false}>
                <DirectorTicks />
                <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`]} style={{ marginTop: 14 }} />
              </View>
            </>
          ) : (
            <>
              <View style={{ marginTop: 14 }} wrap={false}>
                <Text>{t("- อนุมัติ")}</Text>
                <Text>{t("- ลงนามแล้ว")}</Text>
              </View>
              <Sign role="หัวหน้าเจ้าหน้าที่" name={head} style={{ marginTop: 14 }} />
            </>
          )}
        </Page>
      )}

      {/* ๕. ใบสั่งซื้อ / ใบสั่งจ้าง */}
      {show("order") && (
        <Page size="A4" style={styles.page}>
          <Text style={[styles.title, { marginBottom: 10 }]}>{t(`ใบสั่ง${verb}`)}</Text>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <View style={{ width: CONTENT_W * 0.58 }}>
              <Text>{t(`${party}  ${vendorName}`)}</Text>
              <Text>{t(`ที่อยู่   ${v?.house_no ?? "-"}  หมู่ที่ ${v?.moo ?? "-"}  ตำบล ${v?.tambon ?? "-"}`)}</Text>
              <Text>{t(`อำเภอ ${v?.amphoe ?? "-"}  จังหวัด ${v?.province ?? "-"}`)}</Text>
              <Text>{t(`โทรศัพท์ ${v?.phone ?? ""}`)}</Text>
              <Text>{t(`เลขประจำตัวผู้เสียภาษี  ${v?.tax_id ?? "-"}`)}</Text>
              <Text>{t("เลขที่บัญชีเงินฝากธนาคาร    ..............................")}</Text>
              <Text>{t("ชื่อบัญชี   ..................................................")}</Text>
              <Text>{t("ธนาคาร   .............................. สาขา ...................")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text>{t(`ใบสั่ง${verb} เลขที่  ${d.doc_no}`)}</Text>
              <Text>{t(`วันที่  ${orderDate}`)}</Text>
              <Text>{t(school)}</Text>
              {schoolAddressLines(d.school_address).map((l, i) => (
                <Text key={i}>{t(i === 0 ? `ที่อยู่  ${l}` : l)}</Text>
              ))}
              {d.school_phone ? <Text>{t(`โทรศัพท์  ${d.school_phone}`)}</Text> : null}
            </View>
          </View>
          <Para
            keep={keep}
            indent={0}
            text={`ตามที่ ${vendorName} ได้เสนอราคา ตามใบเสนอราคาเลขที่....... ลงวันที่ ${orderDate} ไว้ต่อ${school} ซึ่งได้รับราคาและตกลง${verb} ตามรายการดังต่อไปนี้`}
          />
          <View style={{ borderWidth: B, borderBottomWidth: 0, marginBottom: 6 }}>
            <View style={{ flexDirection: "row" }}>
              {[
                { l: ["ลำดับ"], w: 40 },
                { l: ["รายการ"] },
                { l: ["จำนวน"], w: 50 },
                { l: ["หน่วย"], w: 50 },
                { l: ["ราคาต่อหน่วย", "(บาท)"], w: 75 },
                { l: ["จำนวนเงิน", "(บาท)"], w: 75 },
              ].map((c, i) => (
                <View key={i} style={[styles.cell, c.w ? { width: c.w } : { flex: 1 }, { justifyContent: "center" }, i === 5 ? { borderRightWidth: 0 } : {}]}>
                  {c.l.map((x, j) => (
                    <Text key={j} style={{ textAlign: "center" }}>
                      {t(x)}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={[styles.cell, { width: 40 }]}>
                <Text style={{ textAlign: "center" }}>1</Text>
              </View>
              <View style={[styles.cell, { flex: 1 }]}>
                <Text>{t(`${verb} ${d.item_name}`)}</Text>
                <Text>{t("(รายละเอียดดังแนบ)")}</Text>
              </View>
              <View style={[styles.cell, { width: 50 }]}>
                <Text style={{ textAlign: "center" }}>1</Text>
              </View>
              <View style={[styles.cell, { width: 50 }]}>
                <Text style={{ textAlign: "center" }}>{t("รายการ")}</Text>
              </View>
              <View style={[styles.cell, { width: 75 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
              <View style={[styles.cell, { width: 75, borderRightWidth: 0 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row" }}>
              <View style={[styles.cell, { flex: 1 }]}>
                <Text style={{ textAlign: "center" }}>{t(`( ${amountTextBare} )`)}</Text>
              </View>
              <View style={[styles.cell, { width: 125 }]}>
                <Text style={{ textAlign: "center" }}>{t("รวมเป็นเงินทั้งสิ้น")}</Text>
              </View>
              <View style={[styles.cell, { width: 75, borderRightWidth: 0 }]}>
                <Text style={{ textAlign: "right" }}>{amount}</Text>
              </View>
            </View>
          </View>
          <Text>{t(`การสั่ง${verb}อยู่ภายใต้เงื่อนไขต่อไปนี้`)}</Text>
          <View style={{ marginLeft: 16 }}>
            <Text>{t(`1. กำหนดส่งมอบภายใน ${days} วัน นับถัดจากวันที่${party}ได้รับใบสั่ง${verb}`)}</Text>
            <Text>{t(`2. ครบกำหนดส่งมอบวันที่  ${deliveryDate}`)}</Text>
            <Text>{t(`3. สถานที่ส่งมอบ ${school}`)}</Text>
            <Text>{t("4. ระยะเวลารับประกัน  -")}</Text>
          </View>
          <Para
            keep={keep}
            indent={16}
            text={
              isHire
                ? `5. สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ ${penalty.toFixed(2)} ของราคาจ้างแต่ต้องไม่ต่ำกว่าวันละ 100.00 บาท นับตั้งแต่วันที่ล่วงเลยกำหนดแล้วเสร็จตามใบสั่งจ้างจนถึงวันที่งานแล้วเสร็จบริบูรณ์`
                : `5. สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ ${penalty.toFixed(2)} ของราคาสิ่งของที่ยังไม่ได้รับมอบ`
            }
            style={{ marginBottom: 0 }}
          />
          <Para
            keep={keep}
            indent={16}
            text={`6. โรงเรียนสงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่าสินค้านั้นมีลักษณะไม่ตรงตามรายการที่ระบุไว้ในใบสั่ง${verb}${isHire ? " กรณีนี้ผู้รับจ้างจะต้องดำเนินการเปลี่ยนใหม่ให้ถูกต้องตามใบสั่งจ้างทุกประการ" : ""}`}
          />
          <View style={{ flexDirection: "row", marginTop: 24 }} wrap={false}>
            <Sign role={`ผู้สั่ง${verb}`} name={orderer.name} extra={[`ตำแหน่ง ${orderer.position}`, `วันที่ ${orderDate}`]} style={{ width: L }} />
            <Sign role={party} name={null} extra={["ตำแหน่ง ..............................", `วันที่ ${orderDate}`]} />
          </View>
        </Page>
      )}

      {/* ใบส่งมอบงาน (เฉพาะงานจ้าง) */}
      {show("handover") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
          <Text style={[styles.title, { marginBottom: 14 }]}>{t("ใบส่งมอบงาน")}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text>{t(`เขียนที่ ${school}`)}</Text>
          </View>
          <Text style={{ marginLeft: CONTENT_W / 2 - 40, marginBottom: 14 }}>{t(`วันที่ ${deliveredDate}`)}</Text>
          <Text style={styles.gap}>{t("เรื่อง    ส่งมอบงานจ้างและขอเบิกเงิน")}</Text>
          <Text style={{ marginBottom: 10 }}>{t(`เรียน    ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            text={`ตามที่ ${school} ได้ตกลงให้ข้าพเจ้า ${vendorName} เพื่อดำเนินการจ้าง ${d.item_name} โดยวิธีเฉพาะเจาะจง ตามใบสั่งจ้าง เลขที่ ${d.doc_no} ลงวันที่ ${orderDate} นั้น`}
          />
          <Para
            keep={keep}
            text={`บัดนี้ ข้าพเจ้าได้ปฏิบัติตามใบสั่งจ้างเสร็จเรียบร้อยแล้ว จึงขอส่งมอบงานจ้าง เพื่อตรวจรับและขอเบิกจ่ายเงินค่าจ้างให้กับข้าพเจ้า จำนวน ${amount} บาท ${amountText} ต่อไป`}
          />
          <Text style={{ marginLeft: L + 30, marginTop: 14 }}>{t("ขอแสดงความนับถือ")}</Text>
          <Sign role="" name={null} style={{ marginLeft: L, marginTop: 20 }} />
        </Page>
      )}

      {/* ๖. รายละเอียดแนบท้ายใบสั่งซื้อ / ใบสั่งจ้าง */}
      {show("order_attach") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2 * CM }]}>
          <Text style={[styles.bold, { textAlign: "center" }]}>{t(`รายละเอียดแนบท้ายใบสั่ง${verb}ที่ ${d.doc_no}  ลงวันที่ ${orderDate}`)}</Text>
          <Text style={{ textAlign: "center", marginBottom: 10 }}>{t(`${isHire ? "จ้าง" : "ซื้อพัสดุ"} ${d.item_name}`)}</Text>
          <ItemTable
            cols={[
              { label: ["ที่"], width: 26, align: "center" },
              { label: ["รายการ"] },
              { label: ["จำนวน"], width: 50, align: "center" },
              { label: ["หน่วย"], width: 50, align: "center" },
              { label: ["หน่วยละ"], width: 62, align: "right" },
              { label: ["จำนวนเงิน"], width: 70, align: "right" },
            ]}
            group={{ label: `จำนวนและวงเงินที่ขอ${verb}ครั้งนี้`, span: 2 }}
            rows={itemRows.map((it) => [String(it.seq), it.name ?? "", num(it.qty), it.unit ?? "", num(it.unit_price), num(it.total)])}
            totalLabel={`รวมเป็นเงินทั้งสิ้น  ( ${amountTextBare} )`}
            total={amount}
            footer={
              <View style={{ flexDirection: "row", marginTop: 24 }}>
                <Sign role={`ผู้สั่ง${verb}`} name={orderer.name} extra={[`ตำแหน่ง ${orderer.position}`, `วันที่ ${orderDate}`]} style={{ width: L }} />
                <Sign role={party} name={null} extra={["ตำแหน่ง ..............................", `วันที่ ${orderDate}`]} />
              </View>
            }
          />
        </Page>
      )}

      {/* ๗. ใบตรวจรับพัสดุ */}
      {show("inspect") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
          <Text style={[styles.title, { marginBottom: 2 }]}>{t("ใบตรวจรับพัสดุ")}</Text>
          <Text style={{ textAlign: "center", marginBottom: 14 }}>{t("ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175")}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text>{t(`เขียนที่ ${school}`)}</Text>
          </View>
          <Text style={[styles.gap, { marginLeft: CONTENT_W / 2 - 40 }]}>{t(`วันที่ ${inspectedDate}`)}</Text>
          <Para
            keep={keep}
            text={`ตามที่${school} ได้จัด${verb} ${d.item_name} จาก ${vendorName} ตามบันทึกข้อความ/ใบสั่ง${verb}เลขที่ ${d.doc_no} ลงวันที่ ${orderDate} เพื่อให้ผู้ตรวจรับ ทำการตรวจรับพัสดุ ซึ่งผลการตรวจรับเป็นดังนี้`}
          />
          <View style={{ marginLeft: INDENT / 2, marginBottom: 6 }}>
            <Text>{t(`1. ครบกำหนดส่งมอบวันที่ ${deliveryDate}`)}</Text>
            <Text>{t(`2. ส่งมอบเมื่อวันที่ ${deliveredDate}`)}</Text>
            <Text>
              {t(isHire ? `3. ตรวจรับพัสดุตามใบส่งมอบงาน เลขที่...............ลงวันที่ ${deliveredDate}` : `3. ตรวจรับพัสดุตามใบส่งของ เล่มที่..........เลขที่..................ลงวันที่ ${deliveredDate}`)}
            </Text>
            <Text>{t(`4. ได้ตรวจรับ${isHire ? "งานจ้าง" : "พัสดุ"}ถูกต้องทุกประการ ตั้งแต่วันที่ ${inspectedDate}`)}</Text>
            <Text>
              {t(
                lateDays > 0
                  ? `5. ส่งมอบ${thing}เกินกำหนด ${lateDays} วัน  ค่าปรับวันละ ${formatBaht(finePerDay)} บาท  รวมค่าปรับ ${formatBaht(fineTotal)} บาท`
                  : `5. ส่งมอบ${thing}เกินกำหนด......-....วัน  ค่าปรับวันละ......-......บาท  รวมค่าปรับ..........-.........บาท`,
              )}
            </Text>
          </View>
          <Para
            keep={keep}
            text={`จึงขอเสนอรายงานต่อผู้อำนวยการ${school} เพื่อโปรดทราบ ตามนัยข้อ 175 (4) แห่งระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560`}
          />
          <Sign role="ผู้ตรวจรับพัสดุ" name={d.inspector_name} style={{ marginLeft: L - 40, marginTop: 30 }} />
        </Page>
      )}

      {/* ๘. บันทึกข้อความ รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน */}
      {show("disburse") && (
        <Page size="A4" style={styles.page}>
          <MemoHeader unit={unit} docNumber={null} isoDate={reportIso} subject="รายงานผลการตรวจรับพัสดุและขออนุมัติเบิกจ่ายเงิน" />
          <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            text={`ตามที่${school} ได้จัด${verb} ${d.item_name} จาก ${vendorName} ตามบันทึกข้อความ/ใบสั่ง${verb}เลขที่ ${d.doc_no} ลงวันที่ ${orderDate} ครบกำหนดส่งมอบวันที่ ${deliveryDate}`}
          />
          <Para
            keep={keep}
            text={`บัดนี้ผู้ตรวจรับพัสดุได้ตรวจรับพัสดุตามใบสั่ง${verb}ถูกต้อง และได้รับมอบพัสดุเมื่อวันที่ ${deliveredDate} ซึ่งจะต้องจ่ายเงิน ให้แก่${party} เป็นเงิน ${amount} บาท${fineTotal > 0 ? ` หักค่าปรับ ${dash(fineTotal)} บาท` : ""} หักภาษี ณ ที่จ่าย...-...บาท คงเหลือ ${formatBaht(payable)} บาท`}
          />
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนเพื่อโปรด")}</Text>
          <View style={{ marginLeft: INDENT + 20 }}>
            <Text>{t("1. ทราบผลการตรวจรับตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและ")}</Text>
            <Text style={{ marginLeft: 12 }}>{t("การบริหารพัสดุภาครัฐ พ.ศ. 2560")}</Text>
          </View>
          <Para
            keep={keep}
            indent={INDENT + 20}
            text={`2. อนุมัติเบิกจ่ายเงินให้แก่ ${vendorName}${isHire ? "" : " หรือผู้ทดรองจ่ายไปก่อน"} เป็นเงิน ${formatBaht(payable)} บาท ${thaiBahtText(payable)}`}
          />
          <Sign role="เจ้าหน้าที่" name={officer} style={{ marginLeft: L, marginTop: 14 }} />
          <Sign role="หัวหน้าเจ้าหน้าที่" name={head} style={{ marginLeft: L, marginTop: 12 }} />
          <View style={{ marginTop: 10 }} wrap={false}>
            <View style={{ marginLeft: 20 }}>
              <DirectorTicks />
            </View>
            <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`]} style={{ marginTop: 14 }} />
          </View>
        </Page>
      )}

      {/* ===== ว.804 ซื้อไม่เกิน 50,000 บาท ===== */}
      {/* ว.804 หัวข้อ 1: รายการน้อยใส่ในบันทึกเลย ถ้าเกิน W804_INLINE_MAX รายการ (หน้าแรกจะล้น) ให้อ้างรายละเอียดแนบหน้า 2 แทน */}
      {show("w804_request") && (
        <Page size="A4" style={styles.page}>
          <MemoHeader unit={unit} docNumber={d.doc_no} isoDate={d.record_date} subject={`รายงานขอซื้อ${d.item_name} โดยวิธีเฉพาะเจาะจง`} />
          <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            text={`ด้วย${d.admin_group ?? "-"} มีความประสงค์จะซื้อ ${d.item_name} จำนวน ${d.items.length} รายการ สำหรับโครงการ/กิจกรรม ${plan || "-"} โดยวิธีเฉพาะเจาะจง ประจำปีงบประมาณ พ.ศ. ${fy} ตาม${W804_REF} ซึ่งได้รับยกเว้นการปฏิบัติตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 22 วรรคหนึ่ง ข้อ 79 วรรคหนึ่ง และข้อ 175 (1) ซึ่งมีรายละเอียดดังต่อไปนี้`}
          />
          {[
            ["1. รายละเอียดคุณลักษณะเฉพาะของพัสดุหรือขอบเขตของงาน (ระเบียบฯ ข้อ 21 วรรคหนึ่ง)", w804SpecText ?? "รายละเอียดตามคุณลักษณะเฉพาะของพัสดุหรือขอบเขตของงาน ที่แนบ"] as [string, string | string[]],
            ["2. วงเงินที่จะซื้อ", `วงเงินงบประมาณ ${amount} บาท ${amountText}`],
            ["3. ราคากลางของพัสดุที่จะซื้อ", `จำนวน ${amount} บาท ${amountText} โดยใช้วงเงินตาม (2) เป็นราคากลางของพัสดุที่จะซื้อในครั้งนี้`],
            [
              "4. ผู้รับผิดชอบในการจัดซื้อ",
              `มอบหมายให้ ${d.inspector_name ?? "...................."} ตำแหน่ง ${d.inspector_position ?? "...................."} เป็นผู้มีหน้าที่ดำเนินการจัดซื้อกับผู้ประกอบการที่มีอาชีพขายพัสดุโดยตรง และเป็นผู้ตรวจรับพัสดุในครั้งนี้`,
            ],
          ].map(([h, body]) => (
            <View key={h as string} style={{ marginBottom: 2 }}>
              <Text style={{ marginLeft: INDENT }}>{t(h as string)}</Text>
              {(Array.isArray(body) ? body : [body]).map((line, i) => (
                Array.isArray(body) ? (
                  <Para key={i} keep={keep} text={line} indent={INDENT + 20} restIndent={INDENT + 34} style={{ marginBottom: 0 }} />
                ) : (
                  <Para key={i} keep={keep} text={line} style={{ marginBottom: 0 }} />
                )
              ))}
            </View>
          ))}
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบได้โปรด")}</Text>
          <Para keep={keep} indent={INDENT + 20} text="1. เห็นชอบรายละเอียดคุณลักษณะเฉพาะของพัสดุหรือขอบเขตของงานตามข้อ (1)" style={{ marginBottom: 0 }} />
          <Para keep={keep} indent={INDENT + 20} text="2. อนุมัติให้ดำเนินการ และมอบหมายผู้รับผิดชอบดำเนินการจัดซื้อ ตามรายละเอียดในรายงานขอซื้อดังกล่าวข้างต้น" />
          {/* ส่วนท้ายแบบเดียวกับรายงานขอซื้อ/ขอจ้างปกติ */}
          <View style={{ flexDirection: "row", marginTop: 8 }} wrap={false}>
            <View style={{ width: L }}>
              <Sign role="เจ้าหน้าที่" name={officer} />
              <Sign role="หัวหน้าเจ้าหน้าที่" name={head} style={{ marginTop: 14 }} />
            </View>
            <View style={{ flex: 1 }}>
              <DirectorTicks />
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, recordDate]} style={{ marginTop: 14 }} />
            </View>
          </View>
        </Page>
      )}

      {show("w804_spec") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2 * CM }]}>
          <Text style={[styles.bold, { textAlign: "center" }]}>{t("รายละเอียดคุณลักษณะเฉพาะของพัสดุที่จะดำเนินการซื้อ")}</Text>
          <Text style={{ textAlign: "center" }}>{t(`งานจัดซื้อวัสดุโครงการ/กิจกรรม ${plan || "-"} จำนวน ${d.items.length} รายการ`)}</Text>
          <Text style={{ textAlign: "center", marginBottom: 10 }}>{t(`แนบท้ายบันทึกข้อความ ที่ ${d.doc_no} ลงวันที่ ${recordDate}`)}</Text>
          <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B }} fixed>
              {[
                ["ลำดับ", 40],
                ["ชื่อพัสดุ และรายละเอียดคุณลักษณะเฉพาะ", 0],
                ["จำนวน", 60],
                ["หน่วยนับ", 70],
              ].map(([h, w]) => (
                <View key={h} style={[styles.cell, w ? { width: Number(w) } : { flex: 1 }]}>
                  <Text style={[styles.bold, { textAlign: "center" }]}>{t(String(h))}</Text>
                </View>
              ))}
            </View>
            {itemRows.map((it) => {
              const nameW = CONTENT_W - 170 - 2 * B - 6 - SLACK;
              return (
                <View key={it.seq} style={{ flexDirection: "row", borderLeftWidth: B }} wrap={false}>
                  <View style={[styles.cell, { width: 40 }]}>
                    <Text style={{ textAlign: "center" }}>{it.seq}</Text>
                  </View>
                  <View style={[styles.cell, { flex: 1 }]}>
                    {wrap(it.name ?? "", FS, nameW, nameW).map((l, j) => (
                      <Text key={j}>{t(l)}</Text>
                    ))}
                  </View>
                  <View style={[styles.cell, { width: 60 }]}>
                    <Text style={{ textAlign: "center" }}>{num(it.qty)}</Text>
                  </View>
                  <View style={[styles.cell, { width: 70 }]}>
                    <Text style={{ textAlign: "center" }}>{t(it.unit ?? "")}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <Sign role="" name={d.spec_author || d.inspector_name} extra={["ผู้รับผิดชอบจัดทำคุณลักษณะเฉพาะ"]} style={{ marginLeft: L, marginTop: 24 }} />
        </Page>
      )}

      {show("w804_report") && (
        <Page size="A4" style={styles.page}>
          <MemoHeader
            unit={unit}
            docNumber={null}
            isoDate={reportIso}
            subject={`รายงานสรุปผลการจัดซื้อ${d.item_name} โดยวิธีเฉพาะเจาะจง และอนุมัติเบิกจ่าย`}
          />
          <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
          <Para
            keep={keep}
            text={`ตามที่ผู้อำนวยการ${school} เห็นชอบให้ดำเนินการซื้อ ${d.item_name} จำนวน ${d.items.length} รายการ สำหรับโครงการ/กิจกรรม ${plan || "-"} โดยวิธีเฉพาะเจาะจง ประจำปีงบประมาณ พ.ศ. ${fy} นั้น`}
          />
          <Para keep={keep} text={`เจ้าหน้าที่ผู้รับผิดชอบได้ดำเนินการจัดซื้อกับผู้ประกอบการโดยตรงตาม${W804_REF} ขอรายงานผลการดำเนินการ ดังนี้`} />
          <Text style={{ marginLeft: INDENT }}>{t(`ชื่อผู้ประกอบการ ${vendorName}`)}</Text>
          <Text style={{ marginLeft: INDENT, marginBottom: 4 }}>{t("รายการ จำนวน และจำนวนเงินที่ได้จัดซื้อ")}</Text>
          <ItemTable
            cols={[
              { label: ["ที่"], width: 26, align: "center" },
              { label: ["รายการจัดซื้อ"] },
              { label: ["จำนวน"], width: 50, align: "center" },
              { label: ["หน่วยนับ"], width: 56, align: "center" },
              { label: ["ราคา", "ต่อหน่วย"], width: 66, align: "right" },
              { label: ["จำนวนเงิน"], width: 76, align: "right" },
            ]}
            minRows={0}
            rows={itemRows.map((it) => [String(it.seq), it.name ?? "", num(it.qty), it.unit ?? "", num(it.unit_price), num(it.total)])}
            totalLabel={`รวมเป็นเงิน  ( ${amountTextBare} )`}
            total={amount}
            footer={<Text style={{ fontSize: FS_SMALL }}>{t("**ซึ่งเป็นราคาที่รวมภาษีมูลค่าเพิ่มและค่าใช้จ่ายทั้งปวงไว้แล้วด้วย")}</Text>}
          />
          {/* ย่อหน้าผลการจัดซื้อจนถึงส่วนลงชื่อ ไม่แยกหน้า — ล้นหน้าให้ขึ้นหน้าใหม่ทั้งก้อน */}
          <View wrap={false}>
            <Para
              keep={keep}
              text={`การจัดซื้อคราวนี้ไม่เกินวงเงินที่ประมาณไว้ และเห็นว่าเป็นราคาที่เหมาะสม และได้ใช้${
                d.funding === "loan"
                  ? `เงินยืมตามสัญญา เลขที่ ${d.loan_contract_no ?? "......"} ลงวันที่ ${d.loan_date ? formatThaiDate(d.loan_date) : "......"}`
                  : "เงินสดสำรองจ่าย"
              } ชำระให้ผู้ขายเรียบร้อยแล้ว ตามหลักฐานการรับเงิน ${d.receipt_type?.trim() || "ใบเสร็จรับเงิน"} เล่มที่ ${d.receipt_book ?? "......"} เลขที่ ${d.receipt_no ?? "......"} ลงวันที่ ${
                d.receipt_date ? formatThaiDate(d.receipt_date) : "......"
              } และได้รับมอบพัสดุไว้ครบถ้วนเรียบร้อยแล้ว เมื่อวันที่ ${d.delivered_date ? formatThaiDate(d.delivered_date) : "......"}`}
            />
            <Sign role="ผู้ตรวจรับพัสดุ (ผู้ได้รับมอบหมาย)" name={d.inspector_name} style={{ marginLeft: L - 50, marginTop: 4 }} />
            <Text style={{ marginLeft: INDENT, marginTop: 16 }}>{t("จึงเรียนมาเพื่อโปรดทราบและขออนุมัติเบิกจ่ายต่อไป")}</Text>
            <Sign role="เจ้าหน้าที่" name={officer} style={{ marginLeft: L - 50, marginTop: 6 }} />
            <View style={{ marginTop: 6 }}>
              <DirectorTicks />
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, formatThaiDate(reportIso)]} style={{ marginTop: 10 }} />
            </View>
          </View>
        </Page>
      )}

      {show("w804_receipt") && (
        <Page size="A4" style={[styles.page, { paddingTop: 2 * CM }]}>
          <Text style={[styles.title, { marginBottom: 10 }]}>{t(`ใบติด${d.receipt_type?.trim() || "ใบเสร็จรับเงิน"}`)}</Text>
          <View style={{ height: 300, borderWidth: B, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Text style={{ color: "#94a3b8" }}>{t(`ติด${d.receipt_type?.trim() || "ใบเสร็จรับเงิน"}`)}</Text>
          </View>
          <Para
            keep={keep}
            text={`จำนวนเงินตาม${d.receipt_type?.trim() || "ใบเสร็จรับเงิน"} เล่มที่ ${d.receipt_book ?? "......"} เลขที่ ${d.receipt_no ?? "......"} ลงวันที่ ${d.receipt_date ? formatThaiDate(d.receipt_date) : "......"}`}
          />
          <Para
            keep={keep}
            text={`ข้าพเจ้าได้ทดรองจ่ายไปก่อนแล้ว เป็นจำนวนเงิน ${amount} บาท ${amountText} และได้รับมอบพัสดุไว้ครบถ้วนถูกต้องแล้ว ข้าพเจ้าขอเบิกเงินจัดซื้อ ${d.item_name} โดยวิธีเฉพาะเจาะจง จำนวนเงิน ${amount} บาท ${amountText}`}
          />
          <Sign role="ผู้ขอเบิก" name={d.inspector_name} extra={[`ตำแหน่ง ${d.inspector_position ?? "......................"}`]} style={{ marginLeft: L, marginTop: 20 }} />
        </Page>
      )}
    </Document>
  );
}

/** "เลขที่ 99 หมู่ที่ 10 ตำบลตาเบา อำเภอปราสาท จังหวัดสุรินทร์" → ["เลขที่ 99 หมู่ที่ 10 ตำบลตาเบา", "อำเภอปราสาท จังหวัดสุรินทร์"] */
function schoolAddressLines(address: string | null): string[] {
  if (!address) return [];
  const cut = address.search(/อำเภอ|เขต/);
  return cut > 0 ? [address.slice(0, cut).trim(), address.slice(cut).trim()] : [address];
}
