import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { formatBaht, formatThaiDate, thaiBahtText } from "@/lib/thai";

Font.register({
  family: "Sarabun",
  fonts: [
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Thai (and other complex scripts) have no space-delimited "words" for react-pdf's
// default hyphenation engine to break on — that mismeasures glyph advance widths and
// clips trailing characters on long lines instead of wrapping. Disabling it fixes that.
Font.registerHyphenationCallback((word) => [word]);

/**
 * @react-pdf/renderer (fontkit + yoga) reproducibly undercounts the measured width of a
 * Text node that ends exactly on a non-space glyph, silently clipping the last character —
 * worst with Thai since it has no inter-word spaces to give the measurement rounding any
 * slack. A trailing space on the string itself is the verified workaround; pure-ASCII
 * numeric strings (already right/center aligned) aren't affected and skip it to avoid a
 * visible alignment shift.
 */
function t(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `${value} `;
}

/**
 * The trailing-space trick in `t()` only protects the end of a single unwrapped line —
 * @react-pdf/renderer's own auto-wrap for a long paragraph clips the last 1-2 characters
 * of interior wrapped lines too (confirmed: increasing padding just moves the same bug to
 * a new boundary, it never goes away). The reliable fix is to never let it auto-wrap at
 * all: pre-break the text ourselves on word boundaries and render one already-short <Text>
 * per line, each safely single-line like the header rows that never exhibited the bug.
 */
function wrapText(text: string, maxChars = 40): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 11,
    padding: 40,
    color: "#111827",
  },
  center: { textAlign: "center" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: "bold", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { fontWeight: "bold", width: 90 },
  value: { flex: 1, paddingRight: 12 },
  hr: { borderBottomWidth: 1, borderBottomColor: "#111827", marginVertical: 8 },
  // paddingRight leaves slack against a reproducible @react-pdf/renderer bug where a
  // wrapped line's last 1-2 glyphs get clipped instead of wrapped (see `t()` above for
  // the same issue on unwrapped lines) — this keeps text from ever reaching that edge.
  paragraph: { marginBottom: 4, lineHeight: 1.5, paddingRight: 24 },
  table: { marginTop: 8, borderWidth: 1, borderColor: "#111827" },
  tr: { flexDirection: "row" },
  th: {
    fontWeight: "bold",
    fontSize: 10,
    padding: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
    textAlign: "center",
  },
  td: {
    fontSize: 10,
    padding: 4,
    paddingRight: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  colNo: { width: "6%" },
  colName: { width: "40%" },
  colQty: { width: "12%", textAlign: "center" },
  colUnit: { width: "12%", textAlign: "center" },
  colPrice: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right", borderRightWidth: 0 },
  signBlock: { marginTop: 36, alignItems: "center", width: "45%" },
  signLine: { marginBottom: 4 },
});

function Paragraph({ text }: { text: string }) {
  return (
    <>
      {wrapText(text).map((line, i) => (
        <Text key={i} style={styles.paragraph}>
          {t(line)}
        </Text>
      ))}
    </>
  );
}

export type PurchaseRequestPdfData = {
  doc_type: "ซื้อ" | "จ้าง";
  doc_no: string;
  record_date: string;
  delivery_date: string;
  work_days: number | null;
  inspector_name: string | null;
  inspector_position: string | null;
  admin_group: string | null;
  amount: number;
  item_name: string | null;
  reason: string | null;
  detail: string | null;
  supply_officer_name: string | null;
  project_name: string | null;
  activity_name: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  items: { seq: number; name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null }[];
};

export function PurchaseRequestDocument({ data }: { data: PurchaseRequestPdfData }) {
  const isHire = data.doc_type === "จ้าง";
  const grandTotal = data.items.reduce((sum, i) => sum + (i.total ?? 0), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.center}>
          <Text style={styles.title}>{t("บันทึกข้อความ")}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>{t("ส่วนราชการ")}</Text>
          <Text style={styles.value}>{t("โรงเรียนตาเบาวิทยา")}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("ที่")}</Text>
          <Text style={styles.value}>{t(data.doc_no)}</Text>
          <Text style={styles.label}>{t("วันที่")}</Text>
          <Text style={styles.value}>{t(formatThaiDate(data.record_date))}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("เรื่อง")}</Text>
          <Text style={styles.value}>
            {t(`ขอ${isHire ? "จ้าง" : "ซื้อ"} ${data.item_name ?? ""}`)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{t("เรียน")}</Text>
          <Text style={styles.value}>{t("ผู้อำนวยการโรงเรียนตาเบาวิทยา")}</Text>
        </View>

        <View style={styles.hr} />

        <Paragraph
          text={`ด้วยกลุ่มบริหาร${data.admin_group ?? "-"} มีความประสงค์จะขอ${isHire ? "จ้าง" : "ซื้อ"} ${
            data.item_name ?? "-"
          } เพื่อ${data.reason ?? "-"} ตามโครงการ ${data.project_name ?? "-"} กิจกรรม ${
            data.activity_name ?? "-"
          } เป็นจำนวนเงิน ${formatBaht(data.amount)} บาท ${thaiBahtText(data.amount)}`}
        />
        {isHire && data.detail && (
          <Paragraph text={`รายละเอียด: ${data.detail}`} />
        )}
        <Paragraph
          text={`จาก${isHire ? "ผู้รับจ้าง" : "ร้านค้า"}: ${data.vendor_name ?? "-"}${
            data.vendor_phone ? ` โทร. ${data.vendor_phone}` : ""
          }${data.vendor_address ? ` ที่อยู่ ${data.vendor_address}` : ""}`}
        />
        <Paragraph
          text={`กำหนดส่งมอบ/ตรวจรับวันที่ ${formatThaiDate(data.delivery_date)}${
            data.work_days ? ` (${data.work_days} วัน)` : ""
          } โดยมี ${data.inspector_name ?? "-"} ${
            data.inspector_position ?? ""
          } เป็นผู้ตรวจรับพัสดุ/งานจ้าง`}
        />

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colNo]}>{t("ลำดับ")}</Text>
            <Text style={[styles.th, styles.colName]}>{t("ชื่อรายการ")}</Text>
            <Text style={[styles.th, styles.colQty]}>{t("จำนวน")}</Text>
            <Text style={[styles.th, styles.colUnit]}>{t("หน่วยนับ")}</Text>
            <Text style={[styles.th, styles.colPrice]}>{t("ราคา/หน่วย")}</Text>
            <Text style={[styles.th, styles.colTotal, { borderRightWidth: 0 }]}>
              {t("ราคารวม")}
            </Text>
          </View>
          {data.items.map((item) => (
            <View style={styles.tr} key={item.seq}>
              <Text style={[styles.td, styles.colNo, { textAlign: "center" }]}>{item.seq}</Text>
              <Text style={[styles.td, styles.colName]}>{t(item.name)}</Text>
              <Text style={[styles.td, styles.colQty]}>{item.qty ?? ""}</Text>
              <Text style={[styles.td, styles.colUnit]}>{t(item.unit)}</Text>
              <Text style={[styles.td, styles.colPrice]}>
                {item.unit_price != null ? formatBaht(item.unit_price) : ""}
              </Text>
              <Text style={[styles.td, styles.colTotal]}>
                {item.total != null ? formatBaht(item.total) : ""}
              </Text>
            </View>
          ))}
          <View style={styles.tr}>
            <Text
              style={[
                styles.td,
                { width: "85%", textAlign: "right", fontWeight: "bold" },
              ]}
            >
              {t("รวมทั้งหมด")}
            </Text>
            <Text style={[styles.td, styles.colTotal, { fontWeight: "bold" }]}>
              {formatBaht(grandTotal)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>ลงชื่อ...........................................</Text>
            <Text style={styles.signLine}>{t(`(${data.inspector_name ?? "..........................................."})`)}</Text>
            <Text>{t("ผู้ตรวจรับพัสดุ/งานจ้าง")}</Text>
          </View>
          <View style={styles.signBlock}>
            <Text style={styles.signLine}>ลงชื่อ...........................................</Text>
            <Text style={styles.signLine}>{t(`(${data.supply_officer_name ?? "..........................................."})`)}</Text>
            <Text>{t("เจ้าหน้าที่พัสดุ")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
