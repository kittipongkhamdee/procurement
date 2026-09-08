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

// ขนาดตัวอักษร/QR/ความกว้างบรรทัดปรับได้ต่อบริบท (ค่าเริ่มต้นสำหรับพิมพ์ทีละใบขนาดเต็ม 80x50mm) —
// พิมพ์รวมหลายใบในหน้า A4 ใช้ป้ายที่แคบกว่า จึงต้องตัดคำที่ความกว้างบรรทัดแคบลงตามไปด้วย ไม่งั้นคำ
// ยาวจะไม่ขึ้นบรรทัดใหม่จนล้นออกนอกป้าย (ข้อความไทยไม่มีช่องว่างคั่นคำที่ระบบตัดบรรทัดอัตโนมัติของ
// react-pdf จะใช้ตัดได้ ต้องตัดคำเองล่วงหน้าด้วย wrapText แบบเดียวกับที่ใช้ใน
// asset-register-document.tsx) — charsPerLine แยกต่อฟิลด์เพราะแต่ละฟิลด์ font size และความกว้างที่
// ใช้ได้ไม่เท่ากัน (รหัสครุภัณฑ์กว้างเต็มป้าย ส่วนชื่อ/สถานที่แคบกว่าเพราะอยู่ข้าง QR)
export type TagLabelSizes = {
  qrSize: number;
  codeFontSize: number;
  nameFontSize: number;
  locationFontSize: number;
  codeCharsPerLine: number;
  nameCharsPerLine: number;
  locationCharsPerLine: number;
};

const DEFAULT_SIZES: TagLabelSizes = {
  qrSize: 80,
  codeFontSize: 14,
  nameFontSize: 10,
  locationFontSize: 8,
  codeCharsPerLine: 28,
  nameCharsPerLine: 16,
  locationCharsPerLine: 20,
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

const MAX_LINES = 2;

// เหมือน wrapFull แต่จำกัดจำนวนบรรทัดสูงสุด ตัดทิ้งด้วย "…" ถ้ายาวเกิน — ใช้กับชื่อ/สถานที่ครุภัณฑ์
// ที่ไม่จำเป็นต้องแสดงเต็มเป๊ะเท่ารหัสครุภัณฑ์ (กันป้ายสูงเกินไปเวลาชื่อยาวผิดปกติ)
function wrapTruncated(value: string, charsPerLine: number): string[] {
  const result = wrapFull(value, charsPerLine);
  if (result.length <= MAX_LINES) return result;
  const kept = result.slice(0, MAX_LINES);
  kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1].slice(0, charsPerLine - 1)}…`;
  return kept;
}

// เนื้อหาป้าย 1 ใบ — รหัสครุภัณฑ์เป็นแถวเต็มความกว้างป้ายด้านบนสุด (อ่านง่ายที่สุด แสดงเต็มเสมอ
// ไม่ตัดทิ้ง) ตามด้วยแถว QR + ชื่อครุภัณฑ์/สถานที่ด้านล่าง — แยกออกมาเป็นคอมโพเนนต์ใช้ร่วมกันได้ทั้ง
// พิมพ์ทีละใบ (AssetTagDocument ด้านล่าง) และพิมพ์หลายใบเรียงในหน้า A4
// (asset-tag-sheet-document.tsx) โดยส่ง sizes ที่ย่อส่วนแล้วเข้ามาแทน
export function TagLabelContent({ data, sizes = DEFAULT_SIZES }: { data: AssetTagPdfData; sizes?: TagLabelSizes }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={{ width: "100%" }}>
      {/* เริ่มจากขอบบนสุดของป้าย (แนวเดียวกับด้านบนของ QR ที่อยู่แถวถัดไป) ยาวเต็มความกว้างป้าย */}
      <View style={{ marginBottom: 2 }}>
        {wrapFull(data.asset_code || "-", sizes.codeCharsPerLine).map((line, i) => (
          <Text key={i} style={{ fontSize: sizes.codeFontSize, fontWeight: "bold", lineHeight: 1.1 }}>
            {guard(line)}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
        <Image src={data.qr_url} style={{ width: sizes.qrSize, height: sizes.qrSize, marginRight: 8 }} />
        <View style={{ flex: 1, overflow: "hidden" }}>
          <View style={{ marginBottom: 3 }}>
            {wrapTruncated(data.name, sizes.nameCharsPerLine).map((line, i) => (
              <Text key={i} style={{ fontSize: sizes.nameFontSize, lineHeight: 1.15 }}>
                {guard(line)}
              </Text>
            ))}
          </View>
          <View>
            {wrapTruncated(location || "-", sizes.locationCharsPerLine).map((line, i) => (
              <Text key={i} style={{ fontSize: sizes.locationFontSize, color: "#64748b", lineHeight: 1.15 }}>
                {guard(line)}
              </Text>
            ))}
          </View>
        </View>
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
