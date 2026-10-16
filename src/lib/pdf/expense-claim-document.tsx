import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { claimCalcText } from "@/lib/expense-claims";
import { t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { B, CM, CONTENT_W, FS, INDENT, Para, SLACK, Sign, styles, wrap } from "./procurement-set-document";

// บันทึกขออนุมัติเบิกค่าใช้จ่ายโครงการ — รายการตาราง 2 แนบท้ายหนังสือ ว 119 (ไม่ใช่การจัดซื้อจัดจ้าง)
// เช่น ค่าอาหารว่าง ค่าอาหาร ค่าตอบแทนวิทยากร ค่าเบี้ยเลี้ยง ค่าพาหนะ — แบบอ้างอิงคู่มือ สพม.ขอนแก่น หน้า 5
// (เรื่องเดิม / ข้อเท็จจริง / ข้อเสนอและพิจารณา) TH Sarabun New 16pt, หน้าต่อขอบบน 2.5 ซม. แบบเดียวกับ ว.119

export type ExpenseClaimData = {
  doc_no: string;
  record_date: string;
  event_name: string;
  event_date: string;
  event_end_date: string | null;
  venue: string | null;
  admin_group: string | null;
  project_name: string | null;
  approval_ref: string | null;
  approval_ref_date: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  fund_source: string | null;
  payment_method: "cash" | "transfer";
  amount: number;
  items: {
    kind: string;
    name: string;
    rate: number | null;
    units: number | null;
    people: number | null;
    days: number | null;
    amount: number;
    payee: string | null;
    evidence: string | null;
    receipt_book: string | null;
    receipt_no: string | null;
    receipt_date: string | null;
  }[];
  school_name: string;
  education_area: string | null;
  director: string | null;
  finance_officer: string | null;
};

const COLS = [
  { label: "ที่", width: 26, align: "center" as const },
  { label: "รายการ", align: "left" as const },
  { label: "การคำนวณ", width: 180, align: "left" as const },
  { label: "จำนวนเงิน\n(บาท)", width: 72, align: "right" as const },
];

function ItemsTable({ d }: { d: ExpenseClaimData }) {
  const fixed = COLS.reduce((s, c) => s + (c.width ?? 0), 0);
  const widthOf = (c: (typeof COLS)[number]) => (c.width ?? CONTENT_W - fixed - 2 * B) - 8;
  const cellStyle = (c: (typeof COLS)[number]) => [styles.cell, c.width ? { width: c.width, flexShrink: 0 } : { flex: 1 }];
  const lines = (text: string, c: (typeof COLS)[number]) =>
    c.align === "left" ? text.split("\n").flatMap((x) => wrap(x, FS, widthOf(c) - SLACK / 2, widthOf(c) - SLACK / 2)) : text.split("\n");
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B }} fixed>
        {COLS.map((c, i) => (
          <View key={i} style={[...cellStyle(c), { justifyContent: "center" }]}>
            {c.label.split("\n").map((l, j) => (
              <Text key={j} style={{ textAlign: "center" }}>
                {t(l)}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {d.items.map((it, ri) => {
        const cells = [String(ri + 1), it.payee ? `${it.name}\n(จ่ายให้ ${it.payee})` : it.name, claimCalcText(it) || "-", formatBaht(it.amount)];
        return (
          <View key={ri} style={{ flexDirection: "row", borderLeftWidth: B }} wrap={false}>
            {COLS.map((c, i) => (
              <View key={i} style={cellStyle(c)}>
                {lines(cells[i], c).map((l, j) => (
                  <Text key={j} style={{ textAlign: c.align }}>
                    {t(l) || " "}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      })}
      <View style={{ flexDirection: "row", borderLeftWidth: B }} wrap={false}>
        <View style={[styles.cell, { flex: 1 }]}>
          <Text style={{ textAlign: "center" }}>{t(`รวมเป็นเงินทั้งสิ้น ${thaiBahtText(d.amount)}`)}</Text>
        </View>
        <View style={[styles.cell, { width: COLS[3].width, flexShrink: 0 }]}>
          <Text style={{ textAlign: "right" }}>{formatBaht(d.amount)}</Text>
        </View>
      </View>
    </View>
  );
}

export function ExpenseClaimDocument({ data: d }: { data: ExpenseClaimData }) {
  const school = d.school_name;
  const unit = `${school}${d.education_area ? `  ${d.education_area}` : ""}`;
  const keep = [school.replace(/^โรงเรียน/, ""), d.responsible_name ?? ""].filter(Boolean);
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const when =
    d.event_end_date && d.event_end_date !== d.event_date
      ? `ระหว่างวันที่ ${formatThaiDate(d.event_date)} ถึงวันที่ ${formatThaiDate(d.event_end_date)}`
      : `เมื่อวันที่ ${formatThaiDate(d.event_date)}`;
  const payees = [...new Set(d.items.map((i) => i.payee).filter(Boolean))].join(", ");
  const L = 595.28 / 2 - 2.5 * CM;
  const heading = (text: string) => <Text style={[styles.bold, { marginLeft: INDENT - 20, marginTop: 2 }]}>{t(text)}</Text>;
  return (
    <Document title={`ขออนุมัติเบิกค่าใช้จ่าย ${d.doc_no}`}>
      {/* หน้าต่อ ขอบบน 2.5 ซม. — หน้าแรกดึงหัวบันทึกขึ้นกลับไปที่ 1.5 ซม. */}
      <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
        <View style={{ marginTop: -CM }}>
          <MemoHeader unit={unit} docNumber={d.doc_no} isoDate={d.record_date} subject={`ขออนุมัติเบิกค่าใช้จ่าย${d.event_name}`} />
        </View>
        <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
        {heading("1. เรื่องเดิม")}
        <Para
          keep={keep}
          text={`${d.approval_ref ? `ตามบันทึกข้อความที่ ${d.approval_ref}${d.approval_ref_date ? ` ลงวันที่ ${formatThaiDate(d.approval_ref_date)}` : ""} ` : "ตามที่"}${school}ได้อนุมัติให้ดำเนินการ${d.event_name}${
            d.project_name ? ` ตาม${d.project_name.startsWith("โครงการ") ? "" : "โครงการ "}${d.project_name}` : ""
          } นั้น`}
        />
        {heading("2. ข้อเท็จจริง")}
        <Para
          keep={keep}
          text={`${d.admin_group ?? school} ได้ดำเนินการ${d.event_name} เรียบร้อยแล้ว ${when}${d.venue ? ` ณ ${d.venue}` : ""} โดยมีค่าใช้จ่ายจำนวน ${amount} บาท ${amountText} รายละเอียดดังนี้`}
        />
        <ItemsTable d={d} />
        <View wrap={false}>
          {heading("3. ข้อเสนอและพิจารณา")}
          <Para
            keep={keep}
            text={`เห็นสมควรอนุมัติเบิกจ่ายเงินเพื่อเป็นค่าใช้จ่าย${d.event_name} ตามรายการดังกล่าวข้างต้น${d.fund_source ? ` จาก${d.fund_source}` : ""} รวมเป็นเงินทั้งสิ้น ${amount} บาท ${amountText}${
              payees ? ` ให้กับ ${payees}` : ""
            } โดยวิธี${d.payment_method === "transfer" ? "โอนเงิน" : "เงินสด"} ต่อไป`}
          />
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ")}</Text>
          <Sign
            role="ผู้รับผิดชอบโครงการ"
            name={d.responsible_name}
            extra={d.responsible_position ? [`ตำแหน่ง ${d.responsible_position}`] : []}
            style={{ marginLeft: L - 50, marginTop: 10 }}
          />
          <View style={{ flexDirection: "row", marginTop: 14 }}>
            <View style={{ width: L }}>
              <Sign role="เจ้าหน้าที่การเงิน" name={d.finance_officer} style={{ marginTop: 49 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text>{t("- อนุมัติ")}</Text>
              <Text>{t("- ไม่อนุมัติ")}</Text>
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, formatThaiDate(d.record_date)]} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
