import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatThaiDate, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { B, CM, CONTENT_W, FAMILY, wrap } from "./procurement-set-document";

// แบบใบสำคัญรับเงินตามหลักเกณฑ์การเบิกจ่ายค่าใช้จ่ายในการจัดกิจกรรมเพื่อเสริมสร้างความรู้ให้กับนักเรียน
// (หนังสือ สพฐ. ที่ ศธ 04002/ว 2983 ลว. 23 พ.ย. 2555 — แนวทางโครงการสนับสนุนค่าใช้จ่ายฯ ปีงบประมาณ 2569 หน้า 98–99)
//   เอกสารแนบ ๑ ใบสำคัญรับเงินสำหรับวิทยากร (A4 แนวตั้ง)
//   เอกสารแนบ ๒ แบบใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน (A4 แนวนอน — คอลัมน์เยอะ)
// ช่องที่ไม่กรอกพิมพ์เป็นจุดไข่ปลาให้เขียนเอง — TH Sarabun New 16pt (ตาราง 15pt)

const FS = 16;
const FS_TABLE = 15;
const DOTS = "....................................................................................................";
const dots = (n: number) => DOTS.slice(0, n);
const v = (s: string | null | undefined, n: number) => (s && s.trim() ? ` ${s.trim()} ` : dots(n));
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const baht = (n: number) => Math.trunc(n).toLocaleString("th-TH");
const satang = (n: number) => String(Math.round((n - Math.trunc(n)) * 100)).padStart(2, "0");
const thDate = (iso: string | null) => {
  if (!iso) return { d: dots(6), m: dots(14), y: dots(10) };
  const [d, m, y] = formatThaiDate(iso).split(" ");
  return { d, m, y };
};

const TH_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const shortDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${TH_SHORT[m]} ${String((y + 543) % 100).padStart(2, "0")}`;
};

const page = { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.25, paddingTop: 1.5 * CM, paddingBottom: 1.2 * CM, paddingLeft: 2.5 * CM, paddingRight: 2 * CM };
const cell = { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 };

// ---------- เอกสารแนบ ๑ ----------
export type SpeakerReceipt = {
  org: string;
  project: string;
  date: string | null;
  name: string;
  house_no: string;
  subdistrict: string;
  district: string;
  province: string;
  received_from: string;
  items: { description: string; amount: number }[];
  payer: string;
};

const SPEAKER_ROWS = 14;
const AMT_W = 90;
const SAT_W = 40;

export function SpeakerReceiptDocument({ data: d }: { data: SpeakerReceipt }) {
  const items = d.items.filter((i) => i.description.trim() || i.amount > 0);
  const total = items.reduce((s, i) => s + i.amount, 0);
  const rows = [...items, ...Array.from({ length: Math.max(0, SPEAKER_ROWS - items.length) }, () => null)];
  const date = thDate(d.date);
  const descW = CONTENT_W - AMT_W - SAT_W - 2 * B;
  return (
    <Document title="ใบสำคัญรับเงินสำหรับวิทยากร">
      <Page size="A4" style={page}>
        <Text style={{ textAlign: "right", fontWeight: "bold" }}>{t("เอกสารแนบ ๑")}</Text>
        <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18 }}>{t("ใบสำคัญรับเงิน")}</Text>
        <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18, marginBottom: 10 }}>{t("สำหรับวิทยากร")}</Text>
        <Text>
          <Text style={{ fontWeight: "bold" }}>{t("ชื่อส่วนราชการผู้จัดกิจกรรม")}</Text>
          {t(v(d.org, 70))}
        </Text>
        {wrap(`โครงการ/หลักสูตร/กิจกรรม${v(d.project, 70)}`, FS, CONTENT_W - 10, CONTENT_W - 10).map((l, i) => (
          <Text key={i} style={i === 0 ? { fontWeight: "normal" } : {}}>
            {t(l)}
          </Text>
        ))}
        <Text style={{ marginTop: 8, marginLeft: CONTENT_W / 2 }}>{t(`วันที่ ${date.d} เดือน ${date.m} พ.ศ. ${date.y}`)}</Text>
        <Text style={{ marginTop: 8, marginLeft: 1.5 * CM }}>{t(`ข้าพเจ้า${v(d.name, 50)}อยู่บ้านเลขที่${v(d.house_no, 30)}`)}</Text>
        <Text>{t(`ตำบล/แขวง${v(d.subdistrict, 30)}อำเภอ/เขต${v(d.district, 30)}จังหวัด${v(d.province, 30)}`)}</Text>
        <Text style={{ marginBottom: 8 }}>{t(`ได้รับเงินจาก${v(d.received_from, 60)}ดังรายการต่อไปนี้`)}</Text>

        <View style={{ borderTopWidth: B, borderLeftWidth: B }}>
          <View style={{ flexDirection: "row" }}>
            <Text style={[cell, { width: descW, textAlign: "center" }]}>{t("รายการ")}</Text>
            <Text style={[cell, { width: AMT_W + SAT_W + B, textAlign: "center" }]}>{t("จำนวนเงิน")}</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", fontSize: FS_TABLE }} wrap={false}>
              <View style={[cell, { width: descW }]}>
                {(r ? wrap(r.description, FS_TABLE, descW - 12, descW - 12) : [" "]).map((l, j) => (
                  <Text key={j}>{t(l) || " "}</Text>
                ))}
              </View>
              <Text style={[cell, { width: AMT_W, textAlign: "right" }]}>{r && r.amount ? baht(r.amount) : " "}</Text>
              <Text style={[cell, { width: SAT_W, textAlign: "center" }]}>{r && r.amount ? satang(r.amount) : " "}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row" }}>
          <Text style={{ width: descW + B, textAlign: "center" }}>{t("บาท")}</Text>
          <Text style={[cell, { width: AMT_W, textAlign: "right", borderLeftWidth: B }]}>{total ? baht(total) : " "}</Text>
          <Text style={[cell, { width: SAT_W, textAlign: "center" }]}>{total ? satang(total) : " "}</Text>
        </View>

        <Text style={{ marginTop: 12 }}>{t(`จำนวนเงิน (${total ? thaiBahtText(total).replace(/^\(|\)$/g, "") : dots(70)}) (ตัวอักษร)`)}</Text>
        <View style={{ marginLeft: CONTENT_W / 2 - 40, marginTop: 14, alignItems: "center", alignSelf: "flex-start" }} wrap={false}>
          <Text>{t(`ลงชื่อ${dots(45)}ผู้รับเงิน`)}</Text>
          <Text>{t(`(${d.name.trim() || dots(45)})`)}</Text>
          <Text style={{ marginTop: 12 }}>{t(`ลงชื่อ${dots(45)}ผู้จ่ายเงิน`)}</Text>
          <Text>{t(`(${d.payer.trim() || dots(45)})`)}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ---------- เอกสารแนบ ๒ ----------
export type StudentReceipt = {
  org: string;
  project: string;
  date_from: string | null;
  date_to: string | null;
  area: string;
  rows: { name: string; address: string; food: number; lodging: number; transport: number; paid_date: string | null }[];
  payer: string;
  payer_position: string;
};

const LAND_W = 841.89 - 2 * 1.5 * CM;
const SC = { no: 36, name: 150, addr: 150, food: 62, lodge: 62, trans: 62, total: 70, date: 70 };
const SIGN_W = LAND_W - Object.values(SC).reduce((a, b) => a + b, 0) - B;
const STUDENT_MIN_ROWS = 15;

export function StudentReceiptDocument({ data: d }: { data: StudentReceipt }) {
  const rows = d.rows.filter((r) => r.name.trim() || r.food || r.lodging || r.transport);
  const sum = (k: "food" | "lodging" | "transport") => rows.reduce((s, r) => s + r[k], 0);
  const grand = sum("food") + sum("lodging") + sum("transport");
  const padded = [...rows, ...Array.from({ length: Math.max(0, STUDENT_MIN_ROWS - rows.length) }, () => null)];
  const a = thDate(d.date_from);
  const b = thDate(d.date_to);
  const head = (w: number, label: string) => (
    <View style={[cell, { width: w, justifyContent: "center" }]}>
      {label.split("\n").map((l, i) => (
        <Text key={i} style={{ textAlign: "center" }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
  const num = (w: number, n: number | null) => <Text style={[cell, { width: w, textAlign: "right" }]}>{n ? money(n) : " "}</Text>;
  return (
    <Document title="แบบใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน">
      <Page size="A4" orientation="landscape" style={{ ...page, paddingLeft: 1.5 * CM, paddingRight: 1.5 * CM, paddingTop: 1.2 * CM }}>
        <View fixed>
          <Text style={{ textAlign: "right", fontWeight: "bold" }}>{t("เอกสารแนบ ๒")}</Text>
          <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18, marginBottom: 6 }}>{t("แบบใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน")}</Text>
          <Text>{t(`ชื่อส่วนราชการผู้จัดกิจกรรม${v(d.org, 50)}โครงการ/หลักสูตร/กิจกรรม${v(d.project, 60)}`)}</Text>
          <Text>{t(`วันที่ ${a.d} เดือน ${a.m} พ.ศ. ${a.y} ถึงวันที่ ${b.d} เดือน ${b.m} พ.ศ. ${b.y}`)}</Text>
          <Text>
            {t(
              `จำนวนผู้เข้าร่วมกิจกรรมทั้งสิ้น${rows.length ? ` ${rows.length} ` : dots(20)}คน ผู้เข้าร่วมกิจกรรมได้รับเงินจากโรงเรียน${grand ? ` ${money(grand)} บาท ` : dots(30)}`,
            )}
          </Text>
          <Text style={{ marginBottom: 6 }}>{t(`สังกัด${v(d.area, 60)}ปรากฏรายละเอียดดังนี้`)}</Text>
          <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B, fontSize: FS_TABLE }}>
            {head(SC.no, "ลำดับที่")}
            {head(SC.name, "ชื่อ – สกุล")}
            {head(SC.addr, "ที่อยู่")}
            {head(SC.food, "ค่าอาหาร\n(บาท)")}
            {head(SC.lodge, "ค่าเช่าที่พัก\n(บาท)")}
            {head(SC.trans, "ค่าพาหนะ\n(บาท)")}
            {head(SC.total, "รวมเป็นเงิน\n(บาท)")}
            {head(SC.date, "วัน เดือน ปี\nที่รับเงิน")}
            {head(SIGN_W, "ลายมือชื่อ\nผู้รับเงิน")}
          </View>
        </View>
        <View style={{ borderLeftWidth: B, fontSize: FS_TABLE }}>
          {padded.map((r, i) => (
            <View key={i} style={{ flexDirection: "row" }} wrap={false}>
              <Text style={[cell, { width: SC.no, textAlign: "center" }]}>{r ? String(i + 1) : " "}</Text>
              <View style={[cell, { width: SC.name }]}>
                {(r ? wrap(r.name, FS_TABLE, SC.name - 12, SC.name - 12) : [" "]).map((l, j) => (
                  <Text key={j}>{t(l) || " "}</Text>
                ))}
              </View>
              <View style={[cell, { width: SC.addr }]}>
                {(r ? wrap(r.address, FS_TABLE, SC.addr - 12, SC.addr - 12) : [" "]).map((l, j) => (
                  <Text key={j}>{t(l) || " "}</Text>
                ))}
              </View>
              {num(SC.food, r?.food ?? null)}
              {num(SC.lodge, r?.lodging ?? null)}
              {num(SC.trans, r?.transport ?? null)}
              {num(SC.total, r ? r.food + r.lodging + r.transport : null)}
              <Text style={[cell, { width: SC.date, textAlign: "center" }]}>{r?.paid_date ? t(shortDate(r.paid_date)) : " "}</Text>
              <Text style={[cell, { width: SIGN_W }]}> </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", fontSize: FS_TABLE }} wrap={false}>
          <Text style={{ width: SC.no + SC.name + SC.addr + B, textAlign: "right", paddingRight: 6, fontWeight: "bold" }}>{t("รวมเป็นเงินทั้งสิ้น")}</Text>
          <Text style={[cell, { width: SC.food, textAlign: "right", borderLeftWidth: B }]}>{rows.length ? money(sum("food")) : " "}</Text>
          {num(SC.lodge, rows.length ? sum("lodging") || null : null)}
          {num(SC.trans, rows.length ? sum("transport") || null : null)}
          {num(SC.total, grand || null)}
        </View>
        <View style={{ marginLeft: LAND_W / 2, marginTop: 14, alignItems: "center", alignSelf: "flex-start" }} wrap={false}>
          <Text>{t(`ลงชื่อ${dots(45)}ผู้จ่ายเงิน`)}</Text>
          <Text>{t(`(${d.payer.trim() || dots(45)})`)}</Text>
          <Text>{t(`ตำแหน่ง${v(d.payer_position, 45)}`)}</Text>
        </View>
      </Page>
    </Document>
  );
}
