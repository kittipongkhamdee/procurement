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
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  headerCols: { flexDirection: "row", gap: 20 },
  headerCol: { width: "50%" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 130 },
  value: { flex: 1, paddingRight: 12 },
  table: { marginTop: 4, borderWidth: 1, borderColor: "#111827" },
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
  colDate: { width: "10%" },
  colItem: { width: "14%" },
  colQty: { width: "6%", textAlign: "right" },
  colUnit: { width: "6%" },
  colUnitPrice: { width: "8%", textAlign: "right" },
  colTotal: { width: "8%", textAlign: "right" },
  colLife: { width: "7%", textAlign: "right" },
  colRate: { width: "6%", textAlign: "right" },
  colAnnual: { width: "8%", textAlign: "right" },
  colCumulative: { width: "8%", textAlign: "right" },
  colNet: { width: "8%", textAlign: "right" },
  colNote: { width: "11%" },
  cellLine: { fontSize: 11 },
  headLine: { fontSize: 11, fontWeight: "bold" },
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

function HeaderRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t(label)}</Text>
      <Text style={styles.value}>{t(value || "-")}</Text>
    </View>
  );
}

// หัวตารางบางคอลัมน์แคบ (เช่น "อายุใช้งาน", "เสื่อมสะสม") เป็นคำไทยยาวไม่มีช่องว่างคั่นคำ ตัดบรรทัด
// อัตโนมัติของ react-pdf ตัดกลางคำไม่ได้ ล้นทับคอลัมน์ข้างๆ (ดู note ใน AssetDepreciationRow ด้านบน) —
// จึงกำหนดจุดตัดบรรทัดของหัวตารางเองล่วงหน้าเป็นอาร์เรย์บรรทัดสั้นๆ แทนสตริงยาวประโยคเดียว
function HeadCell({ style, lines }: { style: StyleProp; lines: string | string[] }) {
  const arr = Array.isArray(lines) ? lines : [lines];
  return (
    <View style={style}>
      {arr.map((line, i) => (
        <Text style={styles.headLine} key={i}>
          {t(line)}
        </Text>
      ))}
    </View>
  );
}

export function AssetRegisterDocument({ data }: { data: AssetRegisterPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room].filter(Boolean).join(" ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("ทะเบียนคุมทรัพย์สิน (สพฐ.)")}</Text>
        </View>

        <View style={styles.hr} />

        <View style={styles.headerCols}>
          <View style={styles.headerCol}>
            <HeaderRow label="ลำดับที่" value={data.sequence_no} />
            <HeaderRow label="ประเภท" value={data.category_name} />
            <HeaderRow label="รหัส" value={data.asset_code} />
            <HeaderRow label="ชื่อทรัพย์สิน" value={data.name} />
            <HeaderRow label="ลักษณะ/คุณสมบัติ" value={[data.model, data.spec].filter(Boolean).join(" — ") || null} />
            <HeaderRow label="สถานที่ตั้ง/หน่วยงาน" value={location} />
          </View>
          <View style={styles.headerCol}>
            <HeaderRow label="ส่วนราชการ" value={data.education_area} />
            <HeaderRow label="หน่วยงาน" value={data.school_name} />
            <HeaderRow label="ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค" value={data.vendor_name} />
            <HeaderRow label="ที่อยู่ผู้ขาย/ผู้รับจ้าง/ผู้บริจาค" value={[data.vendor_address, data.vendor_phone].filter(Boolean).join(" โทร. ") || null} />
            <HeaderRow label="ประเภทเงิน" value={data.budget_source_name} />
            <HeaderRow label="วิธีการได้มา" value={data.acquisition_method} />
          </View>
        </View>

        <View style={[styles.table, { marginTop: 8 }]}>
          <View style={styles.tHeadRow}>
            <HeadCell style={[styles.cell, styles.colDate]} lines="ปี พ.ศ." />
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
              <Text style={[styles.cell, styles.colDate]}>{t(row.yearLabel)}</Text>
              <Text style={[styles.cell, styles.colItem]}>{t(row.itemLabel)}</Text>
              <Text style={[styles.cell, styles.colQty]}>{t(row.quantity ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnit]}>{t(row.unit ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnitPrice]}>{t(row.unitPrice != null ? formatBaht(row.unitPrice) : "")}</Text>
              <Text style={[styles.cell, styles.colTotal]}>{t(row.total != null ? formatBaht(row.total) : "")}</Text>
              <Text style={[styles.cell, styles.colLife]}>{t(row.usefulLifeYears ?? "")}</Text>
              <Text style={[styles.cell, styles.colRate]}>{t(row.ratePercent != null ? row.ratePercent.toFixed(2) : "")}</Text>
              <Text style={[styles.cell, styles.colAnnual]}>{t(row.annual != null ? formatBaht(row.annual) : "")}</Text>
              <Text style={[styles.cell, styles.colCumulative]}>{t(row.cumulative != null ? formatBaht(row.cumulative) : "")}</Text>
              <Text style={[styles.cell, styles.colNet]}>{t(row.net != null ? formatBaht(row.net) : "")}</Text>
              <View style={[styles.cellLast, styles.colNote]}>
                {(row.note ?? []).map((line, j) => (
                  <Text style={styles.cellLine} key={j}>
                    {t(line)}
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
