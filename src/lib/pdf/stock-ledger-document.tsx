import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatBaht } from "@/lib/thai";
import { shortThaiDate } from "@/lib/procurement-register";
import { ledgerRows, type StockMove } from "@/lib/stock";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// บัญชีวัสดุ (A4 แนวนอน) — แบบผสม: หัวบัญชี/คอลัมน์ตามแบบบัญชีวัสดุมาตรฐาน (KruNotAlone) + ราคารวม (มูลค่าคงเหลือ)
// และแถวรวมทั้งสิ้นแบบ EGPEASY — 1 วัสดุ = 1 บัญชี (ขึ้นหน้าใหม่ทุกวัสดุ) ราคาจ่ายตัดตามล็อต FIFO
// TH Sarabun New 16pt (ตาราง 15pt)

registerThSarabunFont();
const FAMILY = "THSarabunNew";
const FS_TABLE = 15;
const PAD = 28;
const B = 0.8;

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 16, lineHeight: 1.15, padding: PAD },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  label: { fontWeight: "bold" },
  table: { borderTopWidth: B, borderLeftWidth: B, fontSize: FS_TABLE, marginTop: 6 },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 },
  head: { fontWeight: "bold", textAlign: "center", backgroundColor: "#f1f5f9" },
});

const COLS = [
  { key: "date", label: "วัน เดือน ปี", width: 62, align: "center" as const },
  { key: "party", label: "รับจาก / จ่ายให้", width: 172 },
  { key: "doc", label: "เลขที่เอกสาร", width: 84, align: "center" as const },
  { key: "price", label: "ราคาต่อหน่วย", width: 62, align: "right" as const },
  { key: "in", label: "รับ", width: 50, align: "center" as const, group: true },
  { key: "out", label: "จ่าย", width: 50, align: "center" as const, group: true },
  { key: "bal", label: "คงเหลือ", width: 52, align: "center" as const, group: true },
  { key: "value", label: "ราคารวม", width: 74, align: "right" as const },
  { key: "note", label: "หมายเหตุ", width: 785 - 62 - 172 - 84 - 62 - 50 - 50 - 52 - 74 },
];

export type StockLedgerItem = {
  code: string | null;
  category: string;
  name: string;
  size_desc: string | null;
  unit: string;
  location: string | null;
  max_qty: number | null;
  min_qty: number | null;
  moves: StockMove[];
};

const qty = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

function Field({ label, value, width }: { label: string; value: string | number | null | undefined; width?: number | string }) {
  return (
    <View style={{ flexDirection: "row", width }}>
      <Text style={styles.label}>{t(`${label} `)}</Text>
      <Text style={{ flex: 1, borderBottomWidth: 0.5, borderBottomStyle: "dotted" }}>{t(value == null || value === "" ? " " : String(value))}</Text>
    </View>
  );
}

function LedgerPage({ item, agency, unitName }: { item: StockLedgerItem; agency: string; unitName: string }) {
  const rows = ledgerRows(item.moves);
  const totalIn = rows.filter((r) => r.move.kind === "in").reduce((s, r) => s + Number(r.move.qty), 0);
  const totalOut = rows.filter((r) => r.move.kind === "out").reduce((s, r) => s + Number(r.move.qty), 0);
  const last = rows[rows.length - 1];
  const lines = (text: string, width: number) => wrapByWidth(text, FS_TABLE, width - 8, width - 8, false, FAMILY);
  const groupW = COLS.filter((c) => "group" in c).reduce((s, c) => s + c.width, 0);
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>{t("บัญชีวัสดุ")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ width: 120 }}>{t("แผ่นที่ 1")}</Text>
        <View style={{ width: 380 }}>
          <Field label="ส่วนราชการ" value={agency} />
          <Field label="หน่วยงาน" value={unitName} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Field label="ประเภท" value={item.category} width={210} />
        <Field label="ชื่อหรือชนิดวัสดุ" value={item.name} width={400} />
        <Field label="รหัส" value={item.code} width={155} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field label="ขนาดหรือลักษณะ" value={item.size_desc} width={610} />
        <Field label="จำนวนอย่างสูง" value={item.max_qty} width={155} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Field label="หน่วยนับ" value={item.unit} width={210} />
        <Field label="ที่เก็บ" value={item.location} width={400} />
        <Field label="จำนวนอย่างต่ำ" value={item.min_qty} width={155} />
      </View>

      <View style={styles.table}>
        <View style={{ flexDirection: "row" }} fixed>
          {COLS.map((c, i) => {
            if ("group" in c) {
              if ("group" in COLS[i - 1]) return null;
              return (
                <View key="g" style={{ width: groupW }}>
                  <Text style={[styles.cell, styles.head]}>{t("จำนวน")}</Text>
                  <View style={{ flexDirection: "row" }}>
                    {COLS.filter((x) => "group" in x).map((g) => (
                      <Text key={g.key} style={[styles.cell, styles.head, { width: g.width }]}>
                        {t(g.label)}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            }
            return (
              <View key={c.key} style={[styles.cell, styles.head, { width: c.width, justifyContent: "center" }]}>
                <Text>{t(c.key === "value" ? "ราคารวม (คงเหลือ)" : c.label)}</Text>
              </View>
            );
          })}
        </View>
        {rows.map(({ move: m, balance, value }) => {
          const party = m.party === "ยอดยกมา" ? "ยอดยกมา" : `${m.kind === "in" ? "รับจาก" : "จ่ายให้"} ${m.party ?? "-"}`;
          const v: Record<string, string> = {
            date: shortThaiDate(m.move_date),
            party,
            doc: m.doc_no ?? "",
            price: formatBaht(Number(m.unit_price)),
            in: m.kind === "in" ? qty(Number(m.qty)) : "",
            out: m.kind === "out" ? qty(Number(m.qty)) : "",
            bal: qty(balance),
            value: formatBaht(value),
            note: m.note ?? "",
          };
          return (
            <View key={m.id} style={{ flexDirection: "row" }} wrap={false}>
              {COLS.map((c) =>
                c.key === "party" || c.key === "note" || c.key === "doc" ? (
                  <View key={c.key} style={[styles.cell, { width: c.width }]}>
                    {lines(v[c.key], c.width).map((l, j) => (
                      <Text key={j} style={{ textAlign: c.align ?? "left" }}>
                        {t(l)}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <Text key={c.key} style={[styles.cell, { width: c.width, textAlign: c.align ?? "left" }]}>
                    {t(v[c.key])}
                  </Text>
                ),
              )}
            </View>
          );
        })}
        {rows.length === 0 && (
          <View style={{ flexDirection: "row" }}>
            <Text style={[styles.cell, { flex: 1, textAlign: "center" }]}>{t("ยังไม่มีรายการรับ-จ่าย")}</Text>
          </View>
        )}
        <View style={{ flexDirection: "row" }} wrap={false}>
          <Text style={[styles.cell, styles.label, { width: 62 + 172 + 84 + 62, textAlign: "center" }]}>{t("รวมทั้งสิ้น")}</Text>
          <Text style={[styles.cell, styles.label, { width: 50, textAlign: "center" }]}>{t(qty(totalIn))}</Text>
          <Text style={[styles.cell, styles.label, { width: 50, textAlign: "center" }]}>{t(qty(totalOut))}</Text>
          <Text style={[styles.cell, styles.label, { width: 52, textAlign: "center" }]}>{t(qty(last?.balance ?? 0))}</Text>
          <Text style={[styles.cell, styles.label, { width: 74, textAlign: "right" }]}>{t(formatBaht(last?.value ?? 0))}</Text>
          <Text style={[styles.cell, { width: COLS[8].width }]}>{t(" ")}</Text>
        </View>
      </View>
    </Page>
  );
}

export function StockLedgerDocument({ items, agency, unitName }: { items: StockLedgerItem[]; agency: string; unitName: string }) {
  return (
    <Document title="บัญชีวัสดุ">
      {items.map((it, i) => (
        <LedgerPage key={i} item={it} agency={agency} unitName={unitName} />
      ))}
    </Document>
  );
}
