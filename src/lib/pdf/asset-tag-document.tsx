import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

// ขนาดป้ายสติกเกอร์ 80mm x 50mm (แนวนอน) แปลงเป็นหน่วย pt ของ react-pdf (1mm ≈ 2.8346pt) —
// ขนาดมาตรฐานทั่วไปของสติกเกอร์ติดครุภัณฑ์ ปรับตามขนาดสติกเกอร์จริงที่โรงเรียนใช้ได้ภายหลัง
// export ไว้ให้ asset-tag-sheet-document.tsx (พิมพ์หลายป้ายเรียงในหน้า A4) ใช้ขนาดเดียวกัน
export const TAG_WIDTH = 227; // 80mm
export const TAG_HEIGHT = 142; // 50mm

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 9,
    padding: 10,
    color: "#111827",
    flexDirection: "row",
    alignItems: "center",
  },
  content: { flexDirection: "row", alignItems: "center", width: "100%", height: "100%" },
  qr: { width: 100, height: 100, marginRight: 8 },
  info: { flex: 1, justifyContent: "center" },
  // เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สินเดิม)
  // จึงเน้นให้ใหญ่/หนาที่สุดในป้าย ส่วนชื่อโรงเรียน/ชื่อครุภัณฑ์/สถานที่เป็นข้อมูลรองลงมา
  schoolName: { fontSize: 7, color: "#64748b", marginBottom: 2 },
  code: { fontSize: 17, fontWeight: "bold", marginBottom: 3 },
  name: { fontSize: 10, marginBottom: 3 },
  location: { fontSize: 8, color: "#64748b" },
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

// เนื้อหาป้าย 1 ใบ (QR + รายละเอียด) — แยกออกมาเป็นคอมโพเนนต์ใช้ร่วมกันได้ทั้งพิมพ์ทีละใบ
// (AssetTagDocument ด้านล่าง) และพิมพ์หลายใบเรียงในหน้า A4 (asset-tag-sheet-document.tsx)
export function TagLabelContent({ data }: { data: AssetTagPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={styles.content}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
      <Image src={data.qr_url} style={styles.qr} />
      <View style={styles.info}>
        <Text style={styles.schoolName}>{guard(data.school_name)}</Text>
        <Text style={styles.code}>{guard(data.asset_code || "-")}</Text>
        <Text style={styles.name}>{guard(data.name)}</Text>
        <Text style={styles.location}>{guard(location || "-")}</Text>
      </View>
    </View>
  );
}

export function AssetTagDocument({ data }: { data: AssetTagPdfData }) {
  return (
    <Document>
      <Page size={[TAG_WIDTH, TAG_HEIGHT]} style={styles.page}>
        <TagLabelContent data={data} />
      </Page>
    </Document>
  );
}
