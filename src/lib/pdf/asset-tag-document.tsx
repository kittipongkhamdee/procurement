import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

// ขนาดป้ายสติกเกอร์ 80mm x 50mm (แนวนอน) แปลงเป็นหน่วย pt ของ react-pdf (1mm ≈ 2.8346pt) —
// ขนาดมาตรฐานทั่วไปของสติกเกอร์ติดครุภัณฑ์ ใช้ตอนพิมพ์ทีละใบเท่านั้น — พิมพ์รวมหลายใบใน A4
// (asset-tag-sheet-document.tsx) ใช้ขนาดย่อส่วนแยกต่างหาก เพื่อให้เรียงได้ 3 คอลัมน์ต่อหน้า
export const TAG_WIDTH = 227; // 80mm
export const TAG_HEIGHT = 142; // 50mm

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 10,
    color: "#111827",
    flexDirection: "row",
    alignItems: "center",
  },
});

function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

// บังคับบรรทัดเดียวเสมอ — ป้ายสูงคงที่ รับข้อความหลายบรรทัดไม่ได้ ตัดข้อความยาวด้วย "…" ก่อนส่ง
// เข้า guard() แทนที่จะปล่อยให้ react-pdf ตัดบรรทัดอัตโนมัติเอง (ดู overflow: "hidden" ด้านล่างที่กัน
// ไว้เป็นด่านสุดท้ายอีกชั้น)
function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

export type AssetTagPdfData = {
  name: string;
  asset_code: string | null;
  building: string;
  floor: string | null;
  room: string;
  qr_url: string;
};

// ขนาดตัวอักษร/QR ปรับได้ต่อบริบท (ค่าเริ่มต้นสำหรับพิมพ์ทีละใบขนาดเต็ม 80x50mm) — พิมพ์รวมหลายใบ
// ในหน้า A4 ใช้ป้ายที่เล็กกว่า จึงต้องย่อทุกอย่างลงตามสัดส่วน ไม่ใช่แค่ย่อกรอบแล้วปล่อยให้ล้น
export type TagLabelSizes = {
  qrSize: number;
  codeFontSize: number;
  nameFontSize: number;
  locationFontSize: number;
};

const DEFAULT_SIZES: TagLabelSizes = { qrSize: 90, codeFontSize: 16, nameFontSize: 10, locationFontSize: 8 };

// เนื้อหาป้าย 1 ใบ (QR + รหัสครุภัณฑ์/ชื่อครุภัณฑ์/สถานที่) — แยกออกมาเป็นคอมโพเนนต์ใช้ร่วมกันได้
// ทั้งพิมพ์ทีละใบ (AssetTagDocument ด้านล่าง) และพิมพ์หลายใบเรียงในหน้า A4
// (asset-tag-sheet-document.tsx) โดยส่ง sizes ที่ย่อส่วนแล้วเข้ามาแทน
export function TagLabelContent({ data, sizes = DEFAULT_SIZES }: { data: AssetTagPdfData; sizes?: TagLabelSizes }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", width: "100%", height: "100%", overflow: "hidden" }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
      <Image src={data.qr_url} style={{ width: sizes.qrSize, height: sizes.qrSize, marginRight: 8 }} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        {/* เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สิน
            เดิม) จึงเน้นให้ใหญ่/หนาที่สุดในป้าย ส่วนชื่อครุภัณฑ์/สถานที่เป็นข้อมูลรองลงมา */}
        <Text style={{ fontSize: sizes.codeFontSize, fontWeight: "bold", marginBottom: 3 }}>
          {guard(truncate(data.asset_code || "-", 16))}
        </Text>
        <Text style={{ fontSize: sizes.nameFontSize, marginBottom: 3 }}>{guard(truncate(data.name, 20))}</Text>
        <Text style={{ fontSize: sizes.locationFontSize, color: "#64748b" }}>{guard(truncate(location || "-", 24))}</Text>
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
