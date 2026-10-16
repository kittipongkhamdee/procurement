import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";
import { addWorkingDays, evidenceRule, RECEIPT_ESSENTIALS } from "@/lib/w119";
import { t } from "./thai-pdf";
import { MemoHeader } from "./approval-document";
import { B, CM, CONTENT_W, FS, INDENT, Para, SLACK, Sign, styles, wrap } from "./procurement-set-document";

// ว.119 — บันทึกรายงานขอความเห็นชอบการจัดซื้อจัดจ้างและขออนุมัติเบิกจ่ายเงิน (ค่าใช้จ่ายในการบริหารงาน
// การฝึกอบรม การจัดงาน และการประชุม วงเงินครั้งหนึ่งไม่เกิน 10,000 บาท) ตามหนังสือ กค (กวจ) 0405.2/ว 119 ลว. 7 มี.ค. 2561
// ผู้ได้รับมอบหมายจัดซื้อจัดจ้างไปก่อน แล้วรายงานภายใน 5 วันทำการ — เมื่อเห็นชอบแล้วให้ถือเป็นหลักฐานการตรวจรับโดยอนุโลม
// แบบอ้างอิงจากตัวอย่างที่ผู้ใช้ให้มา (KruNotAlone, ร.ร.เตรียมอุดมศึกษาพัฒนาการ นนทบุรี, สพม.ขอนแก่น) — TH Sarabun New 16pt


const W119_REF =
  "หนังสือคณะกรรมการวินิจฉัยปัญหาการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ ด่วนที่สุด ที่ กค (กวจ) 0405.2/ว 119 ลงวันที่ 7 มีนาคม 2561 เรื่อง แนวทางการปฏิบัติในการดำเนินการจัดหาพัสดุที่เกี่ยวกับค่าใช้จ่ายในการบริหารงาน ค่าใช้จ่ายในการฝึกอบรม การจัดงาน และการประชุมของหน่วยงานของรัฐ";

export type W119Data = {
  doc_no: string;
  record_date: string;
  purchase_date: string;
  admin_group: string | null;
  project_name: string | null;
  activity_name: string | null;
  purpose: string | null;
  expense_category: string;
  table_ref: string | null;
  responsible_name: string | null;
  responsible_position: string | null;
  payment_method: "cash" | "transfer";
  fund_source: string | null;
  amount: number;
  items: { name: string; vendor: string | null; evidence: string | null; receipt_book: string | null; receipt_no: string | null; receipt_date: string | null; amount: number }[];
  school_name: string;
  education_area: string | null;
  procurement_officer: string | null;
  procurement_head: string | null;
  director: string | null;
};

const shortDate = (iso: string | null) => {
  if (!iso) return "";
  const [day, month, year] = formatThaiDate(iso).split(" ");
  return `${day} ${month} ${year}`;
};

function evidenceText(i: W119Data["items"][number]) {
  return [
    i.evidence || "ใบเสร็จรับเงิน",
    i.receipt_book ? `เล่มที่ ${i.receipt_book}` : "",
    i.receipt_no ? `เลขที่ ${i.receipt_no}` : "",
    i.receipt_date ? `ลงวันที่ ${shortDate(i.receipt_date)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const COLS = [
  { label: "ที่", width: 26, align: "center" as const },
  { label: "รายการ", align: "left" as const },
  { label: "ผู้ขาย/ผู้รับจ้าง", width: 105, align: "left" as const },
  { label: "หลักฐานการจัดซื้อจัดจ้าง", width: 120, align: "left" as const },
  { label: "จำนวนเงิน\n(บาท)", width: 72, align: "right" as const },
];

function ItemsTable({ d }: { d: W119Data }) {
  const fixed = COLS.reduce((s, c) => s + (c.width ?? 0), 0);
  const widthOf = (c: (typeof COLS)[number]) => (c.width ?? CONTENT_W - fixed - 2 * B) - 6 - 2;
  const cellStyle = (c: (typeof COLS)[number]) => [styles.cell, c.width ? { width: c.width, flexShrink: 0 } : { flex: 1 }];
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B }} fixed>
        {COLS.map((c, i) => (
          <View key={i} style={[...cellStyle(c), { justifyContent: "center" }]}>
            {c.label.split("\n").flatMap((x) => wrap(x, FS, widthOf(c), widthOf(c))).map((l, j) => (
              <Text key={j} style={{ textAlign: "center" }}>
                {t(l)}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {d.items.map((it, ri) => {
        const cells = [String(ri + 1), it.name, it.vendor ?? "-", evidenceText(it), formatBaht(it.amount)];
        return (
          <View key={ri} style={{ flexDirection: "row", borderLeftWidth: B }} wrap={false}>
            {COLS.map((c, i) => (
              <View key={i} style={cellStyle(c)}>
                {(c.align === "left" ? wrap(cells[i], FS, widthOf(c) - SLACK / 2, widthOf(c) - SLACK / 2) : [cells[i]]).map((l, j) => (
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
        <View style={[styles.cell, { width: COLS[4].width, flexShrink: 0 }]}>
          <Text style={{ textAlign: "right" }}>{formatBaht(d.amount)}</Text>
        </View>
      </View>
    </View>
  );
}

export function W119Document({ data: d }: { data: W119Data }) {
  const school = d.school_name;
  const unit = `${school}${d.education_area ? `  ${d.education_area}` : ""}`;
  const keep = [school.replace(/^โรงเรียน/, ""), d.responsible_name ?? ""].filter(Boolean);
  const amount = formatBaht(d.amount);
  const amountText = thaiBahtText(d.amount);
  const plan = [d.project_name, d.activity_name].filter(Boolean).join(" ");
  const names = d.items.map((i) => i.name).join(", ");
  const due = formatThaiDate(addWorkingDays(d.purchase_date, 5));
  const L = 595.28 / 2 - 2.5 * 28.3465;
  return (
    <Document title={`ว.119 ${d.doc_no}`}>
      {/* หน้าต่อ (หน้า 2 เป็นต้นไป) ขอบบน 2.5 ซม. — หน้าแรกดึงหัวบันทึกขึ้นกลับไปที่ 1.5 ซม. ด้วย margin ติดลบ */}
      <Page size="A4" style={[styles.page, { paddingTop: 2.5 * CM }]}>
        <View style={{ marginTop: -CM }}>
          <MemoHeader unit={unit} docNumber={d.doc_no} isoDate={d.record_date} subject="รายงานขอความเห็นชอบการจัดซื้อจัดจ้างและขออนุมัติเบิกจ่ายเงิน" />
        </View>
        <Text style={[styles.gap, { marginTop: 4 }]}>{t(`เรียน   ผู้อำนวยการ${school}`)}</Text>
        <Para
          keep={keep}
          text={`ด้วย${d.admin_group ?? school} มีความจำเป็นต้องจัดหาพัสดุที่เกี่ยวกับค่าใช้จ่ายในการบริหารงาน ได้แก่ ${names}${plan ? ` ตามโครงการ/กิจกรรม ${plan}` : ""}${
            d.purpose ? ` เพื่อ${d.purpose}` : ""
          } จำนวน ${d.items.length} รายการ เป็นเงินทั้งสิ้น ${amount} บาท ${amountText}`}
        />
        <Para
          keep={keep}
          text={`โดยข้าพเจ้า ${d.responsible_name ?? "...................."}${d.responsible_position ? ` ตำแหน่ง ${d.responsible_position}` : ""} ซึ่งเป็นผู้ได้รับมอบหมาย ได้ดำเนินการจัดซื้อจัดจ้างไปก่อนแล้ว เมื่อวันที่ ${formatThaiDate(
            d.purchase_date,
          )} ตามแนวทางปฏิบัติใน${W119_REF}${d.table_ref ? ` ซึ่งเป็นรายการตาม${d.table_ref} (${d.expense_category})` : ` ซึ่งเป็นรายการ${d.expense_category}`} และมีวงเงินการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน 10,000 บาท โดยมีรายละเอียดดังนี้`}
        />
        <ItemsTable d={d} />
        <Para
          keep={keep}
          text={`บัดนี้ ได้รับพัสดุ/บริการไว้ครบถ้วนถูกต้องแล้ว จึงขอรายงานขอความเห็นชอบ พร้อมด้วยหลักฐานการจัดซื้อจัดจ้าง ภายใน 5 วันทำการนับถัดจากวันที่จัดซื้อจัดจ้าง (ครบกำหนดวันที่ ${due}) และเมื่อผู้อำนวยการ${school}ให้ความเห็นชอบแล้ว ให้ถือรายงานฉบับนี้เป็นหลักฐานการตรวจรับพัสดุโดยอนุโลม`}
        />
        <Para
          keep={keep}
          text={`พร้อมกันนี้ ขออนุมัติเบิกจ่ายเงิน${d.fund_source ? `${d.fund_source} ` : ""}จำนวน ${amount} บาท ${amountText} โดยวิธี${d.payment_method === "transfer" ? "โอนเงิน" : "เงินสด"}`}
        />
        {/* ย่อหน้าท้ายจนถึงลงชื่อ ไม่แยกหน้า */}
        <View wrap={false}>
          <Text style={{ marginLeft: INDENT }}>{t("จึงเรียนมาเพื่อโปรดพิจารณา")}</Text>
          <Para keep={keep} indent={INDENT + 20} text="1. ให้ความเห็นชอบการจัดซื้อจัดจ้างดังกล่าวข้างต้น และให้ถือรายงานนี้เป็นหลักฐานการตรวจรับพัสดุโดยอนุโลม ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560" style={{ marginBottom: 0 }} />
          <Para keep={keep} indent={INDENT + 20} text={`2. อนุมัติให้เบิกจ่ายเงิน ตามระเบียบกระทรวงการคลังว่าด้วยการเบิกค่าใช้จ่ายในการบริหารงานของส่วนราชการ พ.ศ. 2553 จำนวน ${amount} บาท ${amountText}`} />
          <Sign role="ผู้ได้รับมอบหมาย" name={d.responsible_name} extra={d.responsible_position ? [`ตำแหน่ง ${d.responsible_position}`] : []} style={{ marginLeft: L - 50, marginTop: 6 }} />
          <View style={{ flexDirection: "row", marginTop: 14 }}>
            <View style={{ width: L }}>
              <Sign role="เจ้าหน้าที่" name={d.procurement_officer} />
              <Sign role="หัวหน้าเจ้าหน้าที่" name={d.procurement_head} style={{ marginTop: 14 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text>{t("- เห็นชอบ")}</Text>
              <Text>{t("- อนุมัติ")}</Text>
              <Sign role="" name={d.director} extra={[`ผู้อำนวยการ${school}`, formatThaiDate(d.record_date)]} style={{ marginTop: 14 }} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** ช่องสี่เหลี่ยมให้ครูติ๊ก (วาดเอง — ฟอนต์ไม่มีอักษร ☐) */
function CheckLine({ text, indent = 0 }: { text: string; indent?: number }) {
  const w = CONTENT_W - indent - 18 - SLACK;
  return (
    <View style={{ flexDirection: "row", marginLeft: indent }} wrap={false}>
      <View style={{ width: 9, height: 9, borderWidth: B, marginTop: 6, marginRight: 9 }} />
      <View style={{ width: w }}>
        {wrap(text, FS, w, w).map((l, i) => (
          <Text key={i}>{t(l)}</Text>
        ))}
      </View>
    </View>
  );
}

/** ใบติดหลักฐาน — หน้าละ 1 หลักฐาน (รายการที่ใช้ใบเสร็จใบเดียวกันรวมเป็นหน้าเดียว) บอกครูว่าต้องติด/แนบอะไร
 * ใบเสร็จ/บิลเงินสด/ใบสำคัญรับเงิน → ติดในกรอบ, ใบรับรองแทนใบเสร็จ (บก.111) → แนบต่อท้าย ไม่มีกรอบ */
export function W119EvidenceDocument({
  data: d,
  refLabel = "รายงาน ว.119",
  title = "ใบติดหลักฐานการจัดซื้อจัดจ้าง",
  partyLabel = "ผู้ขาย/ผู้รับจ้าง",
}: {
  data: Pick<W119Data, "doc_no" | "record_date" | "items" | "payment_method" | "responsible_name">;
  /** ชื่อเอกสารหลักที่ใบนี้แนบ เช่น "บันทึกขออนุมัติเบิกค่าใช้จ่าย" */
  refLabel?: string;
  title?: string;
  partyLabel?: string;
}) {
  const groups: { key: string; items: W119Data["items"]; first: W119Data["items"][number] }[] = [];
  d.items.forEach((it) => {
    const key = [it.vendor, it.evidence, it.receipt_book, it.receipt_no, it.receipt_date].join("|");
    const g = groups.find((x) => x.key === key && (it.receipt_no || it.receipt_book));
    if (g) g.items.push(it);
    else groups.push({ key, items: [it], first: it });
  });
  return (
    <Document title={`${title} ${d.doc_no}`}>
      {groups.map((g, gi) => {
        const rule = evidenceRule(g.first.evidence);
        const sum = g.items.reduce((s, i) => s + i.amount, 0);
        const seqs = g.items.map((i) => d.items.indexOf(i) + 1).join(", ");
        return (
          <Page key={gi} size="A4" style={[styles.page, { paddingTop: 1.5 * 28.3465 }]}>
            <Text style={[styles.title, { marginBottom: 2 }]}>{t(title)}</Text>
            <Text style={{ textAlign: "center", marginBottom: 6 }}>
              {t(`แนบ${refLabel} ที่ ${d.doc_no} ลงวันที่ ${formatThaiDate(d.record_date)} · หลักฐานที่ ${gi + 1}/${groups.length} (รายการที่ ${seqs})`)}
            </Text>
            <Para indent={0} text={`รายการ ${g.items.map((i) => i.name).join(", ")}`} style={{ marginBottom: 0 }} />
            <Para indent={0} text={`${partyLabel} ${g.first.vendor ?? "-"}   จำนวนเงิน ${formatBaht(sum)} บาท ${thaiBahtText(sum)}`} style={{ marginBottom: 0 }} />
            <Para indent={0} text={`หลักฐาน ${evidenceText(g.first)}`} />

            <Text style={styles.bold}>{t("สิ่งที่ต้องติด/แนบ")}</Text>
            {rule.attach.map((a) => (
              <CheckLine key={a} text={a} indent={10} />
            ))}
            {d.payment_method === "transfer" && gi === 0 && <CheckLine text="หลักฐานการโอนเงินให้ผู้ขาย/ผู้รับจ้าง (สลิปโอนเงิน) (แนบต่อท้าย)" indent={10} />}

            {rule.mode === "paste" ? (
              <View style={{ flexGrow: 1, minHeight: 200, borderWidth: B, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginVertical: 8 }}>
                <Text style={{ color: "#94a3b8" }}>{t(`ติด${rule.attach[0].replace(/ \(.*$/, "")}ในกรอบนี้`)}</Text>
                <Text style={{ color: "#94a3b8", fontSize: 14 }}>{t("ใบใหญ่กว่ากรอบ ให้พับหรือแนบต่อท้ายแผ่นนี้")}</Text>
              </View>
            ) : (
              <View style={{ flexGrow: 1, minHeight: 120, borderWidth: B, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginVertical: 8 }}>
                <Text style={{ color: "#94a3b8" }}>{t("หลักฐานรายการนี้เป็นแบบฟอร์มเต็มแผ่น — แนบต่อท้ายแผ่นนี้ ไม่ต้องติด")}</Text>
              </View>
            )}

            <View wrap={false}>
              <Text style={styles.bold}>{t("ตรวจหลักฐานให้ครบก่อนติด")}</Text>
              {RECEIPT_ESSENTIALS.map((x) => (
                <CheckLine key={x} text={x} indent={10} />
              ))}
              <Sign
                role="ผู้ได้รับมอบหมาย"
                name={d.responsible_name}
                extra={["ขอรับรองว่าได้จ่ายเงินตามหลักฐานนี้จริง"]}
                style={{ marginLeft: 595.28 / 2 - 2.5 * 28.3465 - 50, marginTop: 10 }}
              />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
