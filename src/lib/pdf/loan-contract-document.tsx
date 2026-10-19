import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import type { LoanItem, LoanRepayment } from "@/lib/loan";
import { shortThaiDate } from "@/lib/procurement-register";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// สัญญาการยืมเงิน (แบบที่กระทรวงการคลังกำหนด ตามระเบียบฯ การเบิกเงินจากคลัง พ.ศ. 2562 ข้อ 55) — A4 แนวตั้ง 2 หน้า
//  หน้า 1 (ด้านหน้า): ยื่นต่อ/เลขที่/วันครบกำหนด · ข้าพเจ้า…ขอยืมเงินจาก…เพื่อเป็นค่าใช้จ่ายในการ… · ตารางรายละเอียด ·
//         ข้อสัญญา · ลายมือชื่อผู้ยืม · เสนอ (ตรวจสอบแล้ว) · คำอนุมัติ · ใบรับเงิน
//  หน้า 2 (ด้านหลัง): รายการส่งใช้ (ครั้งที่ วันที่ เงินสด/ใบสำคัญ จำนวนเงิน คงค้าง ลายมือชื่อผู้รับ ใบรับเลขที่) + หมายเหตุ
// ข้อ 61 จัดทำสองฉบับ (ส่วนราชการเก็บ 1 ผู้ยืมเก็บ 1) — พิมพ์ 2 ชุดเอง — TH Sarabun New 16pt

registerThSarabunFont();
const FAMILY = "THSarabunNew";
const FS = 16;
const CM = 28.3465;
const B = 0.8;
const PAD_L = 2.5 * CM;
const PAD_R = 2 * CM;
const CONTENT_W = 595.28 - PAD_L - PAD_R;
const DOTS = "....................................";

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.12, paddingTop: 1.2 * CM, paddingBottom: 1 * CM, paddingLeft: PAD_L, paddingRight: PAD_R },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 6 },
  bold: { fontWeight: "bold" },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 4, paddingVertical: 1 },
  head: { fontWeight: "bold", textAlign: "center" },
  section: { marginTop: 5, borderTopWidth: 0.5, paddingTop: 2 },
});

export type LoanContractData = {
  doc_no: string | null;
  request_date: string;
  due_date: string | null;
  school_name: string;
  submit_to: string;
  borrower_name: string;
  borrower_position: string | null;
  affiliation: string;
  province: string;
  fund_source: string | null;
  purpose: string;
  items: LoanItem[];
  amount: number;
  due_days: number;
  due_basis: string;
  received_date: string | null;
  checker_name: string | null;
  checker_position: string | null;
  approver_name: string | null;
  approver_position: string | null;
  repayments: LoanRepayment[];
};

const dateOr = (iso: string | null | undefined) => (iso ? formatThaiDate(iso) : "..............................");

function Para({ text, indent = true, keep = [] }: { text: string; indent?: boolean; keep?: string[] }) {
  const first = indent ? CONTENT_W - 2.5 * CM - 6 : CONTENT_W - 6;
  return (
    <View>
      {wrapByWidth(text, FS, first, CONTENT_W - 6, false, FAMILY, keep).map((l, i) => (
        <Text key={i} style={i === 0 && indent ? { marginLeft: 2.5 * CM } : undefined}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

function Sign({ role, name, position, date }: { role: string; name: string | null; position?: string | null; date?: string | null }) {
  return (
    <View style={{ marginLeft: CONTENT_W / 2 - 90, width: CONTENT_W / 2 + 90, alignItems: "center", marginTop: 6 }} wrap={false}>
      <Text>{t(`ลงชื่อ.................................................${role}`)}</Text>
      <Text>{t(name ? `(${name})` : `(${DOTS})`)}</Text>
      {position !== undefined && date !== undefined ? (
        <Text>{t(`ตำแหน่ง ${position || DOTS}  วันที่ ${dateOr(date)}`)}</Text>
      ) : (
        <>
          {position !== undefined && <Text>{t(`ตำแหน่ง ${position || DOTS}`)}</Text>}
          {date !== undefined && <Text>{t(`วันที่ ${dateOr(date)}`)}</Text>}
        </>
      )}
    </View>
  );
}

function FrontPage({ d }: { d: LoanContractData }) {
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const rows = d.items.length > 0 ? d.items : [{ detail: d.purpose, amount: d.amount }];
  const minRows = Math.max(0, 3 - rows.length);
  const detailW = CONTENT_W - 110;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{t("สัญญาการยืมเงิน")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ width: CONTENT_W - 190 }}>{t(`ยื่นต่อ  ${d.submit_to}`)}</Text>
        <View style={{ width: 190 }}>
          <Text>{t(`สัญญาเลขที่  ${d.doc_no || "................"}`)}</Text>
          <Text>{t(`วันครบกำหนด  ${dateOr(d.due_date)}`)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 4 }}>
        <Para
          text={`ข้าพเจ้า ${d.borrower_name} ตำแหน่ง ${d.borrower_position || DOTS} สังกัด ${d.affiliation} จังหวัด${d.province} มีความประสงค์ขอยืมเงินจาก ${d.fund_source || DOTS} เพื่อเป็นค่าใช้จ่ายในการ${d.purpose.replace(/^เพื่อ(เป็นค่าใช้จ่ายในการ)?\s*/, "")} ดังรายละเอียดต่อไปนี้`}
          keep={[d.borrower_name, d.school_name.replace(/^โรงเรียน/, "")]}
        />
      </View>
      <View style={{ borderTopWidth: B, borderLeftWidth: B, marginTop: 4 }}>
        <View style={{ flexDirection: "row" }}>
          <Text style={[styles.cell, styles.head, { width: detailW }]}>{t("รายละเอียด")}</Text>
          <Text style={[styles.cell, styles.head, { width: 110 }]}>{t("จำนวนเงิน (บาท)")}</Text>
        </View>
        {rows.map((it, i) => (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            <View style={[styles.cell, { width: detailW }]}>
              {wrapByWidth(`${rows.length > 1 ? `${i + 1}. ` : ""}${it.detail}`, FS, detailW - 10, detailW - 10, false, FAMILY).map((l, j) => (
                <Text key={j}>{t(l)}</Text>
              ))}
            </View>
            <Text style={[styles.cell, { width: 110, textAlign: "right" }]}>{t(formatBaht(it.amount))}</Text>
          </View>
        ))}
        {Array.from({ length: minRows }, (_, i) => (
          <View key={`e${i}`} style={{ flexDirection: "row" }}>
            <Text style={[styles.cell, { width: detailW }]}>{t(" ")}</Text>
            <Text style={[styles.cell, { width: 110 }]}>{t(" ")}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row" }}>
          <Text style={[styles.cell, styles.bold, { width: detailW, textAlign: "center" }]}>{t(`รวมเงิน  ${amountText}`)}</Text>
          <Text style={[styles.cell, styles.bold, { width: 110, textAlign: "right" }]}>{t(amount)}</Text>
        </View>
      </View>
      <View style={{ marginTop: 6 }}>
        <Para
          text={`ข้าพเจ้าสัญญาว่าจะปฏิบัติตามระเบียบของทางราชการทุกประการ และจะนำใบสำคัญคู่จ่ายที่ถูกต้อง พร้อมทั้งเงินเหลือจ่าย (ถ้ามี) ส่งใช้ภายในกำหนดไว้ในระเบียบการเบิกจ่ายเงินจากคลัง คือภายใน ${d.due_days} วัน ${d.due_basis} ถ้าข้าพเจ้าไม่ส่งตามกำหนด ข้าพเจ้ายินยอมให้หักเงินเดือน ค่าจ้าง เบี้ยหวัด บำเหน็จ บำนาญ หรือเงินอื่นใดที่ข้าพเจ้าจะพึงได้รับจากทางราชการ ชดใช้จำนวนเงินที่ยืมไปจนครบถ้วนได้ทันที`}
        />
      </View>
      <Sign role="ผู้ยืม" name={d.borrower_name} date={d.request_date} />

      <View style={styles.section} wrap={false}>
        <Text>{t(`เสนอ  ${d.submit_to}`)}</Text>
        <Para text={`ได้ตรวจสอบแล้ว เห็นสมควรอนุมัติให้ยืมตามใบยืมฉบับนี้ได้ จำนวน ${amount} บาท ${amountText}`} />
        <Sign role="" name={d.checker_name} position={d.checker_position} date={null} />
      </View>

      <View style={styles.section} wrap={false}>
        <Text style={styles.bold}>{t("คำอนุมัติ")}</Text>
        <Para text={`อนุมัติให้ยืมตามเงื่อนไขข้างต้นได้ เป็นเงิน ${amount} บาท ${amountText}`} />
        <Sign role="ผู้อนุมัติ" name={d.approver_name} position={d.approver_position} date={null} />
      </View>

      <View style={styles.section} wrap={false}>
        <Text style={styles.bold}>{t("ใบรับเงิน")}</Text>
        <Para text={`ได้รับเงินยืม จำนวน ${amount} บาท ${amountText} ไปเป็นการถูกต้องแล้ว`} />
        <Sign role="ผู้รับเงิน" name={d.borrower_name} date={d.received_date} />
      </View>
    </Page>
  );
}

const BACK_COLS = [
  { label: ["ครั้งที่"], width: 34 },
  { label: ["วัน เดือน ปี"], width: 70 },
  { label: ["เงินสด", "หรือใบสำคัญ"], width: 72 },
  { label: ["จำนวนเงิน"], width: 66 },
  { label: ["คงค้าง"], width: 66 },
  { label: ["ลายมือชื่อ", "ผู้รับ"], width: 0 },
  { label: ["ใบรับ", "เลขที่"], width: 62 },
];
BACK_COLS[5].width = CONTENT_W - BACK_COLS.reduce((s, c) => s + c.width, 0);

function BackPage({ d }: { d: LoanContractData }) {
  let left = d.amount;
  const lines: string[][] = [];
  d.repayments.forEach((r) => {
    const parts: [string, number][] = [];
    if (Number(r.voucher_amount) > 0) parts.push(["ใบสำคัญ", Number(r.voucher_amount)]);
    if (Number(r.cash_amount) > 0) parts.push(["เงินสด", Number(r.cash_amount)]);
    parts.forEach(([kind, value], j) => {
      left = Math.round((left - value) * 100) / 100;
      lines.push([j === 0 ? String(lines.length + 1) : "", j === 0 ? shortThaiDate(r.repay_date) : "", kind, formatBaht(value), formatBaht(Math.max(left, 0)), "", j === 0 ? r.receipt_no ?? "" : ""]);
    });
  });
  const empty = Math.max(0, 12 - lines.length);
  return (
    <Page size="A4" style={styles.page}>
      <Text style={[styles.title, { fontSize: 18 }]}>{t(`รายการส่งใช้เงินยืม  สัญญาเลขที่ ${d.doc_no || "................"}`)}</Text>
      <View style={{ borderTopWidth: B, borderLeftWidth: B, fontSize: 15 }}>
        <View style={{ flexDirection: "row" }}>
          {BACK_COLS.map((c, i) => (
            <View key={i} style={[styles.cell, { width: c.width, justifyContent: "center" }]}>
              {c.label.map((l, j) => (
                <Text key={j} style={styles.head}>
                  {t(l)}
                </Text>
              ))}
            </View>
          ))}
        </View>
        {lines.map((row, i) => (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            {row.map((v, j) => (
              <Text key={j} style={[styles.cell, { width: BACK_COLS[j].width, textAlign: j >= 3 && j <= 4 ? "right" : "center" }]}>
                {t(v || " ")}
              </Text>
            ))}
          </View>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <View key={`e${i}`} style={{ flexDirection: "row" }}>
            {BACK_COLS.map((c, j) => (
              <Text key={j} style={[styles.cell, { width: c.width }]}>
                {t(" ")}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <View style={{ marginTop: 10, fontSize: 14 }}>
        <Text style={styles.bold}>{t("หมายเหตุ")}</Text>
        {[
          "(1) ยื่นต่อหัวหน้าส่วนราชการผู้ให้ยืม หรือผู้ที่ได้รับมอบหมาย",
          "(2) ใส่ชื่อส่วนราชการที่ผู้ยืมสังกัด และจัดทำสัญญาการยืมเงินสองฉบับ ส่วนราชการผู้ให้ยืมเก็บไว้หนึ่งฉบับ ผู้ยืมเก็บไว้หนึ่งฉบับ (ข้อ 61)",
          "(3) ส่งใช้ภายใน 15 วันนับแต่วันกลับมาถึง กรณีเดินทางไปราชการ หรือภายใน 30 วันนับแต่วันได้รับเงิน กรณีปฏิบัติราชการอื่น (ข้อ 65)",
          "(4) เจ้าหน้าที่ผู้รับคืนบันทึกการรับคืนในสัญญานี้ และออกใบรับใบสำคัญให้ผู้ยืมไว้เป็นหลักฐาน (ข้อ 66)",
        ].map((x, i) => (
          <View key={i}>
            {wrapByWidth(x, 14, CONTENT_W - 6, CONTENT_W - 18, false, FAMILY).map((l, j) => (
              <Text key={j} style={j > 0 ? { marginLeft: 12 } : undefined}>
                {t(l)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </Page>
  );
}

export function LoanContractDocument({ data }: { data: LoanContractData }) {
  return (
    <Document title={`สัญญาการยืมเงิน ${data.doc_no ?? ""}`}>
      <FrontPage d={data} />
      <BackPage d={data} />
    </Document>
  );
}
