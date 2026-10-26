import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatThaiDate } from "@/lib/thai";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";
import { SignBody } from "./sign-block";

// ใบเบิกวัสดุ (A4 แนวตั้ง) — แบบตาม EGPEASY 6.2: ข้าพเจ้า…มีความประสงค์ขอเบิกพัสดุ เพื่อ… / ตาราง ขอเบิก-เบิกได้ /
// ลงชื่อ ผู้เบิก · ผู้จ่าย · ผู้รับพัสดุ · ผู้สั่งจ่าย (หัวหน้าเจ้าหน้าที่) — TH Sarabun New 16pt
// ใช้ทั้งเป็นแผ่นสุดท้ายของชุดเอกสารจัดซื้อ และพิมพ์จากเมนูบัญชีวัสดุ (ไฟล์นี้ห้าม import procurement-set-document กันวนลูป)

registerThSarabunFont();
const FAMILY = "THSarabunNew";
const FS = 16;
const CM = 28.3465;
const B = 0.8;
const PAD_L = 2.5 * CM;
const PAD_R = 2 * CM;
const CONTENT_W = 595.28 - PAD_L - PAD_R;

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.2, paddingTop: 2 * CM, paddingBottom: 1.5 * CM, paddingLeft: PAD_L, paddingRight: PAD_R },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 14 },
  cell: { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 },
  head: { fontWeight: "bold", textAlign: "center" },
  bold: { fontWeight: "bold" },
});

export type RequisitionItem = { name: string; unit: string | null; requested: number | null; issued: number | null; note?: string | null };
export type RequisitionData = {
  doc_no: string | null;
  req_date: string | null;
  school_name: string;
  requester_name: string | null;
  requester_position: string | null;
  purpose: string | null;
  items: RequisitionItem[];
  /** ผู้จ่าย (เจ้าหน้าที่พัสดุ) */
  payer_name: string | null;
  /** ผู้สั่งจ่าย (หัวหน้าเจ้าหน้าที่) */
  approver_name: string | null;
};

const qtyText = (n: number | null) => (n == null ? "" : n.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
const COLS = [
  { key: "no", label: "ที่", width: 30 },
  { key: "name", label: "รายการ", width: CONTENT_W - 30 - 70 - 60 - 60 - 80 },
  { key: "unit", label: "หน่วยนับ", width: 70 },
  { key: "req", label: "ขอเบิก", width: 60 },
  { key: "iss", label: "เบิกได้", width: 60 },
  { key: "note", label: "หมายเหตุ", width: 80 },
];

function Sign({ role, name, extra = [], title }: { role: string; name: string | null; extra?: string[]; title?: string }) {
  return (
    <View style={{ width: CONTENT_W / 2, alignItems: "center" }} wrap={false}>
      {title && <Text style={[styles.bold, { marginBottom: 4 }]}>{t(title)}</Text>}
      <SignBody role={role} name={name} extra={extra} size={FS} />
    </View>
  );
}

/** หน้าใบเบิกวัสดุ 1 หน้า — ใส่ใน <Document> อื่นได้ (แผ่นสุดท้ายของชุดจัดซื้อ) */
export function RequisitionPage({ data: d }: { data: RequisitionData }) {
  const dateText = d.req_date ? formatThaiDate(d.req_date) : "วันที่............เดือน...........................พ.ศ.............";
  const nameW = COLS[1].width;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{t("ใบเบิกพัสดุ")}</Text>
      <Text style={{ textAlign: "right" }}>{t(`เลขที่ : ${d.doc_no || "................"}`)}</Text>
      <Text style={{ textAlign: "right" }}>{t(`ส่วนราชการ : ${d.school_name}`)}</Text>
      <Text style={{ textAlign: "right", marginBottom: 8 }}>{t(dateText)}</Text>
      <View style={{ marginBottom: 6 }}>
        {wrapByWidth(
          `ข้าพเจ้า ${d.requester_name ?? "................................"}${d.requester_position ? ` ตำแหน่ง ${d.requester_position}` : ""} มีความประสงค์ขอเบิกพัสดุตามรายการต่อไปนี้${d.purpose ? ` เพื่อ ${d.purpose.replace(/^เพื่อ\s*/, "")}` : ""}`,
          FS,
          CONTENT_W - 2.5 * CM - 6,
          CONTENT_W - 6,
          false,
          FAMILY,
          [d.requester_name ?? "", d.school_name.replace(/^โรงเรียน/, "")].filter(Boolean),
        ).map((l, i) => (
          <Text key={i} style={i === 0 ? { marginLeft: 2.5 * CM } : undefined}>
            {t(l)}
          </Text>
        ))}
      </View>
      <View style={{ borderTopWidth: B, borderLeftWidth: B, marginBottom: 18 }}>
        <View style={{ flexDirection: "row" }} fixed>
          <Text style={[styles.cell, styles.head, { width: COLS[0].width, paddingTop: 10 }]}>{t("ที่")}</Text>
          <Text style={[styles.cell, styles.head, { width: COLS[1].width, paddingTop: 10 }]}>{t("รายการ")}</Text>
          <Text style={[styles.cell, styles.head, { width: COLS[2].width, paddingTop: 10 }]}>{t("หน่วยนับ")}</Text>
          <View style={{ width: COLS[3].width + COLS[4].width }}>
            <Text style={[styles.cell, styles.head]}>{t("จำนวน")}</Text>
            <View style={{ flexDirection: "row" }}>
              <Text style={[styles.cell, styles.head, { width: COLS[3].width }]}>{t("ขอเบิก")}</Text>
              <Text style={[styles.cell, styles.head, { width: COLS[4].width }]}>{t("เบิกได้")}</Text>
            </View>
          </View>
          <Text style={[styles.cell, styles.head, { width: COLS[5].width, paddingTop: 10 }]}>{t("หมายเหตุ")}</Text>
        </View>
        {d.items.map((it, i) => (
          <View key={i} style={{ flexDirection: "row" }} wrap={false}>
            <Text style={[styles.cell, { width: COLS[0].width, textAlign: "center" }]}>{t(String(i + 1))}</Text>
            <View style={[styles.cell, { width: nameW }]}>
              {wrapByWidth(it.name, FS, nameW - 8, nameW - 8, false, FAMILY).map((l, j) => (
                <Text key={j}>{t(l)}</Text>
              ))}
            </View>
            <Text style={[styles.cell, { width: COLS[2].width, textAlign: "center" }]}>{t(it.unit ?? "")}</Text>
            <Text style={[styles.cell, { width: COLS[3].width, textAlign: "center" }]}>{t(qtyText(it.requested))}</Text>
            <Text style={[styles.cell, { width: COLS[4].width, textAlign: "center" }]}>{t(qtyText(it.issued))}</Text>
            <Text style={[styles.cell, { width: COLS[5].width }]}>{t(it.note ?? "")}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginBottom: 18 }} wrap={false}>
        <Sign role="ผู้เบิก" name={d.requester_name} extra={d.requester_position ? [`ตำแหน่ง ${d.requester_position}`] : []} />
        <Sign role="ผู้จ่าย" name={d.payer_name} extra={["ตำแหน่ง เจ้าหน้าที่"]} />
      </View>
      <View style={{ flexDirection: "row" }} wrap={false}>
        <Sign
          title="ข้าพเจ้าได้รับของครบถ้วนถูกต้องแล้ว"
          role="ผู้รับพัสดุ"
          name={d.requester_name}
          extra={[...(d.requester_position ? [`ตำแหน่ง ${d.requester_position}`] : []), dateText]}
        />
        <Sign title="ผู้อนุญาตให้เบิกพัสดุ" role="ผู้สั่งจ่าย" name={d.approver_name} extra={["ตำแหน่ง หัวหน้าเจ้าหน้าที่"]} />
      </View>
    </Page>
  );
}

export function RequisitionDocument({ data }: { data: RequisitionData }) {
  return (
    <Document title={`ใบเบิกพัสดุ ${data.doc_no ?? ""}`}>
      <RequisitionPage data={data} />
    </Document>
  );
}
