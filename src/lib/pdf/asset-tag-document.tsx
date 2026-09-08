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

// ขนาดตัวอักษร/QR/ความกว้างบรรทัดปรับได้ต่อบริบท (ค่าเริ่มต้นสำหรับพิมพ์ทีละใบขนาดเต็ม 80x50mm) —
// พิมพ์รวมหลายใบในหน้า A4 ใช้ป้ายที่แคบกว่า จึงต้องตัดคำที่ความกว้างบรรทัดแคบลงตามไปด้วย ไม่งั้นคำ
// ยาวจะไม่ขึ้นบรรทัดใหม่จนล้นออกนอกป้าย (ข้อความไทยไม่มีช่องว่างคั่นคำที่ระบบตัดบรรทัดอัตโนมัติของ
// react-pdf จะใช้ตัดได้ ต้องตัดคำเองล่วงหน้าด้วย wrapText แบบเดียวกับที่ใช้ใน
// asset-register-document.tsx) — charsPerLine แยกต่อฟิลด์เพราะแต่ละฟิลด์ใช้ fontSize ไม่เท่ากัน
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
  qrSize: 90,
  codeFontSize: 13,
  nameFontSize: 10,
  locationFontSize: 8,
  codeCharsPerLine: 15,
  nameCharsPerLine: 18,
  locationCharsPerLine: 22,
};

// ตัดข้อความยาวให้ขึ้นบรรทัดใหม่ล่วงหน้าเสมอ ไม่ตัดทิ้งด้วย "…" — เห็นข้อความครบทุกตัวอักษรจริงๆ
// wrapText ตัดตามช่องว่างระหว่างคำเป็นหลัก แต่ชื่อครุภัณฑ์บางชื่อไม่มีช่องว่างเลย (เช่น
// "คอมพิวเตอร์โน้ตบุค-lenovo") ทำให้กลายเป็น "คำ" เดียวยาวเกิน charsPerLine ที่ wrapText ตัดไม่ได้ —
// จึงบังคับตัดตามจำนวนตัวอักษรต่อให้กับคำแบบนั้นอีกชั้น กันไม่ให้บรรทัดเดียวยาวจนล้นป้าย
function lines(value: string, charsPerLine: number): string[] {
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
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
      <Image src={data.qr_url} style={{ width: sizes.qrSize, height: sizes.qrSize, marginRight: 8 }} />
      <View style={{ flex: 1, justifyContent: "center" }}>
        {/* เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สิน
            เดิม) จึงเน้นให้ใหญ่/หนาที่สุดในป้าย ส่วนชื่อครุภัณฑ์/สถานที่เป็นข้อมูลรองลงมา */}
        <View style={{ marginBottom: 3 }}>
          {lines(data.asset_code || "-", sizes.codeCharsPerLine).map((line, i) => (
            <Text key={i} style={{ fontSize: sizes.codeFontSize, fontWeight: "bold", lineHeight: 1.15 }}>
              {guard(line)}
            </Text>
          ))}
        </View>
        <View style={{ marginBottom: 3 }}>
          {lines(data.name, sizes.nameCharsPerLine).map((line, i) => (
            <Text key={i} style={{ fontSize: sizes.nameFontSize, lineHeight: 1.15 }}>
              {guard(line)}
            </Text>
          ))}
        </View>
        <View>
          {lines(location || "-", sizes.locationCharsPerLine).map((line, i) => (
            <Text key={i} style={{ fontSize: sizes.locationFontSize, color: "#64748b", lineHeight: 1.15 }}>
              {guard(line)}
            </Text>
          ))}
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
