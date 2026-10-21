import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatBaht, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { CM, INDENT, Para, Sign, styles } from "./procurement-set-document";
import { Tick } from "./w119-document";

// บันทึกข้อความขออนุมัติยืมเงินระหว่างประเภทเงิน (เช่น ค่าอุปกรณ์การเรียนไม่พอ ยืมจากกิจกรรมพัฒนาคุณภาพผู้เรียน)
// แบบอ้างอิงจากไฟล์ที่ผู้ใช้ให้มา — ผู้ใช้ขอตัดข้อความที่ไม่จำเป็นและการอ้างถึงหนังสือ สพป. ออก (ต.ค. 2569)
// TH Sarabun New 16pt ตามมาตรฐานเอกสาร PDF ของระบบ

export type FundLoanMemoData = {
  school_name: string;
  education_area: string | null;
  memo_no: string | null;
  memo_date: string | null;
  loan_date: string;
  lender: string;
  lines: { borrower: string; amount: number }[];
  semester: string | null;
  academic_year: string | null;
  reason: string | null;
  finance_officer: { name: string; position: string };
  director: { name: string; position: string };
};

export function FundLoanMemoDocument({ data: d }: { data: FundLoanMemoData }) {
  const sum = d.lines.reduce((s, l) => s + l.amount, 0);
  const borrowers = d.lines.map((l) => l.borrower).join(" และ");
  const term = d.semester || d.academic_year ? ` ภาคเรียนที่ ${d.semester || "...."} ปีการศึกษา ${d.academic_year || "........"}` : "";
  const reason = d.reason?.trim() || "ได้รับจัดสรรเงินอุดหนุนยังไม่ครบถ้วน ทำให้เงินที่มีอยู่ไม่เพียงพอต่อการจ่ายให้แก่นักเรียนตามสิทธิ";
  const keep = [d.lender, ...d.lines.map((l) => l.borrower), d.school_name.replace(/^โรงเรียน/, "")];
  const amount = `${formatBaht(sum)} บาท ${thaiBahtText(sum)}`;
  const L = 595.28 / 2 - 2.5 * CM;
  return (
    <Document title="บันทึกขออนุมัติยืมเงิน">
      <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
        <View style={{ marginTop: -CM }}>
          <MemoHeader unit={`${d.school_name}${d.education_area ? `  ${d.education_area}` : ""}`} docNumber={d.memo_no} isoDate={d.memo_date ?? d.loan_date} subject={`ขออนุมัติยืมเงิน${d.lender} เพื่อจ่าย${borrowers}${term}`} />
        </View>
        <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${d.school_name}`)}</Text>
        <Para keep={keep} text={`ด้วย${d.school_name} มีความจำเป็นต้องดำเนินการจ่าย${borrowers}${term} แต่${reason}`} />
        <Para keep={keep} text={`ดังนั้น เพื่อให้การดำเนินการดังกล่าวเป็นไปด้วยความเรียบร้อย จึงขออนุมัติยืมเงินจาก${d.lender} จำนวนเงิน ${amount} โดยมีรายละเอียดดังนี้`} />
        <View style={styles.gap}>
          {d.lines.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", marginLeft: INDENT }}>
              <Text style={{ flex: 1 }}>{t(`${i + 1}. ${l.borrower}`)}</Text>
              <Text style={{ width: 150, textAlign: "right" }}>{t(`จำนวนเงิน ${formatBaht(l.amount)} บาท`)}</Text>
            </View>
          ))}
        </View>
        <Para text={`ทั้งนี้ จะดำเนินการส่งใช้เงินยืมคืนรายการเดิมเมื่อได้รับจัดสรรงบประมาณเพิ่มเติม ทั้งนี้ ให้เป็นไปตามแนวทางและหนังสือสั่งการที่เกี่ยวข้อง`} />
        <View wrap={false}>
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ")}</Text>
          <Sign role="" name={d.finance_officer.name || null} extra={[d.finance_officer.position]} style={{ marginLeft: L - 30, marginTop: 14 }} />
          <View style={{ marginTop: 14, paddingVertical: 6 }}>
            <Text style={styles.bold}>{t("ความเห็นผู้อำนวยการ")}</Text>
            <View style={{ flexDirection: "row", gap: 24 }}>
              <Tick text="อนุมัติ" />
              <Tick text="ไม่อนุมัติ เนื่องจาก......................................................" />
            </View>
            <Sign role="" name={d.director.name || null} extra={[d.director.position]} style={{ marginLeft: L - 40, marginTop: 10 }} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
