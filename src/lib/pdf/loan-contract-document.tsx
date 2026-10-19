import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import type { LoanItem, LoanRepayment, LoanType } from "@/lib/loan";
import { shortThaiDate } from "@/lib/procurement-register";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// สัญญาการยืมเงิน แบบ 8500 (แบบที่กระทรวงการคลังกำหนด ตามระเบียบฯ การเบิกเงินจากคลัง พ.ศ. 2562 ข้อ 55) — A4 แนวตั้ง 2 หน้า
// จัดรูปแบบตามตัวอย่างที่ผู้ใช้ส่งมา (แบบ 8500 ของโรงเรียน/โรงพยาบาล): กรอบล้อมทั้งแผ่น แบ่งช่องด้วยเส้น
//  ด้านหน้า: [สัญญาการยืมเงิน + ยื่นต่อ | เลขที่ / วันครบกำหนด] · ข้าพเจ้า…ตำแหน่ง…สังกัด…จังหวัด…ขอยืมเงินจาก…เพื่อเป็นค่าใช้จ่ายในการ…
//           · [รายละเอียด | จำนวนเงิน] (ตัวอักษร)…รวมเงิน (บาท) · ข้อสัญญา ( ) 30 วัน / ( ) 15 วัน + ลายมือชื่อผู้ยืม
//           · เสนอ (เจ้าหน้าที่การเงินตรวจสอบ) · คำอนุมัติ · ใบรับเงิน
//  ด้านหลัง: รายการส่งใช้เงินยืม (ครั้งที่ วันเดือนปี [รายการส่งใช้: เงินสดหรือใบสำคัญ | จำนวนเงิน] คงค้าง ลายมือชื่อผู้รับ ใบรับเลขที่)
//           · ใบรับใบสำคัญ (ตามตัวอย่างโรงเรียน) · หมายเหตุ (1)–(4) ของแบบ 8500
// ข้อ 61 จัดทำสองฉบับ (ส่วนราชการเก็บ 1 ผู้ยืมเก็บ 1) — TH Sarabun New 16pt

registerThSarabunFont();
const FAMILY = "THSarabunNew";
const FS = 16;
const CM = 28.3465;
const B = 0.8;
const PAD_L = 2 * CM;
const PAD_R = 1.5 * CM;
const CONTENT_W = 595.28 - PAD_L - PAD_R;
const INNER = 6;
const BOX_W = CONTENT_W - 2 * INNER;
const RIGHT_COL = 140;
const DOTS = "....................................";

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.12, paddingTop: 1 * CM, paddingBottom: 0.8 * CM, paddingLeft: PAD_L, paddingRight: PAD_R },
  frame: { borderWidth: B },
  box: { borderBottomWidth: B, paddingHorizontal: INNER, paddingVertical: 3 },
  bold: { fontWeight: "bold" },
  center: { textAlign: "center" },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 },
  head: { fontWeight: "bold", textAlign: "center" },
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
  loan_type: LoanType;
  due_days: number;
  received_date: string | null;
  checker_name: string | null;
  checker_position: string | null;
  approver_name: string | null;
  approver_position: string | null;
  repayments: LoanRepayment[];
};

const dateOr = (iso: string | null | undefined) => (iso ? formatThaiDate(iso) : "..............................");

function Para({ text, width = BOX_W, indent = true, keep = [] }: { text: string; width?: number; indent?: boolean; keep?: string[] }) {
  const first = indent ? width - 1.5 * CM - 4 : width - 4;
  return (
    <View>
      {wrapByWidth(text, FS, first, width - 4, false, FAMILY, keep).map((l, i) => (
        <Text key={i} style={i === 0 && indent ? { marginLeft: 1.5 * CM } : undefined}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

/** ลงชื่อ…บทบาท  วันที่…  /  (ชื่อ)  /  ตำแหน่ง — แบบ 8500 วางลายมือชื่อชิดซ้ายกลางกล่อง วันที่อยู่บรรทัดเดียวกัน */
function SignRow({ role, name, position, date, label = "ลงชื่อ" }: { role: string; name: string | null; position?: string | null; date?: string | null; label?: string }) {
  return (
    <View style={{ marginTop: 6, marginLeft: 0.8 * CM }} wrap={false}>
      <View style={{ flexDirection: "row" }}>
        <Text style={{ width: 270 }}>{t(`${label}..............................................${role}`)}</Text>
        {date !== undefined && <Text>{t(`วันที่ ${dateOr(date)}`)}</Text>}
      </View>
      <Text style={{ width: 270, textAlign: "center" }}>{t(name ? `(${name})` : `(${DOTS})`)}</Text>
      {position !== undefined && <Text style={{ width: 270, textAlign: "center" }}>{t(`ตำแหน่ง ${position || DOTS}`)}</Text>}
    </View>
  );
}

function FrontPage({ d }: { d: LoanContractData }) {
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const rows = d.items.length > 0 ? d.items : [{ detail: d.purpose, amount: d.amount }];
  const minRows = Math.max(0, 3 - rows.length);
  const detailW = CONTENT_W - RIGHT_COL;
  const mark = (on: boolean) => (on ? "( / )" : "(   )");
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ textAlign: "right", fontSize: 14 }}>{t("แบบ 8500")}</Text>
      <View style={styles.frame}>
        {/* หัว: ชื่อแบบ + ยื่นต่อ | เลขที่ + วันครบกำหนด */}
        <View style={{ flexDirection: "row", borderBottomWidth: B }}>
          <View style={{ width: CONTENT_W - RIGHT_COL, borderRightWidth: B, paddingHorizontal: INNER, paddingVertical: 3 }}>
            <Text style={[styles.bold, styles.center, { fontSize: 20 }]}>{t("สัญญาการยืมเงิน")}</Text>
            <Text style={{ marginTop: 6 }}>{t(`ยื่นต่อ  ${d.submit_to}`)}</Text>
          </View>
          <View style={{ width: RIGHT_COL, paddingHorizontal: INNER, paddingVertical: 3 }}>
            <Text>{t(`เลขที่  ${d.doc_no || "................"}`)}</Text>
            <Text style={styles.bold}>{t("วันครบกำหนด")}</Text>
            <Text>{t(dateOr(d.due_date))}</Text>
          </View>
        </View>

        {/* ผู้ยืม */}
        <View style={styles.box}>
          <Para
            indent={false}
            text={`ข้าพเจ้า ${d.borrower_name} ตำแหน่ง ${d.borrower_position || DOTS} ${d.school_name} สังกัด ${d.affiliation} จังหวัด${d.province} มีความประสงค์ขอยืมเงินจาก ${d.fund_source || DOTS} ${d.school_name} เพื่อเป็นค่าใช้จ่ายในการ${d.purpose.replace(/^เพื่อ(เป็นค่าใช้จ่ายในการ)?\s*/, "")} ดังรายละเอียดต่อไปนี้`}
            keep={[d.borrower_name, d.school_name, d.affiliation]}
          />
        </View>

        {/* รายละเอียด | จำนวนเงิน */}
        {rows.map((it, i) => (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            <View style={{ width: detailW, borderRightWidth: B, paddingHorizontal: INNER, paddingTop: i === 0 ? 3 : 0 }}>
              {wrapByWidth(`${rows.length > 1 ? `${i + 1}. ` : ""}${it.detail}`, FS, detailW - 2 * INNER - 4, detailW - 2 * INNER - 4, false, FAMILY).map((l, j) => (
                <Text key={j}>{t(l)}</Text>
              ))}
            </View>
            <Text style={{ width: RIGHT_COL, paddingHorizontal: INNER, paddingTop: i === 0 ? 3 : 0, textAlign: "right" }}>{t(formatBaht(it.amount))}</Text>
          </View>
        ))}
        {Array.from({ length: minRows }, (_, i) => (
          <View key={`e${i}`} style={{ flexDirection: "row" }}>
            <Text style={{ width: detailW, borderRightWidth: B }}>{t(" ")}</Text>
            <Text style={{ width: RIGHT_COL }}>{t(" ")}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", borderBottomWidth: B }}>
          <View style={{ width: detailW, borderRightWidth: B, paddingHorizontal: INNER, paddingBottom: 2, flexDirection: "row", justifyContent: "space-between" }}>
            <Text>{t(`(ตัวอักษร) ${amountText}`)}</Text>
            <Text>{t("รวมเงิน (บาท)")}</Text>
          </View>
          <Text style={[styles.bold, { width: RIGHT_COL, paddingHorizontal: INNER, textAlign: "right" }]}>{t(amount)}</Text>
        </View>

        {/* ข้อสัญญา + ผู้ยืม */}
        <View style={styles.box}>
          <Para
            text={`ข้าพเจ้าสัญญาว่าจะปฏิบัติตามระเบียบของทางราชการทุกประการ และจะนำใบสำคัญคู่จ่ายที่ถูกต้อง พร้อมทั้งเงินเหลือจ่าย (ถ้ามี) ส่งใช้ภายในกำหนดไว้ในระเบียบการเบิกจ่ายเงินจากคลัง คือ`}
          />
          <Text style={{ marginLeft: 1.5 * CM }}>
            {t(`${mark(d.loan_type === "other")} ภายใน ${d.loan_type === "other" ? d.due_days : 30} วัน นับแต่วันที่ได้รับเงินยืมนี้`)}
          </Text>
          <Text style={{ marginLeft: 1.5 * CM }}>
            {t(`${mark(d.loan_type === "travel")} ภายใน ${d.loan_type === "travel" ? d.due_days : 15} วัน นับแต่วันที่กลับมาปฏิบัติราชการ`)}
          </Text>
          <Para
            indent={false}
            text="ถ้าข้าพเจ้าไม่ส่งตามกำหนด ข้าพเจ้ายินยอมให้หักเงินเดือน ค่าจ้าง เบี้ยหวัด บำเหน็จ บำนาญ หรือเงินอื่นใดที่ข้าพเจ้าพึงได้รับจากทางราชการ ชดใช้จำนวนเงินที่ยืมไปจนครบถ้วนได้ทันที"
          />
          <SignRow label="ลายมือชื่อ" role="ผู้ยืม" name={d.borrower_name} date={d.request_date} />
        </View>

        {/* เสนอ */}
        <View style={styles.box} wrap={false}>
          <Text>{t(`เสนอ  ${d.submit_to}`)}</Text>
          <Para text={`ได้ตรวจสอบแล้ว เห็นสมควรอนุมัติให้ยืมตามใบยืมฉบับนี้ได้ จำนวน ${amount} บาท (${amountText.replace(/^\(|\)$/g, "")})`} />
          <SignRow role="" name={d.checker_name} position={d.checker_position} date={null} />
        </View>

        {/* คำอนุมัติ */}
        <View style={styles.box} wrap={false}>
          <Text style={[styles.bold, styles.center]}>{t("คำอนุมัติ")}</Text>
          <Para text={`อนุมัติให้ยืมตามเงื่อนไขข้างต้นได้ เป็นเงิน ${amount} บาท (${amountText.replace(/^\(|\)$/g, "")})`} />
          <SignRow role="ผู้อนุมัติ" name={d.approver_name} position={d.approver_position} date={null} />
        </View>

        {/* ใบรับเงิน */}
        <View style={[styles.box, { borderBottomWidth: 0 }]} wrap={false}>
          <Text style={[styles.bold, styles.center]}>{t("ใบรับเงิน")}</Text>
          <Para text={`ได้รับเงินยืม จำนวน ${amount} บาท (${amountText.replace(/^\(|\)$/g, "")}) ไปเป็นการถูกต้องแล้ว`} />
          <SignRow role="ผู้รับเงิน" name={d.borrower_name} position={d.borrower_position} date={d.received_date} />
        </View>
      </View>
    </Page>
  );
}

const BACK_COLS = [34, 72, 96, 74, 74, 0, 80];
BACK_COLS[5] = CONTENT_W - BACK_COLS.reduce((s, w) => s + w, 0);

function BackPage({ d }: { d: LoanContractData }) {
  const paidThrough = (i: number) => d.repayments.slice(0, i + 1).reduce((s, r) => s + Number(r.voucher_amount) + Number(r.cash_amount), 0);
  const rows = d.repayments.map((r, i) => {
    const voucher = Number(r.voucher_amount);
    const cash = Number(r.cash_amount);
    const left = Math.round((d.amount - paidThrough(i)) * 100) / 100;
    const kinds = [voucher > 0 ? `ใบสำคัญ${r.voucher_count ? ` ${r.voucher_count} ฉบับ` : ""}` : "", cash > 0 ? "เงินสด" : ""].filter(Boolean);
    const amounts = [voucher > 0 ? formatBaht(voucher) : "", cash > 0 ? formatBaht(cash) : ""].filter(Boolean);
    return { no: String(i + 1), date: shortThaiDate(r.repay_date), kinds, amounts, left: formatBaht(Math.max(left, 0)), receipt: r.receipt_no ?? "" };
  });
  const empty = Math.max(0, 8 - rows.length);
  // ใบรับใบสำคัญ — ใช้รายการส่งใช้ที่มีใบสำคัญครั้งล่าสุด (ยังไม่ส่งใช้ = เว้นว่างให้เขียน)
  const lastVoucher = [...d.repayments].reverse().find((r) => Number(r.voucher_amount) > 0);
  const vAmount = lastVoucher ? Number(lastVoucher.voucher_amount) : null;
  const cellText = (v: string, w: number, align: "left" | "center" | "right" = "center") => (
    <Text style={[styles.cell, { width: w, textAlign: align }]}>{t(v || " ")}</Text>
  );
  return (
    <Page size="A4" style={styles.page}>
      <Text style={[styles.bold, styles.center, { fontSize: 18, marginBottom: 4 }]}>{t("รายการส่งใช้เงินยืม")}</Text>
      <View style={{ borderTopWidth: B, borderLeftWidth: B, fontSize: 15 }}>
        <View style={{ flexDirection: "row" }}>
          <Text style={[styles.cell, styles.head, { width: BACK_COLS[0], paddingTop: 10 }]}>{t("ครั้งที่")}</Text>
          <Text style={[styles.cell, styles.head, { width: BACK_COLS[1], paddingTop: 10 }]}>{t("วัน เดือน ปี")}</Text>
          <View style={{ width: BACK_COLS[2] + BACK_COLS[3] }}>
            <Text style={[styles.cell, styles.head]}>{t("รายการส่งใช้")}</Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={[styles.cell, styles.head, { width: BACK_COLS[2] }]}>{t("เงินสดหรือใบสำคัญ")}</Text>
              <Text style={[styles.cell, styles.head, { width: BACK_COLS[3] }]}>{t("จำนวนเงิน")}</Text>
            </View>
          </View>
          <Text style={[styles.cell, styles.head, { width: BACK_COLS[4], paddingTop: 10 }]}>{t("คงค้าง")}</Text>
          <Text style={[styles.cell, styles.head, { width: BACK_COLS[5], paddingTop: 10 }]}>{t("ลายมือชื่อผู้รับ")}</Text>
          <Text style={[styles.cell, styles.head, { width: BACK_COLS[6], paddingTop: 10 }]}>{t("ใบรับเลขที่")}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            {cellText(r.no, BACK_COLS[0])}
            {cellText(r.date, BACK_COLS[1])}
            <View style={[styles.cell, { width: BACK_COLS[2] }]}>
              {r.kinds.map((k, j) => (
                <Text key={j}>{t(`${r.kinds.length > 1 ? `${j + 1}. ` : ""}${k}`)}</Text>
              ))}
            </View>
            <View style={[styles.cell, { width: BACK_COLS[3] }]}>
              {r.amounts.map((a, j) => (
                <Text key={j} style={{ textAlign: "right" }}>
                  {t(a)}
                </Text>
              ))}
            </View>
            {cellText(r.left, BACK_COLS[4], "right")}
            {cellText("", BACK_COLS[5])}
            {cellText(r.receipt, BACK_COLS[6])}
          </View>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <View key={`e${i}`} style={{ flexDirection: "row" }}>
            {BACK_COLS.map((w, j) => (
              <Text key={j} style={[styles.cell, { width: w }]}>
                {t(" ")}
              </Text>
            ))}
          </View>
        ))}
      </View>

      {/* ใบรับใบสำคัญ */}
      <View style={[styles.frame, { marginTop: 10, paddingHorizontal: INNER, paddingVertical: 4 }]} wrap={false}>
        <Text style={[styles.bold, styles.center]}>{t("ใบรับใบสำคัญ")}</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text>{t(`เลขที่ ${lastVoucher?.receipt_no || "บค........./.........."}`)}</Text>
          <Text>{t(d.school_name)}</Text>
          <Text>{t(`วันที่ ${dateOr(lastVoucher?.repay_date)}`)}</Text>
        </View>
        <Para
          width={BOX_W}
          text={`ได้รับใบสำคัญจาก ${d.borrower_name} ตำแหน่ง ${d.borrower_position || DOTS} ${d.school_name} สังกัด ${d.affiliation} เพื่อส่งใช้เงินยืมตามสัญญาการยืมเงินเลขที่ ${d.doc_no || "......../........"} ลงวันที่ ${formatThaiDate(d.request_date)} รวม ${lastVoucher?.voucher_count ?? "........"} ฉบับ เป็นเงิน ${vAmount != null ? formatBaht(vAmount) : "................"} บาท ${vAmount != null ? thaiBahtText(vAmount) : "(..................................................)"} ไว้เป็นการถูกต้องแล้ว`}
          keep={[d.borrower_name, d.school_name, d.affiliation]}
        />
        <View style={{ marginLeft: CONTENT_W / 2 - 40, alignItems: "center", marginTop: 6 }}>
          <Text>{t("ลงชื่อ..............................................ผู้รับใบสำคัญ")}</Text>
          <Text>{t(d.checker_name ? `(${d.checker_name})` : `(${DOTS})`)}</Text>
          <Text>{t(`ตำแหน่ง ${d.checker_position || "เจ้าหน้าที่การเงิน"}`)}</Text>
        </View>
      </View>

      <View style={{ marginTop: 8, fontSize: 14 }}>
        <Text style={styles.bold}>{t("หมายเหตุ")}</Text>
        {[
          "(1) ยื่นต่อ ผู้อำนวยการกองคลัง หัวหน้ากองคลัง หัวหน้าแผนกคลัง หรือตำแหน่งอื่นใดที่ปฏิบัติงานเช่นเดียวกันแล้วแต่กรณี",
          "(2) ให้ระบุชื่อส่วนราชการที่จ่ายเงินยืม",
          "(3) ระบุวัตถุประสงค์ที่จะนำเงินยืมไปใช้จ่าย",
          "(4) เสนอต่อผู้มีอำนาจอนุมัติ",
        ].map((x, i) => (
          <View key={i}>
            {wrapByWidth(x, 14, CONTENT_W - 6, CONTENT_W - 24, false, FAMILY).map((l, j) => (
              <Text key={j} style={{ marginLeft: j > 0 ? 24 : 6 }}>
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
