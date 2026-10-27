import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { registerThSarabunFont, t } from "./thai-pdf";

registerThSarabunFont();

const styles = StyleSheet.create({
  page: { fontFamily: "THSarabunNew", fontSize: 13, padding: 24, color: "#111827" },
  center: { textAlign: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  table: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#111827" },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  tRow: { flexDirection: "row" },
  cell: { fontSize: 11.5, padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  cellLast: { fontSize: 11.5, padding: 3, borderBottomWidth: 1, borderColor: "#111827" },
  footRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  footCell: { fontSize: 11.5, fontWeight: "bold", padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  footCellLast: { fontSize: 11.5, fontWeight: "bold", padding: 3, borderBottomWidth: 1, borderColor: "#111827" },
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
  headLine: { fontSize: 11.5, textAlign: "center" },
  // กรอบรายละเอียดหัวรายงาน
  infoBox: { marginTop: 10, flexDirection: "row", borderWidth: 0.8, borderColor: "#94a3b8", backgroundColor: "#f8fafc" },
  infoLeft: { flex: 1, padding: 8, borderRightWidth: 0.8, borderColor: "#94a3b8" },
  infoRight: { width: 400, padding: 8, justifyContent: "center" },
  infoHead: { fontSize: 12, fontWeight: "bold", marginBottom: 3 },
  infoRow: { flexDirection: "row", marginBottom: 1 },
  infoLabel: { width: 52, fontSize: 12, color: "#475569" },
  infoValue: { flex: 1, fontSize: 13 },
  statRow: { flexDirection: "row" },
  stat: { width: "50%", paddingVertical: 2, paddingHorizontal: 4 },
  statLabel: { fontSize: 11.5, color: "#475569" },
  statValue: { fontSize: 14, fontWeight: "bold" },
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
  /** ตัวกรองที่ใช้ตอนพิมพ์ (ข้อความพร้อมแสดง) — ไม่มี = ทั้งหมด */
  filters?: { location?: string; category?: string; condition?: string; search?: string };
  /** วันที่พิมพ์/คำนวณค่าเสื่อม (YYYY-MM-DD ค.ศ.) */
  printed_date?: string;
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

  const f = data.filters ?? {};
  const filterRows = (
    [
      ["สถานที่", f.location],
      ["หมวดหมู่", f.category],
      ["สภาพ", f.condition],
      ["คำค้น", f.search ? `"${f.search}"` : ""],
    ] as [string, string | undefined][]
  ).filter((r): r is [string, string] => !!r[1]);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{guard("สรุปรายการทรัพย์สิน")}</Text>
          <Text style={{ fontSize: 14 }}>{guard(data.school_name)}</Text>
        </View>

        {/* รายละเอียดหัวเรื่อง: กรอบเงื่อนไขที่ใช้ (ซ้าย) + ตัวเลขสรุป (ขวา) */}
        <View style={styles.infoBox}>
          <View style={styles.infoLeft}>
            <Text style={styles.infoHead}>{guard("เงื่อนไขของรายการ")}</Text>
            {filterRows.length === 0 ? (
              <Text style={styles.infoValue}>{guard("ทุกรายการ (ไม่ได้เลือกตัวกรอง)")}</Text>
            ) : (
              filterRows.map(([label, value]) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{guard(label)}</Text>
                  <Text style={styles.infoValue}>{guard(value)}</Text>
                </View>
              ))
            )}
          </View>
          <View style={styles.infoRight}>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{guard("จำนวนรายการ")}</Text>
                <Text style={styles.statValue}>{guard(`${data.rows.length.toLocaleString("th-TH")} รายการ`)}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{guard("ราคาทุนรวม")}</Text>
                <Text style={styles.statValue}>{guard(`${formatBaht(totals.price)} บาท`)}</Text>
              </View>
            </View>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{guard("มูลค่าสุทธิรวม")}</Text>
                <Text style={styles.statValue}>{guard(`${formatBaht(totals.net)} บาท`)}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{guard("คำนวณค่าเสื่อม ณ วันที่")}</Text>
                <Text style={styles.statValue}>{guard(data.printed_date ? formatThaiDate(data.printed_date) : "-")}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.table, { marginTop: 12 }]}>
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
            <View style={styles.tRow} key={row.seq} wrap={false}>
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
          <View style={styles.footRow} wrap={false}>
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
