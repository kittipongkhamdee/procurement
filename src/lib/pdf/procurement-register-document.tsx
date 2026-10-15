import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate } from "@/lib/thai";
import { shortThaiDate } from "@/lib/procurement-register";
import type { ProcurementRegisterRow } from "@/lib/procurement-register";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// ทะเบียนคุมจัดซื้อจัดจ้าง (A4 แนวนอน) — TH Sarabun New 16pt หัวเรื่อง 20pt แบบเดียวกับทะเบียนสัญญา

registerThSarabunFont();
const FS = 16;

const styles = StyleSheet.create({
  page: { fontFamily: "THSarabunNew", fontSize: FS, padding: 28, lineHeight: 1.15 },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", lineHeight: 1.3, marginBottom: 2 },
  sub: { textAlign: "center", lineHeight: 1.3, marginBottom: 10 },
  table: { borderTopWidth: 0.8, borderLeftWidth: 0.8, marginBottom: 4 },
  row: { flexDirection: "row" },
  cell: { borderRightWidth: 0.8, borderBottomWidth: 0.8, paddingHorizontal: 4, paddingVertical: 2 },
  head: { fontWeight: "bold", backgroundColor: "#f1f5f9", textAlign: "center" },
});

// คำที่ห้ามตัดกลางคำในช่องแคบ
const KEEP = ["ประเภท", "เฉพาะ", "เจาะจง", "รายงาน", "ขอซื้อ", "ขอจ้าง", "สั่งซื้อ", "สั่งจ้าง", "ตรวจรับ", "เบิกจ่าย", "แล้ว", "ที่จ่าย"];

// คอลัมน์ตามแบบทะเบียนคุมการจัดซื้อจัดจ้างที่ผู้ใช้ให้มา (A4 แนวนอน กว้างใช้งานได้ ~786pt)
const COLS = [
  { key: "no", label: "ที่", width: 26, align: "center" as const },
  { key: "date", label: "วันที่", width: 58, align: "center" as const },
  { key: "docNo", label: "เลขที่", width: 58, align: "center" as const },
  { key: "item", label: "รายการซื้อ / จ้าง", width: 122, wrap: true },
  { key: "type", label: "ประเภท", width: 46, align: "center" as const },
  { key: "method", label: "วิธี", width: 62, align: "center" as const, wrap: true },
  { key: "vendor", label: "ผู้ขาย / ผู้รับจ้าง", width: 104, wrap: true },
  { key: "amount", label: "จำนวนเงิน", width: 68, align: "right" as const },
  { key: "wht", label: "หัก ณ\nที่จ่าย", width: 54, align: "right" as const },
  { key: "net", label: "จ่ายสุทธิ", width: 68, align: "right" as const },
  { key: "inspected", label: "วัน\nตรวจรับ", width: 56, align: "center" as const, wrap: true },
  { key: "status", label: "สถานะ", width: 64, align: "center" as const, wrap: true },
];

export function ProcurementRegisterDocument({
  rows,
  schoolName,
  educationArea,
  year,
}: {
  rows: ProcurementRegisterRow[];
  schoolName: string;
  educationArea: string | null;
  year: number | null;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  // ข้อความที่มี "\n" = กำหนดจุดขึ้นบรรทัดเอง (คำสั้นในช่องแคบ ตัวตัดคำอัตโนมัติจะหักกลางคำ)
  const cellLines = (text: string, width: number) =>
    text.includes("\n") ? text.split("\n") :
    wrapByWidth(text, FS, width - 10, width - 10, false, "THSarabunNew", [...KEEP, ...text.split(/\s+/).filter((w) => w.length <= 12)]);
  return (
    <Document title="ทะเบียนคุมจัดซื้อจัดจ้าง">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{t("ทะเบียนคุมการจัดซื้อจัดจ้าง")}</Text>
        <Text style={{ textAlign: "center", fontSize: 18, lineHeight: 1.3 }}>{t(`${schoolName}${educationArea ? ` ${educationArea}` : ""}`)}</Text>
        <Text style={styles.sub}>{t(`${year ? `ปีงบประมาณ ${year} · ` : ""}ข้อมูล ณ วันที่ ${formatThaiDate(today)}`)}</Text>
        <View style={styles.table}>
          <View style={styles.row} fixed>
            {COLS.map((c) => (
              <View key={c.key} style={[styles.cell, styles.head, { width: c.width, justifyContent: "center" }]}>
                {cellLines(c.label, c.width).map((l, j) => (
                  <Text key={j} style={{ textAlign: "center" }}>
                    {t(l)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          {rows.map((r, i) => {
            const values: Record<string, string> = {
              no: String(i + 1),
              date: shortThaiDate(r.record_date),
              docNo: `${r.doc_type === "ซื้อ" ? "ซ" : "จ"} ${r.doc_no}`,
              item: r.item_name ?? "-",
              type: r.doc_type,
              method: "เฉพาะ\nเจาะจง",
              vendor: r.vendor_name ?? "-",
              amount: formatBaht(r.amount),
              wht: r.withholding > 0 ? formatBaht(r.withholding) : "—",
              net: formatBaht(r.net),
              inspected: r.inspected_date ? shortThaiDate(r.inspected_date) : "—",
              status: r.status.replace(/(แล้ว)$/, "\n$1").replace(/^(รายงาน)/, "$1\n"),
            };
            return (
              <View key={r.id} style={styles.row} wrap={false}>
                {COLS.map((c) =>
                  "wrap" in c ? (
                    <View key={c.key} style={[styles.cell, { width: c.width }]}>
                      {cellLines(values[c.key], c.width).map((l, j) => (
                        <Text key={j} style={{ textAlign: c.align ?? "left" }}>
                          {t(l)}
                        </Text>
                      ))}
                    </View>
                  ) : (
                    <Text key={c.key} style={[styles.cell, { width: c.width, textAlign: c.align ?? "left" }]}>
                      {t(values[c.key])}
                    </Text>
                  ),
                )}
              </View>
            );
          })}
          {rows.length === 0 && (
            <View style={styles.row}>
              <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ไม่มีรายการ")}</Text>
            </View>
          )}
        </View>
        <Text
          style={{ position: "absolute", bottom: 14, right: 28, fontSize: 12, color: "#64748b" }}
          render={({ pageNumber, totalPages }) => `หน้า ${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
