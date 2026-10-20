import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { shortThaiDate } from "@/lib/procurement-register";
import { addBal, docLabel, groupByCategory, thaiMonthLabel, total, zero, type Balance, type FinTxn, type MoneyType, type registerForMonth } from "@/lib/finance-ledger";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// เอกสารบัญชีรับ-จ่ายเงิน (แทนชีตในไฟล์ Excel เดิม) — TH Sarabun New 16pt (ตาราง 15pt)
// 1) รายงานเงินคงเหลือประจำวัน (A4 แนวตั้ง) — ช่องลงนามตามชีต "คงเหลือประจำวัน"
// 2) ทะเบียนคุมเงินแยกประเภท รายเดือน (A4 แนวนอน) — ตามชีตรายเดือน ต.ค.–ก.ย.
// 3) ทะเบียนคุมใบสำคัญคู่จ่าย บค./บจ. (A4 แนวนอน)

registerThSarabunFont();
const FAMILY = "THSarabunNew";
const FS = 15;
const PAD = 28;
const B = 0.8;

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 16, lineHeight: 1.15, paddingHorizontal: PAD, paddingVertical: 24 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center" },
  center: { textAlign: "center" },
  bold: { fontWeight: "bold" },
  table: { borderTopWidth: B, borderLeftWidth: B, fontSize: FS, marginTop: 6 },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 },
  head: { fontWeight: "bold", textAlign: "center", backgroundColor: "#f1f5f9" },
});

const lines = (text: string, width: number, bold = false) => wrapByWidth(text, FS, width - 8, width - 8, bold, FAMILY);
const money = (n: number) => formatBaht(n);
const moneyOrBlank = (n: number) => (n ? formatBaht(n) : "");

function Cell({ w, text, align = "left", bold = false, wrap = false }: { w: number; text: string; align?: "left" | "right" | "center"; bold?: boolean; wrap?: boolean }) {
  if (!wrap)
    return (
      <Text style={[styles.cell, { width: w, textAlign: align }, bold ? styles.bold : {}]}>
        {t(text || " ")}
      </Text>
    );
  return (
    <View style={[styles.cell, { width: w }]}>
      {lines(text || " ", w, bold).map((l, i) => (
        <Text key={i} style={[{ textAlign: align }, bold ? styles.bold : {}]}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

export type Signer = { name: string; position: string };
export type FinSigners = { officer: Signer; committee: Signer[]; head: Signer };

function SignLine({ role, signer, width = 240 }: { role: string; signer: Signer; width?: number }) {
  return (
    <View style={{ width, alignItems: "center", marginTop: 14 }} wrap={false}>
      <Text>{t(`ลงชื่อ....................................${role}`)}</Text>
      <Text>{t(`(${signer.name || "...................................."})`)}</Text>
      <Text>{t(signer.position || " ")}</Text>
    </View>
  );
}

// ---------- 1) รายงานเงินคงเหลือประจำวัน ----------

export function DailyBalanceDocument({ schoolName, date, types, balances, signers }: { schoolName: string; date: string; types: MoneyType[]; balances: Map<string, Balance>; signers: FinSigners }) {
  const W = { name: 215, cash: 75, bank: 80, gov: 85, sum: 84 };
  const groups = groupByCategory(types.filter((x) => x.is_active || total(balances.get(x.id) ?? zero()) !== 0));
  const grand = types.reduce((s, x) => addBal(s, balances.get(x.id) ?? zero()), zero());
  const row = (key: string, label: string, b: Balance, opts: { bold?: boolean; indent?: boolean } = {}) => (
    <View key={key} style={{ flexDirection: "row" }} wrap={false}>
      <View style={[styles.cell, { width: W.name, paddingLeft: opts.indent ? 16 : 3 }]}>
        {lines(label, W.name - (opts.indent ? 13 : 0), opts.bold).map((l, i) => (
          <Text key={i} style={opts.bold ? styles.bold : {}}>
            {t(l)}
          </Text>
        ))}
      </View>
      <Cell w={W.cash} text={money(b.cash)} align="right" bold={opts.bold} />
      <Cell w={W.bank} text={money(b.bank)} align="right" bold={opts.bold} />
      <Cell w={W.gov} text={money(b.gov)} align="right" bold={opts.bold} />
      <Cell w={W.sum} text={money(total(b))} align="right" bold />
    </View>
  );
  return (
    <Document title={`รายงานเงินคงเหลือประจำวัน ${date}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t("รายงานเงินคงเหลือประจำวัน")}</Text>
        <Text style={styles.center}>{t(schoolName)}</Text>
        <Text style={styles.center}>{t(`ประจำวันที่ ${formatThaiDate(date)}`)}</Text>
        <View style={styles.table}>
          <View style={{ flexDirection: "row" }}>
            <Cell w={W.name} text="ประเภท" align="center" bold />
            <Cell w={W.cash} text="เงินสด" align="center" bold />
            <Cell w={W.bank} text="เงินฝากธนาคาร" align="center" bold />
            <Cell w={W.gov} text="เงินฝากส่วนราชการผู้เบิก" align="center" bold wrap />
            <Cell w={W.sum} text="รวม" align="center" bold />
          </View>
          {groups.flatMap((g, gi) => {
            if (g.types.length === 1) return [row(g.types[0].id, `${gi + 1}. ${g.types[0].name}`, balances.get(g.types[0].id) ?? zero())];
            const sub = g.types.reduce((s, x) => addBal(s, balances.get(x.id) ?? zero()), zero());
            return [row(`${g.category}-h`, `${gi + 1}. ${g.category}`, sub, { bold: true }), ...g.types.map((x) => row(x.id, x.name, balances.get(x.id) ?? zero(), { indent: true }))];
          })}
          {row("grand", "รวมทั้งสิ้น", grand, { bold: true })}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <SignLine role="ผู้จัดทำรายงาน" signer={signers.officer} />
        </View>
        <View wrap={false} style={{ marginTop: 8 }}>
          <Text style={{ textIndent: 36 }}>{t("คณะกรรมการเก็บรักษาเงิน ได้ตรวจสอบนับเงินสดคงเหลือประจำวันถูกต้องตามรายการข้างต้นแล้ว")}</Text>
          <Text>{t("และได้นำเงินสดเก็บรักษาไว้ในตู้นิรภัยเป็นที่เรียบร้อยแล้ว")}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[0, 1, 2].map((i) => (
              <SignLine key={i} role="กรรมการ" signer={signers.committee[i] ?? { name: "", position: "" }} width={175} />
            ))}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <SignLine role="หัวหน้าหน่วยงานย่อย" signer={signers.head} />
        </View>
        <View wrap={false} style={{ marginTop: 10, borderTopWidth: 0.5, borderTopStyle: "dashed", paddingTop: 6 }}>
          <Text style={{ textIndent: 36 }}>{t(`(กรณีนำเงินสดไปเก็บรักษา) ข้าพเจ้าผู้รับมอบหมาย ได้รับเงินสดตามรายการข้างต้นแล้ว เมื่อวันที่ ${formatThaiDate(date)}`)}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <SignLine role="ผู้รับเงิน" signer={{ name: "", position: "" }} />
            <SignLine role="หัวหน้าหน่วยงานย่อย" signer={signers.head} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ---------- 2) ทะเบียนคุมเงินแยกประเภท รายเดือน ----------

export type RegisterPage = { type: MoneyType; month: string; reg: ReturnType<typeof registerForMonth> };

const RW = { date: 58, doc: 88, desc: 210, rcv: 70, pay: 70, cash: 75, bank: 80, gov: 80, note: 55 };

function RegisterSheet({ page, schoolName, fy }: { page: RegisterPage; schoolName: string; fy: number }) {
  const { reg } = page;
  const balCells = (b: Balance, bold = false) => (
    <>
      <Cell w={RW.cash} text={money(b.cash)} align="right" bold={bold} />
      <Cell w={RW.bank} text={money(b.bank)} align="right" bold={bold} />
      <Cell w={RW.gov} text={money(b.gov)} align="right" bold={bold} />
    </>
  );
  const sumRow = (label: string, rcv: string, pay: string, b: Balance | null) => (
    <View style={{ flexDirection: "row" }} wrap={false}>
      <Cell w={RW.date + RW.doc + RW.desc} text={label} align="center" bold />
      <Cell w={RW.rcv} text={rcv} align="right" bold />
      <Cell w={RW.pay} text={pay} align="right" bold />
      {b ? balCells(b, true) : <Cell w={RW.cash + RW.bank + RW.gov} text="" />}
      <Cell w={RW.note} text="" />
    </View>
  );
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>{t(`ทะเบียนคุม${page.type.name.startsWith("เงิน") ? "" : "เงิน"}${page.type.name}`)}</Text>
      <Text style={styles.center}>{t(`${schoolName}   ปีงบประมาณ ${fy}   ประจำเดือน ${thaiMonthLabel(page.month)}`)}</Text>
      <View style={styles.table}>
        <View style={{ flexDirection: "row" }} fixed>
          <View style={[styles.cell, styles.head, { width: RW.date, justifyContent: "center" }]}>
            <Text>{t("วัน เดือน ปี")}</Text>
          </View>
          <View style={[styles.cell, styles.head, { width: RW.doc, justifyContent: "center" }]}>
            <Text>{t("ที่เอกสาร")}</Text>
          </View>
          <View style={[styles.cell, styles.head, { width: RW.desc, justifyContent: "center" }]}>
            <Text>{t("รายการ")}</Text>
          </View>
          <View style={[styles.cell, styles.head, { width: RW.rcv, justifyContent: "center" }]}>
            <Text>{t("รับ")}</Text>
          </View>
          <View style={[styles.cell, styles.head, { width: RW.pay, justifyContent: "center" }]}>
            <Text>{t("จ่าย")}</Text>
          </View>
          <View style={{ width: RW.cash + RW.bank + RW.gov }}>
            <Text style={[styles.cell, styles.head]}>{t("คงเหลือ")}</Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={[styles.cell, styles.head, { width: RW.cash }]}>{t("เงินสด")}</Text>
              <Text style={[styles.cell, styles.head, { width: RW.bank }]}>{t("เงินฝากธนาคาร")}</Text>
              <Text style={[styles.cell, styles.head, { width: RW.gov }]}>{t("ฝากส่วนราชการ")}</Text>
            </View>
          </View>
          <View style={[styles.cell, styles.head, { width: RW.note, justifyContent: "center" }]}>
            <Text>{t("หมายเหตุ")}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row" }} wrap={false}>
          <Cell w={RW.date} text="" />
          <Cell w={RW.doc} text="" />
          <Cell w={RW.desc} text="ยอดยกมา" bold />
          <Cell w={RW.rcv} text="" />
          <Cell w={RW.pay} text="" />
          {balCells(reg.broughtForward)}
          <Cell w={RW.note} text="" />
        </View>
        {reg.rows.map(({ txn, receive, pay, balance }) => (
          <View key={txn.id} style={{ flexDirection: "row" }} wrap={false}>
            <Cell w={RW.date} text={shortThaiDate(txn.txn_date)} align="center" />
            <Cell w={RW.doc} text={docLabel(txn)} align="center" wrap />
            <Cell w={RW.desc} text={txn.kind === "transfer" ? `${txn.description} (โอน)` : txn.description} wrap />
            <Cell w={RW.rcv} text={moneyOrBlank(receive)} align="right" />
            <Cell w={RW.pay} text={moneyOrBlank(pay)} align="right" />
            {balCells(balance)}
            <Cell w={RW.note} text={txn.note ?? ""} wrap />
          </View>
        ))}
        {reg.rows.length === 0 && (
          <View style={{ flexDirection: "row" }}>
            <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ไม่มีรายการรับ-จ่ายในเดือนนี้")}</Text>
          </View>
        )}
        {sumRow("รวมตั้งแต่ต้นเดือน", money(reg.month.receive), money(reg.month.pay), null)}
        {sumRow("รวมตั้งแต่ต้นปี", money(reg.ytd.receive), money(reg.ytd.pay), null)}
        {sumRow("ยอดยกไป", "", "", reg.carriedForward)}
      </View>
    </Page>
  );
}

export function MoneyRegisterDocument({ pages, schoolName, fy }: { pages: RegisterPage[]; schoolName: string; fy: number }) {
  return (
    <Document title={`ทะเบียนคุมเงิน ปีงบประมาณ ${fy}`}>
      {pages.map((p) => (
        <RegisterSheet key={`${p.type.id}-${p.month}`} page={p} schoolName={schoolName} fy={fy} />
      ))}
    </Document>
  );
}

// ---------- 3) ทะเบียนคุมใบสำคัญคู่จ่าย ----------

export function VoucherRegisterDocument({ txns, schoolName, fy, typeName, projectName }: { txns: FinTxn[]; schoolName: string; fy: number; typeName: Map<string, string>; projectName: Map<string, string> }) {
  const W = { no: 30, date: 58, bk: 60, bj: 60, desc: 270, amt: 75, proj: 140, type: 93 };
  const sum = txns.reduce((s, x) => s + Number(x.amount), 0);
  return (
    <Document title={`ทะเบียนคุมใบสำคัญคู่จ่าย ปีงบประมาณ ${fy}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{t("ทะเบียนคุมใบสำคัญคู่จ่าย")}</Text>
        <Text style={styles.center}>{t(`${schoolName}   ปีงบประมาณ ${fy}`)}</Text>
        <View style={styles.table}>
          <View style={{ flexDirection: "row" }} fixed>
            <Cell w={W.no} text="ที่" align="center" bold />
            <Cell w={W.date} text="วัน เดือน ปี" align="center" bold />
            <Cell w={W.bk} text="บค." align="center" bold />
            <Cell w={W.bj} text="บจ." align="center" bold />
            <Cell w={W.desc} text="รายการ" align="center" bold />
            <Cell w={W.amt} text="จำนวนเงิน" align="center" bold />
            <Cell w={W.proj} text="โครงการ" align="center" bold />
            <Cell w={W.type} text="ประเภทเงิน" align="center" bold />
          </View>
          {txns.map((x, i) => (
            <View key={x.id} style={{ flexDirection: "row" }} wrap={false}>
              <Cell w={W.no} text={String(i + 1)} align="center" />
              <Cell w={W.date} text={shortThaiDate(x.txn_date)} align="center" />
              <Cell w={W.bk} text={x.doc_kind === "บค" ? `${x.doc_seq}/${x.fiscal_year}` : ""} align="center" />
              <Cell w={W.bj} text={x.doc_kind === "บจ" ? `${x.doc_seq}/${x.fiscal_year}` : ""} align="center" />
              <Cell w={W.desc} text={x.payee ? `${x.description} — ${x.payee}` : x.description} wrap />
              <Cell w={W.amt} text={money(Number(x.amount))} align="right" />
              <Cell w={W.proj} text={x.project_id ? (projectName.get(x.project_id) ?? "") : ""} wrap />
              <Cell w={W.type} text={typeName.get(x.money_type_id) ?? ""} wrap />
            </View>
          ))}
          {txns.length === 0 && (
            <View style={{ flexDirection: "row" }}>
              <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ยังไม่มีใบสำคัญคู่จ่าย")}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row" }} wrap={false}>
            <Cell w={W.no + W.date + W.bk + W.bj + W.desc} text="รวม" align="center" bold />
            <Cell w={W.amt} text={money(sum)} align="right" bold />
            <Cell w={W.proj + W.type} text="" />
          </View>
        </View>
      </Page>
    </Document>
  );
}
