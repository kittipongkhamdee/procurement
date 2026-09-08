import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { registerSarabunFont, t, wrapText } from "./thai-pdf";

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

export type AssetTagPdfData = {
  name: string;
  asset_code: string | null;
  building: string;
  floor: string | null;
  room: string;
  qr_url: string;
};

// ขนาด QR/ตัวอักษรปรับได้ต่อบริบท (ค่าเริ่มต้นสำหรับพิมพ์ทีละใบขนาดเต็ม 80x50mm) — พิมพ์รวมหลายใบ
// ในหน้า A4 ใช้ป้ายที่แคบกว่า จึงต้องย่อทุกอย่างลงตามสัดส่วน (asset-tag-sheet-document.tsx)
export type TagLabelSizes = {
  qrSize: number;
  codeFontSize: number;
  nameFontSize: number;
  locationFontSize: number;
  // เฉพาะรหัสครุภัณฑ์เท่านั้นที่ยังตัดคำเองล่วงหน้าด้วย charsPerLine (ดู wrapFull ด้านล่าง) เพราะ
  // ต้องแสดงเต็มทุกตัวอักษรเสมอ — ชื่อ/สถานที่ใช้ maxLines + textOverflow ของ react-pdf เอง (วัด
  // ความกว้างจริงจากฟอนต์ ไม่ใช่กะจำนวนตัวอักษรแบบตายตัว) แม่นกว่าและไม่ตัดก่อนถึงขอบจริงเหมือนที่เจอ
  // ตอนใช้ charsPerLine กะเอง (พื้นที่เหลือแต่ตัดข้อความไปแล้ว)
  codeCharsPerLine: number;
};

const DEFAULT_SIZES: TagLabelSizes = {
  qrSize: 90,
  codeFontSize: 13,
  nameFontSize: 10,
  locationFontSize: 8,
  codeCharsPerLine: 15,
};

// ตัดคำยาวขึ้นบรรทัดใหม่ล่วงหน้าเสมอ ไม่ตัดทิ้ง — ใช้กับรหัสครุภัณฑ์ที่ต้องแสดงเต็มทุกตัวอักษรไม่ว่า
// จะยาวแค่ไหน (wrapText ตัดตามช่องว่างระหว่างคำเป็นหลัก แต่คำเดี่ยวที่ไม่มีช่องว่างเลย เช่น
// "คอมพิวเตอร์โน้ตบุค-lenovo" จะบังคับตัดตามจำนวนตัวอักษรต่อให้อีกชั้น กันบรรทัดเดียวยาวจนล้นป้าย)
function wrapFull(value: string, charsPerLine: number): string[] {
  const wordWrapped = wrapText(value, charsPerLine);
  const result: string[] = [];
  for (const line of wordWrapped) {
    if (line.length <= charsPerLine) {
      result.push(line);
    } else {
      for (let i = 0; i < line.length; i += charsPerLine) result.push(line.slice(i, i + charsPerLine));
    }
  }
  return result;
}

// เนื้อหาป้าย 1 ใบ (QR + รหัสครุภัณฑ์/ชื่อครุภัณฑ์/สถานที่) — แยกออกมาเป็นคอมโพเนนต์ใช้ร่วมกันได้
// ทั้งพิมพ์ทีละใบ (AssetTagDocument ด้านล่าง) และพิมพ์หลายใบเรียงในหน้า A4
// (asset-tag-sheet-document.tsx) โดยส่ง sizes ที่ย่อส่วนแล้วเข้ามาแทน
export function TagLabelContent({ data, sizes = DEFAULT_SIZES }: { data: AssetTagPdfData; sizes?: TagLabelSizes }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
      <Image src={data.qr_url} style={{ width: sizes.qrSize, height: sizes.qrSize, marginRight: 8 }} />
      <View style={{ flex: 1, overflow: "hidden" }}>
        {/* เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สิน
            เดิม) จึงเน้นให้ใหญ่/หนาที่สุดในป้าย และแสดงเต็มทุกตัวอักษรเสมอไม่ตัดทิ้งด้วย "…" */}
        <View style={{ marginBottom: 3 }}>
          {wrapFull(data.asset_code || "-", sizes.codeCharsPerLine).map((line, i) => (
            <Text key={i} style={{ fontSize: sizes.codeFontSize, fontWeight: "bold", lineHeight: 1.15 }}>
              {guard(line)}
            </Text>
          ))}
        </View>
        <Text style={{ fontSize: sizes.nameFontSize, lineHeight: 1.15, marginBottom: 3, maxLines: 2, textOverflow: "ellipsis" }}>
          {guard(data.name)}
        </Text>
        <Text style={{ fontSize: sizes.locationFontSize, lineHeight: 1.15, color: "#64748b", maxLines: 1, textOverflow: "ellipsis" }}>
          {guard(location || "-")}
        </Text>
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
