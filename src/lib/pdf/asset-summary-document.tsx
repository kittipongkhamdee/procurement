import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

registerThSarabunFont();

const styles = StyleSheet.create({
  page: { fontFamily: "THSarabunNew", fontSize: 13, padding: 24, color: "#111827" },
  center: { textAlign: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  // เส้นซ้าย/ขวา/บนอยู่ที่แถวแต่ละแถว ไม่ใส่ที่กรอบตาราง — ไม่งั้นเส้นข้างของกรอบยืดลงสุดหน้าที่ 1 และหน้าถัดไปขาดเส้นบน
  table: { marginTop: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9", borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#111827" },
  tRow: { flexDirection: "row", borderLeftWidth: 1, borderColor: "#111827" },
  cell: { fontSize: 11.5, padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  cellLast: { fontSize: 11.5, padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  footRow: { flexDirection: "row", backgroundColor: "#f1f5f9", borderLeftWidth: 1, borderColor: "#111827" },
  footCell: { fontSize: 11.5, fontWeight: "bold", padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
  footCellLast: { fontSize: 11.5, fontWeight: "bold", padding: 3, borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#111827" },
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
  // รายละเอียดหัวรายงานแบบกะทัดรัด
  infoBlock: { marginTop: 6 },
  infoLine: { fontSize: 12.5, marginBottom: 1 },
});

// ข้อความไทยไม่มีช่องว่างระหว่างคำ react-pdf ตัดบรรทัดเองไม่ได้ (ล้นคอลัมน์ / ข้อความตกไปอยู่ท้ายเซลล์) —
// ตัดล่วงหน้าตามความกว้างคอลัมน์จริง (A4 แนวนอน กว้าง 841.89pt หักขอบกระดาษ 24pt ×2 แล้วหักช่องไฟ+เส้นในเซลล์)
const CONTENT_W = 841.89 - 48;
const CELL_FS = 11.5;
function TextCell({ text, pct, align = "left", last = false }: { text: string; pct: number; align?: "left" | "center" | "right"; last?: boolean }) {
  const w = (pct / 100) * CONTENT_W - 6 - 1 - 3;
  const lines = wrapByWidth(text, CELL_FS, w, w, false, "THSarabunNew");
  return (
    <View style={[last ? styles.cellLast : styles.cell, { width: `${pct}%` }]}>
      {lines.map((l, i) => (
        <Text key={i} style={{ fontSize: CELL_FS, textAlign: align }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

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

        {/* รายละเอียดหัวเรื่องแบบกะทัดรัด 2 บรรทัด: เงื่อนไขที่ใช้ + ตัวเลขสรุป (ไม่ใช้กรอบ ประหยัดเนื้อที่) */}
        <View style={styles.infoBlock}>
          <Text style={styles.infoLine}>
            {guard(
              `เงื่อนไข: ${filterRows.length === 0 ? "ทุกรายการ (ไม่ได้เลือกตัวกรอง)" : filterRows.map(([l, v]) => `${l} ${v}`).join("   |   ")}`,
            )}
          </Text>
          <Text style={styles.infoLine}>
            {guard(
              `จำนวน ${data.rows.length.toLocaleString("th-TH")} รายการ   |   ราคาทุนรวม ${formatBaht(totals.price)} บาท   |   มูลค่าสุทธิรวม ${formatBaht(totals.net)} บาท   |   คำนวณค่าเสื่อม ณ วันที่ ${data.printed_date ? formatThaiDate(data.printed_date) : "-"}`,
            )}
          </Text>
        </View>

        <View style={[styles.table, { marginTop: 6 }]}>
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
              <TextCell text={row.name} pct={12} />
              <TextCell text={row.categoryName ?? "-"} pct={9} />
              <TextCell text={row.assetCode ?? "ยังไม่ติดป้าย"} pct={9} />
              <Text style={[styles.cell, styles.colQty]}>{guard(row.quantity)}</Text>
              <TextCell text={row.unit ?? "-"} pct={5} align="center" />
              <TextCell text={row.location} pct={10} />
              <TextCell text={row.condition} pct={6} align="center" />
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
