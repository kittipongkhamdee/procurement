import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";
import { formatBaht } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 11,
    padding: 32,
    color: "#111827",
  },
  center: { textAlign: "center" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  // "ส่วนราชการ"/"หน่วยงาน" อยู่ชิดขวาบนของฟอร์ม (ตามแบบฟอร์มทะเบียนคุมทรัพย์สินมาตรฐาน) แยกจาก
  // ป้าย/ค่าแถวอื่นๆ ที่ชิดซ้ายตามปกติ
  rightAlign: { alignItems: "flex-end", marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", marginRight: 8 },
  value: { flex: 1, paddingRight: 12 },
  // ไม่ใช้ borderWidth (กรอบรอบทุกด้าน) — เส้นขอบล่างของกรอบตารางจะไปทับกับ borderBottomWidth
  // ของแถวข้อมูลแถวสุดท้าย (cell/cellLast ด้านล่าง) ทำให้เส้นล่างสุดหนากว่าเส้นแบ่งแถวอื่นๆ 2 เท่า
  // จึงกำหนดเฉพาะด้านบน/ซ้าย/ขวา ปล่อยให้เส้นล่างสุดมาจากแถวสุดท้ายเส้นเดียวพอ
  table: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#111827" },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  tRow: { flexDirection: "row" },
  cell: {
    fontSize: 11,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  cellLast: {
    fontSize: 11,
    padding: 4,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  // รวมกันต้องได้ 100% พอดี — เกินแล้วตารางจะกว้างกว่าหน้ากระดาษ ทำให้คอลัมน์ท้ายๆ ล้นออกนอกขอบ
  // กระดาษ (เคยเกิดมาแล้วตอนรวมได้ 105%)
  // colDate ต้องพอสำหรับ "28/05/2569" (แถวรับเข้ารายการที่มีวันที่เต็ม) ส่วนแถวคิดค่าเสื่อมรายปี
  // อื่นๆ แสดงแค่ปี พ.ศ. 4 หลัก ซึ่งแคบกว่ามากอยู่แล้ว
  colDate: { width: "9%" },
  colDocRef: { width: "8%" },
  colItem: { width: "12%" },
  colQty: { width: "6%", textAlign: "right" },
  colUnit: { width: "6%" },
  colUnitPrice: { width: "8%", textAlign: "right" },
  colTotal: { width: "8%", textAlign: "right" },
  colLife: { width: "5%", textAlign: "right" },
  colRate: { width: "6%", textAlign: "right" },
  colAnnual: { width: "8%", textAlign: "right" },
  colCumulative: { width: "8%", textAlign: "right" },
  colNet: { width: "8%", textAlign: "right" },
  colNote: { width: "8%" },
  cellLine: { fontSize: 11 },
  // ไม่ใช้ fontWeight: "bold" — เจอบั๊กซ้ำๆ ว่าตัวอักษรตัวแรกของ Text ตัวหนาที่อยู่ในคอลัมน์กว้างแบบ
  // % (เช่น "รายการ", "อายุใช้งาน") โดนตัดหายไปเฉยๆ เฉพาะกรณีนี้ (Text ตัวหนาที่กว้างคงที่ เช่น ป้ายชื่อ
  // ในส่วนหัวเอกสาร หรือชื่อเรื่องใหญ่ที่กว้างอัตโนมัติ ไม่เจอปัญหานี้) ลองแก้ด้วยการเติมช่องว่างนำหน้า
  // (ทั้งช่องว่างธรรมดาและ non-breaking space) และเพิ่ม padding แล้วก็ยังไม่หาย จึงเปลี่ยนมาไม่ใช้ตัวหนา
  // กับหัวตารางเลย ใช้พื้นหลังสีเทาอ่อนของแถวหัวตาราง (tHeadRow) แยกความแตกต่างจากแถวข้อมูลแทน
  headLine: { fontSize: 11, textAlign: "center" },
});

export type AssetDepreciationRow = {
  yearLabel: string;
  itemLabel: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  usefulLifeYears: number | null;
  ratePercent: number | null;
  annual: number | null;
  cumulative: number | null;
  net: number | null;
  // แยกเป็นบรรทัดสั้นๆ ที่ตัดคำมาให้แล้วล่วงหน้า แทนที่จะเป็นประโยคยาวประโยคเดียว — ข้อความไทยไม่มี
  // ช่องว่างคั่นคำ ทำให้ระบบตัดบรรทัดอัตโนมัติของ react-pdf ตัดคำยาวๆ กลางคำไม่ได้ ล้นออกนอกช่องแคบๆ
  // ของคอลัมน์นี้แทน (ดู thai-pdf.ts) จึงต้องกำหนดจุดตัดบรรทัดเองให้สั้นพอ
  note: string[] | null;
};

export type AssetRegisterPdfData = {
  asset_code: string | null;
  sequence_no: string | null;
  name: string;
  category_name: string | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  building: string;
  floor: string | null;
  room: string;
  spec: string | null;
  model: string | null;
  school_name: string;
  education_area: string | null;
  school_address: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  budget_source_name: string | null;
  acquisition_method: string | null;
  acquired_year: number | null;
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
  schedule: AssetDepreciationRow[];
};

// react-pdf ตัดตัวอักษรตัวแรกของ Text ทิ้งเป็นบางครั้งแบบสุ่มเดา (เจอมาแล้วกับ "รายการ" -> "ายการ",
// "อายุ" -> "ายุ") ไม่ว่าจะห่อด้วย View หรือไม่ก็ตาม เพิ่ม paddingLeft อย่างเดียวไม่พอ — ลองเติม
// "ช่องว่างธรรมดา" นำหน้าไปแล้วก็ยังไม่พอ (เอนจินตัดช่องว่างธรรมดาที่ต้นบรรทัดทิ้งก่อนวัดความกว้าง
// เป็นเรื่องปกติของ text layout ทำให้ตัวจริงตัวแรกยังโดนตัดอยู่ดี) เปลี่ยนมาใช้ non-breaking space
// (U+00A0) แทน ซึ่งเอนจินไม่ตัดทิ้งเหมือนช่องว่างธรรมดา ตัวอักษรจริงตัวแรกจะได้ไม่ใช่ตัวที่โดนตัด —
// ใช้แทน t() ทุกจุดในไฟล์นี้ที่ข้อความอาจขึ้นต้นบรรทัด/เซลล์
function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

// แถวหัวเอกสาร — รับ 1 ช่องขึ้นไปในบรรทัดเดียวกัน (เช่น "ประเภท ... รหัส ... ลักษณะ/คุณสมบัติ ... รุ่น/แบบ ...")
// label กว้างอัตโนมัติ + marginRight, value กว้าง flex:1 แบ่งพื้นที่ที่เหลือของแถวเท่าๆ กันโดยอัตโนมัติ
// จาก flexDirection: row — ใช้ได้ทั้งแถว 1, 2 และ 4 ช่อง
function HeaderRowGroup({ items }: { items: { label: string; value: string | null | undefined }[] }) {
  return (
    <View style={styles.row}>
      {items.flatMap((it, i) => [
        <Text style={styles.label} key={`l${i}`}>
          {guard(it.label)}
        </Text>,
        <Text style={styles.value} key={`v${i}`}>
          {guard(it.value || "-")}
        </Text>,
      ])}
    </View>
  );
}

// หัวตารางบางคอลัมน์แคบ (เช่น "อายุใช้งาน", "เสื่อมสะสม") เป็นคำไทยยาวไม่มีช่องว่างคั่นคำ ตัดบรรทัด
// อัตโนมัติของ react-pdf ตัดกลางคำไม่ได้ ล้นทับคอลัมน์ข้างๆ (ดู note ใน AssetDepreciationRow ด้านบน) —
// จึงกำหนดจุดตัดบรรทัดของหัวตารางเองล่วงหน้าเป็นอาร์เรย์บรรทัดสั้นๆ แทนสตริงยาวประโยคเดียว
function HeadCell({ style, lines }: { style: StyleProp; lines: string | string[] }) {
  if (typeof lines === "string") {
    return <Text style={[style, styles.headLine]}>{guard(lines)}</Text>;
  }
  return (
    <View style={style}>
      {lines.map((line, i) => (
        <Text style={styles.headLine} key={i}>
          {guard(line)}
        </Text>
      ))}
    </View>
  );
}

export function AssetRegisterDocument({ data }: { data: AssetRegisterPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{guard("ทะเบียนคุมทรัพย์สิน")}</Text>
        </View>

        <View style={styles.rightAlign}>
          <HeaderRowGroup items={[{ label: "ส่วนราชการ", value: data.school_name }]} />
          <HeaderRowGroup items={[{ label: "หน่วยงาน", value: null }]} />
        </View>

        <HeaderRowGroup items={[{ label: "ลำดับที่", value: data.sequence_no }]} />
        <HeaderRowGroup
          items={[
            { label: "ประเภท", value: data.category_name },
            { label: "รหัส", value: data.asset_code },
            { label: "ลักษณะ/คุณสมบัติ", value: data.spec },
            { label: "รุ่น/แบบ", value: data.model },
          ]}
        />
        <HeaderRowGroup
          items={[
            { label: "สถานที่ตั้ง", value: location },
            { label: "ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค", value: data.vendor_name },
            { label: "ที่อยู่", value: data.vendor_address },
            { label: "โทรศัพท์", value: data.vendor_phone },
          ]}
        />
        <HeaderRowGroup
          items={[
            { label: "ประเภทเงิน", value: data.budget_source_name },
            { label: "วิธีการได้มา", value: data.acquisition_method },
          ]}
        />

        <View style={[styles.table, { marginTop: 8 }]}>
          <View style={styles.tHeadRow}>
            <HeadCell style={[styles.cell, styles.colDate]} lines={["วัน/เดือน/", "ปี"]} />
            <HeadCell style={[styles.cell, styles.colDocRef]} lines={["ที่", "เอกสาร"]} />
            <HeadCell style={[styles.cell, styles.colItem]} lines="รายการ" />
            <HeadCell style={[styles.cell, styles.colQty]} lines="จำนวน" />
            <HeadCell style={[styles.cell, styles.colUnit]} lines="หน่วย" />
            <HeadCell style={[styles.cell, styles.colUnitPrice]} lines={["ราคา/", "หน่วย"]} />
            <HeadCell style={[styles.cell, styles.colTotal]} lines={["มูลค่า", "รวม"]} />
            <HeadCell style={[styles.cell, styles.colLife]} lines={["อายุ", "ใช้งาน"]} />
            <HeadCell style={[styles.cell, styles.colRate]} lines={["อัตรา", "(%)"]} />
            <HeadCell style={[styles.cell, styles.colAnnual]} lines={["ค่าเสื่อม", "ปี"]} />
            <HeadCell style={[styles.cell, styles.colCumulative]} lines={["เสื่อม", "สะสม"]} />
            <HeadCell style={[styles.cell, styles.colNet]} lines={["มูลค่า", "สุทธิ"]} />
            <HeadCell style={[styles.cellLast, styles.colNote]} lines="หมายเหตุ" />
          </View>
          {data.schedule.map((row, i) => (
            <View style={styles.tRow} key={i}>
              <Text style={[styles.cell, styles.colDate]}>{guard(row.yearLabel)}</Text>
              <Text style={[styles.cell, styles.colDocRef]}>{guard("")}</Text>
              <Text style={[styles.cell, styles.colItem]}>{guard(row.itemLabel)}</Text>
              <Text style={[styles.cell, styles.colQty]}>{guard(row.quantity ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnit]}>{guard(row.unit ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnitPrice]}>{guard(row.unitPrice != null ? formatBaht(row.unitPrice) : "")}</Text>
              <Text style={[styles.cell, styles.colTotal]}>{guard(row.total != null ? formatBaht(row.total) : "")}</Text>
              <Text style={[styles.cell, styles.colLife]}>{guard(row.usefulLifeYears ?? "")}</Text>
              <Text style={[styles.cell, styles.colRate]}>{guard(row.ratePercent != null ? row.ratePercent.toFixed(2) : "")}</Text>
              <Text style={[styles.cell, styles.colAnnual]}>{guard(row.annual != null ? formatBaht(row.annual) : "")}</Text>
              <Text style={[styles.cell, styles.colCumulative]}>{guard(row.cumulative != null ? formatBaht(row.cumulative) : "")}</Text>
              <Text style={[styles.cell, styles.colNet]}>{guard(row.net != null ? formatBaht(row.net) : "")}</Text>
              <View style={[styles.cellLast, styles.colNote]}>
                {(row.note ?? []).map((line, j) => (
                  <Text style={styles.cellLine} key={j}>
                    {guard(line)}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
