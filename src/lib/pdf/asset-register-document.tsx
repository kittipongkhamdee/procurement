import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
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
  subtitle: { fontSize: 11, fontWeight: "bold", marginTop: 6, marginBottom: 4 },
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
  colDate: { width: "8%" },
  colItem: { width: "18%" },
  colQty: { width: "6%", textAlign: "right" },
  colUnit: { width: "6%" },
  colUnitPrice: { width: "9%", textAlign: "right" },
  colTotal: { width: "9%", textAlign: "right" },
  colLife: { width: "6%", textAlign: "right" },
  colRate: { width: "6%", textAlign: "right" },
  colAnnual: { width: "9%", textAlign: "right" },
  colCumulative: { width: "9%", textAlign: "right" },
  colNet: { width: "9%", textAlign: "right" },
  colNote: { width: "10%" },
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
  note: string | null;
};

export type AssetRegisterPdfData = {
  asset_code: string | null;
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

export function AssetRegisterDocument({ data }: { data: AssetRegisterPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room].filter(Boolean).join(" ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("ทะเบียนคุมทรัพย์สิน (สพฐ.)")}</Text>
          <Text>{t(data.category_name ? `ประเภท: ${data.category_name}` : "")}</Text>
        </View>

        <View style={styles.hr} />

        <View style={styles.headerCols}>
          <View style={styles.headerCol}>
            <HeaderRow label="รหัสครุภัณฑ์" value={data.asset_code} />
            <HeaderRow label="ชื่อทรัพย์สิน" value={data.name} />
            <HeaderRow label="สถานที่ตั้ง/หน่วยงาน" value={location} />
            <HeaderRow label="ลักษณะ/คุณสมบัติ" value={[data.model, data.spec].filter(Boolean).join(" — ") || null} />
          </View>
          <View style={styles.headerCol}>
            <HeaderRow label="หน่วยงาน" value={data.school_name} />
            <HeaderRow label="ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค" value={data.vendor_name} />
            <HeaderRow label="ที่อยู่/โทรศัพท์ผู้ขาย" value={[data.vendor_address, data.vendor_phone].filter(Boolean).join(" โทร. ") || null} />
            <HeaderRow
              label="ประเภทเงิน/วิธีการได้มา"
              value={[data.budget_source_name, data.acquisition_method].filter(Boolean).join(" / ") || null}
            />
          </View>
        </View>

        <Text style={styles.subtitle}>{t("รายการคำนวณค่าเสื่อมราคา")}</Text>
        <View style={styles.table}>
          <View style={styles.tHeadRow}>
            <Text style={[styles.cell, styles.colDate, { fontWeight: "bold" }]}>{t("ปี พ.ศ.")}</Text>
            <Text style={[styles.cell, styles.colItem, { fontWeight: "bold" }]}>{t("รายการ")}</Text>
            <Text style={[styles.cell, styles.colQty, { fontWeight: "bold" }]}>{t("จำนวน")}</Text>
            <Text style={[styles.cell, styles.colUnit, { fontWeight: "bold" }]}>{t("หน่วย")}</Text>
            <Text style={[styles.cell, styles.colUnitPrice, { fontWeight: "bold" }]}>{t("ราคา/หน่วย")}</Text>
            <Text style={[styles.cell, styles.colTotal, { fontWeight: "bold" }]}>{t("มูลค่ารวม")}</Text>
            <Text style={[styles.cell, styles.colLife, { fontWeight: "bold" }]}>{t("อายุใช้งาน")}</Text>
            <Text style={[styles.cell, styles.colRate, { fontWeight: "bold" }]}>{t("อัตรา%")}</Text>
            <Text style={[styles.cell, styles.colAnnual, { fontWeight: "bold" }]}>{t("ค่าเสื่อมปี")}</Text>
            <Text style={[styles.cell, styles.colCumulative, { fontWeight: "bold" }]}>{t("เสื่อมสะสม")}</Text>
            <Text style={[styles.cell, styles.colNet, { fontWeight: "bold" }]}>{t("มูลค่าสุทธิ")}</Text>
            <Text style={[styles.cellLast, styles.colNote, { fontWeight: "bold" }]}>{t("หมายเหตุ")}</Text>
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
              <Text style={[styles.cellLast, styles.colNote]}>{t(row.note ?? "")}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
