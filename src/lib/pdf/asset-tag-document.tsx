import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

// ขนาดป้ายสติกเกอร์ 80mm x 50mm (แนวนอน) แปลงเป็นหน่วย pt ของ react-pdf (1mm ≈ 2.8346pt) —
// ขนาดมาตรฐานทั่วไปของสติกเกอร์ติดครุภัณฑ์ ใช้ตอนพิมพ์ทีละใบเท่านั้น — พิมพ์รวมหลายใบใน A4
// (asset-tag-sheet-document.tsx) ใช้ขนาดย่อส่วนแยกต่างหาก เพื่อให้เรียงได้ 3 คอลัมน์ต่อหน้า
export const TAG_WIDTH = 227; // 80mm
export const TAG_HEIGHT = 142; // 50mm

const TEXT_COLOR = "#111827";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 10,
    color: TEXT_COLOR,
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
  // ความกว้างที่แท้จริงเป็น pt ของคอลัมน์ข้อความ (ความกว้างป้าย/เซลล์ - padding - qrSize - ระยะห่าง)
  // ใช้คำนวณย่อขนาดตัวอักษรรหัสครุภัณฑ์อัตโนมัติให้พอดีบรรทัดเดียวเสมอ (ดู fitCodeFontSize ด้านล่าง)
  textWidth: number;
  codeMaxFontSize: number;
  nameFontSize: number;
  locationFontSize: number;
};

const DEFAULT_SIZES: TagLabelSizes = {
  qrSize: 90,
  textWidth: 109,
  codeMaxFontSize: 9,
  nameFontSize: 7,
  locationFontSize: 6.5,
};

const CODE_MIN_FONT_SIZE = 7;
// ความกว้างเฉลี่ยโดยประมาณของตัวอักษร (ไทย/อังกฤษผสม) ในฟอนต์ Sarabun ตัวหนา เทียบเป็นสัดส่วนของ
// fontSize (em) — ตั้งใจประเมินแบบ "กว้างเกินจริง" ไว้ก่อน (เผื่อกันชน) ดีกว่าประเมินแคบเกินจริงแล้ว
// ข้อความยังล้นบรรทัดจนต้องขึ้นบรรทัดใหม่เอง ซึ่งเป็นจุดที่เจอบั๊กตัวอักษร/คำหายไปกลางข้อความกับ
// Text ตัวหนาที่ต้องขึ้นบรรทัดเอง (ดูปัญหาเดียวกันที่บันทึกไว้ใน asset-register-document.tsx เรื่อง
// fontWeight: "bold" กับคอลัมน์กว้างแบบ %)
const AVG_CHAR_WIDTH_EM = 0.62;

// หารหัสครุภัณฑ์ที่ต้องแสดงบรรทัดเดียวเสมอ (ไม่ตัดทิ้ง ไม่ขึ้นบรรทัดใหม่) — ลดขนาดตัวอักษรลงเรื่อยๆ
// จนกว่าความกว้างโดยประมาณจะพอดีกับคอลัมน์ หยุดที่ CODE_MIN_FONT_SIZE เป็นขั้นต่ำ (โค้ดจริงของระบบ
// นี้มีความยาวจำกัดตามรูปแบบที่กำหนดไว้แล้ว จึงมั่นใจได้ว่าพอดีในช่วงขนาดนี้เสมอ)
function fitCodeFontSize(text: string, maxFontSize: number, textWidth: number): number {
  for (let size = maxFontSize; size > CODE_MIN_FONT_SIZE; size -= 0.5) {
    if (text.length * AVG_CHAR_WIDTH_EM * size <= textWidth) return size;
  }
  return CODE_MIN_FONT_SIZE;
}

// เนื้อหาป้าย 1 ใบ (QR + รหัสครุภัณฑ์/ชื่อครุภัณฑ์/สถานที่) — แยกออกมาเป็นคอมโพเนนต์ใช้ร่วมกันได้
// ทั้งพิมพ์ทีละใบ (AssetTagDocument ด้านล่าง) และพิมพ์หลายใบเรียงในหน้า A4
// (asset-tag-sheet-document.tsx) โดยส่ง sizes ที่ย่อส่วนแล้วเข้ามาแทน
export function TagLabelContent({ data, sizes = DEFAULT_SIZES }: { data: AssetTagPdfData; sizes?: TagLabelSizes }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");
  const code = data.asset_code || "-";
  const codeFontSize = fitCodeFontSize(code, sizes.codeMaxFontSize, sizes.textWidth);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
      <Image src={data.qr_url} style={{ width: sizes.qrSize, height: sizes.qrSize, marginRight: 8 }} />
      <View style={{ flex: 1, overflow: "hidden" }}>
        {/* เลขครุภัณฑ์เป็นข้อมูลที่ต้องอ่านได้ไวที่สุดตอนตรวจนับ (ดูตัวอย่างป้ายจากระบบสำรวจทรัพย์สิน
            เดิม) จึงเน้นให้หนาที่สุดในป้าย แสดงบรรทัดเดียวเสมอ (ย่อขนาดลงถ้าไม่พอ ไม่ตัดทิ้งด้วย "…"
            และไม่ขึ้นบรรทัดใหม่เอง) maxLines กันเป็นด่านสุดท้ายเฉยๆ ไม่ควรถูกใช้งานจริงถ้าคำนวณถูก */}
        <Text style={{ fontSize: codeFontSize, fontWeight: "bold", lineHeight: 1.15, marginBottom: 3, maxLines: 1 }}>
          {guard(code)}
        </Text>
        <Text style={{ fontSize: sizes.nameFontSize, lineHeight: 1.15, marginBottom: 3, maxLines: 2, textOverflow: "ellipsis" }}>
          {guard(data.name)}
        </Text>
        <Text style={{ fontSize: sizes.locationFontSize, lineHeight: 1.15, maxLines: 1, textOverflow: "ellipsis" }}>
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
