import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

// ขนาดป้ายสติกเกอร์ 80mm x 50mm (แนวนอน) แปลงเป็นหน่วย pt ของ react-pdf (1mm ≈ 2.8346pt) —
// ขนาดมาตรฐานทั่วไปของสติกเกอร์ติดครุภัณฑ์ ปรับตามขนาดสติกเกอร์จริงที่โรงเรียนใช้ได้ภายหลัง
const TAG_WIDTH = 227; // 80mm
const TAG_HEIGHT = 142; // 50mm

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 9,
    padding: 10,
    color: "#111827",
    flexDirection: "row",
    alignItems: "center",
  },
  qr: { width: 100, height: 100, marginRight: 8 },
  info: { flex: 1, justifyContent: "center" },
  schoolName: { fontSize: 9, marginBottom: 4 },
  name: { fontSize: 11, fontWeight: "bold", marginBottom: 3 },
  code: { fontSize: 10, marginBottom: 3 },
  location: { fontSize: 9 },
});

function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

export type AssetTagPdfData = {
  school_name: string;
  name: string;
  asset_code: string | null;
  building: string;
  floor: string | null;
  room: string;
  qr_url: string;
};

export function AssetTagDocument({ data }: { data: AssetTagPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <Document>
      <Page size={[TAG_WIDTH, TAG_HEIGHT]} style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
        <Image src={data.qr_url} style={styles.qr} />
        <View style={styles.info}>
          <Text style={styles.schoolName}>{guard(data.school_name)}</Text>
          <Text style={styles.name}>{guard(data.name)}</Text>
          <Text style={styles.code}>{guard(data.asset_code || "-")}</Text>
          <Text style={styles.location}>{guard(location || "-")}</Text>
        </View>
      </Page>
    </Document>
  );
}
