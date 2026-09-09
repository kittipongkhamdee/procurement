import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 9, padding: 24, color: "#111827" },
  center: { textAlign: "center" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  table: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#111827" },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  tRow: { flexDirection: "row" },
  cell: { fontSize: 8, padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  cellLast: { fontSize: 8, padding: 3, borderBottomWidth: 1, borderColor: "#111827" },
  footRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  footCell: { fontSize: 8, fontWeight: "bold", padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  footCellLast: { fontSize: 8, fontWeight: "bold", padding: 3, borderBottomWidth: 1, borderColor: "#111827" },
  // รวมกันต้องได้ 100% พอดี — เกินแล้วตารางจะกว้างกว่าหน้ากระดาษ ทำให้คอลัมน์ท้ายๆ ล้นออกนอกขอบ
  // กระดาษ (ดูปัญหาเดียวกันที่บันทึกไว้ใน asset-register-document.tsx)
  // 3+12+9+9+5+5+10+6+5+8+5+8+8+7 = 100
  colSeq: { width: "3%", textAlign: "center" },
  colName: { width: "12%" },
  colCategory: { width: "9%" },
  colCode: { width: "9%" },
  colQty: { width: "5%", textAlign: "center" },
  colUnit: { width: "5%", textAlign: "center" },
  colLocation: { width: "10%" },
  colCondition: { width: "6%", textAlign: "center" },
  colYear: { width: "5%", textAlign: "center" },
  colPrice: { width: "8%", textAlign: "right" },
  colLife: { width: "5%", textAlign: "center" },
  colAnnual: { width: "8%", textAlign: "right" },
  colCumulative: { width: "8%", textAlign: "right" },
  colNet: { width: "7%", textAlign: "right" },
  headLine: { fontSize: 8, textAlign: "center" },
});

function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

export type AssetSummaryRow = {
  seq: number;
  name: string;
  categoryName: string | null;
  assetCode: string | null;
  quantity: number;
  unit: string | null;
  location: string;
  condition: string;
  acquiredYear: number | null;
  price: number | null;
  usefulLifeYears: number | null;
  annual: number | null;
  cumulative: number | null;
  net: number | null;
};

export type AssetSummaryPdfData = {
  school_name: string;
  rows: AssetSummaryRow[];
};

export function AssetSummaryDocument({ data }: { data: AssetSummaryPdfData }) {
  const totals = data.rows.reduce(
    (acc, row) => ({
      price: acc.price + (row.price ?? 0),
      annual: acc.annual + (row.annual ?? 0),
      cumulative: acc.cumulative + (row.cumulative ?? 0),
      net: acc.net + (row.net ?? 0),
    }),
    { price: 0, annual: 0, cumulative: 0, net: 0 },
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{guard("สรุปรายการทรัพย์สิน")}</Text>
          <Text>{guard(data.school_name)}</Text>
        </View>

        <View style={[styles.table, { marginTop: 8 }]}>
          <View style={styles.tHeadRow} fixed>
            <Text style={[styles.cell, styles.colSeq, styles.headLine]}>{guard("ลำดับ")}</Text>
            <Text style={[styles.cell, styles.colName, styles.headLine]}>{guard("รายการ")}</Text>
            <Text style={[styles.cell, styles.colCategory, styles.headLine]}>{guard("หมวดหมู่")}</Text>
            <Text style={[styles.cell, styles.colCode, styles.headLine]}>{guard("หมายเลขครุภัณฑ์")}</Text>
            <Text style={[styles.cell, styles.colQty, styles.headLine]}>{guard("จำนวน")}</Text>
            <Text style={[styles.cell, styles.colUnit, styles.headLine]}>{guard("หน่วย")}</Text>
            <Text style={[styles.cell, styles.colLocation, styles.headLine]}>{guard("ที่ตั้ง")}</Text>
            <Text style={[styles.cell, styles.colCondition, styles.headLine]}>{guard("สภาพ")}</Text>
            <Text style={[styles.cell, styles.colYear, styles.headLine]}>{guard("ปีที่ได้มา")}</Text>
            <Text style={[styles.cell, styles.colPrice, styles.headLine]}>{guard("ราคาทุน (บาท)")}</Text>
            <Text style={[styles.cell, styles.colLife, styles.headLine]}>{guard("อายุใช้งาน (ปี)")}</Text>
            <Text style={[styles.cell, styles.colAnnual, styles.headLine]}>{guard("ค่าเสื่อม/ปี (บาท)")}</Text>
            <Text style={[styles.cell, styles.colCumulative, styles.headLine]}>{guard("ค่าเสื่อมสะสม (บาท)")}</Text>
            <Text style={[styles.cellLast, styles.colNet, styles.headLine]}>{guard("มูลค่าสุทธิ (บาท)")}</Text>
          </View>
          {data.rows.map((row) => (
            <View style={styles.tRow} key={row.seq}>
              <Text style={[styles.cell, styles.colSeq]}>{guard(row.seq)}</Text>
              <Text style={[styles.cell, styles.colName]}>{guard(row.name)}</Text>
              <Text style={[styles.cell, styles.colCategory]}>{guard(row.categoryName ?? "-")}</Text>
              <Text style={[styles.cell, styles.colCode]}>{guard(row.assetCode ?? "ยังไม่ติดป้าย")}</Text>
              <Text style={[styles.cell, styles.colQty]}>{guard(row.quantity)}</Text>
              <Text style={[styles.cell, styles.colUnit]}>{guard(row.unit ?? "-")}</Text>
              <Text style={[styles.cell, styles.colLocation]}>{guard(row.location)}</Text>
              <Text style={[styles.cell, styles.colCondition]}>{guard(row.condition)}</Text>
              <Text style={[styles.cell, styles.colYear]}>{guard(row.acquiredYear ?? "-")}</Text>
              <Text style={[styles.cell, styles.colPrice]}>{guard(row.price != null ? formatBaht(row.price) : "-")}</Text>
              <Text style={[styles.cell, styles.colLife]}>{guard(row.usefulLifeYears ?? "-")}</Text>
              <Text style={[styles.cell, styles.colAnnual]}>{guard(row.annual != null ? formatBaht(row.annual) : "-")}</Text>
              <Text style={[styles.cell, styles.colCumulative]}>{guard(row.cumulative != null ? formatBaht(row.cumulative) : "-")}</Text>
              <Text style={[styles.cellLast, styles.colNet]}>{guard(row.net != null ? formatBaht(row.net) : "-")}</Text>
            </View>
          ))}
          <View style={styles.footRow}>
            <Text style={[styles.footCell, styles.colSeq]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colName]}>{guard(`รวม ${data.rows.length} รายการ`)}</Text>
            <Text style={[styles.footCell, styles.colCategory]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colCode]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colQty]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colUnit]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colLocation]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colCondition]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colYear]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colPrice]}>{guard(formatBaht(totals.price))}</Text>
            <Text style={[styles.footCell, styles.colLife]}>{guard("")}</Text>
            <Text style={[styles.footCell, styles.colAnnual]}>{guard(formatBaht(totals.annual))}</Text>
            <Text style={[styles.footCell, styles.colCumulative]}>{guard(formatBaht(totals.cumulative))}</Text>
            <Text style={[styles.footCellLast, styles.colNet]}>{guard(formatBaht(totals.net))}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
