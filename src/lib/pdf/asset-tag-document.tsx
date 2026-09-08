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
  // overflow: "hidden" กันไว้เป็นด่านสุดท้าย เผื่อข้อความยาวเกินคาดแม้ตัดคำมาให้แล้ว (truncate ด้านล่าง)
  // — ไม่ให้ล้นทับป้ายข้างเคียงตอนพิมพ์รวมหลายใบในหน้า A4 เดียว (asset-tag-sheet-document.tsx)
  content: { flexDirection: "row", alignItems: "center", width: "100%", height: "100%", overflow: "hidden" },
  qr: { width: 85, height: 85, marginRight: 8 },
  info: { flex: 1, justifyContent: "center" },
  // เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สินเดิม)
  // จึงเน้นให้ใหญ่/หนาที่สุดในป้าย ส่วนชื่อโรงเรียน/ชื่อครุภัณฑ์/สถานที่เป็นข้อมูลรองลงมา — ทุกบรรทัด
  // บังคับบรรทัดเดียว (ตัดคำเองล่วงหน้าด้วย truncate ไม่ปล่อยให้ react-pdf ตัดบรรทัดอัตโนมัติ) เพราะ
  // ป้ายสูงคงที่ 50mm ถ้าปล่อยให้ข้อความยาวขึ้นบรรทัดที่ 2 เองจะดันความสูงรวมล้นออกนอกป้าย
  schoolName: { fontSize: 6.5, color: "#64748b", marginBottom: 2 },
  code: { fontSize: 15, fontWeight: "bold", marginBottom: 3 },
  name: { fontSize: 9, marginBottom: 3 },
  location: { fontSize: 7.5, color: "#64748b" },
});

function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

// บังคับบรรทัดเดียวเสมอ — ป้ายสูงคงที่ (50mm) รับข้อความหลายบรรทัดไม่ได้ ตัดข้อความยาวด้วย "…"
// ก่อนส่งเข้า guard() แทนที่จะปล่อยให้ react-pdf ตัดบรรทัดอัตโนมัติเอง (ดู content overflow ด้านบน)
function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
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
        <Text style={styles.schoolName}>{guard(truncate(data.school_name, 22))}</Text>
        <Text style={styles.code}>{guard(truncate(data.asset_code || "-", 16))}</Text>
        <Text style={styles.name}>{guard(truncate(data.name, 20))}</Text>
        <Text style={styles.location}>{guard(truncate(location || "-", 24))}</Text>
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
