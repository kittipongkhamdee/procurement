import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { registerSarabunFont } from "./thai-pdf";
import { TagLabelContent, type AssetTagPdfData, type TagLabelSizes } from "./asset-tag-document";

registerSarabunFont();

// กรอบป้ายในหน้าพิมพ์รวมแคบกว่าป้ายเต็มขนาด (80x50mm) มาก — ตั้งใจให้กระชับ ไม่เหลือที่ว่างเยอะ
// เกินไปหลัง QR + ข้อความ ยังเรียงได้ 3 คอลัมน์ต่อแถวสบายๆ บน A4 (210mm)
const CELL_WIDTH = 150; // ~53mm
// เผื่อสูงพอสำหรับข้อความ 2 บรรทัดต่อฟิลด์ตามปกติ โดยไม่ต้องตัดทิ้งด้วย "…" เลย
const CELL_HEIGHT = 85; // ~30mm
const CELL_MARGIN = 4;
const CELL_PADDING = 8;

// charsPerLine ต่อฟิลด์คำนวณจากความกว้างข้อความที่เหลือ (CELL_WIDTH 150 - padding 16 - qrSize 45 -
// ระยะห่าง QR 6 = ~83pt) หารด้วยความกว้างเฉลี่ยตัวอักษรไทยที่ fontSize ของแต่ละฟิลด์ เผื่อกันชนไว้
const SHEET_LABEL_SIZES: TagLabelSizes = {
  qrSize: 45,
  codeFontSize: 10,
  nameFontSize: 7.5,
  locationFontSize: 6.5,
  codeCharsPerLine: 14,
  nameCharsPerLine: 18,
  locationCharsPerLine: 20,
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  // กรอบเส้นประรอบป้ายแต่ละใบช่วยตัดกระดาษ (พิมพ์ลงกระดาษ A4 ธรรมดา ไม่ใช่สติกเกอร์แบบมีรอยตัด
  // สำเร็จรูป) — overflow: hidden กันข้อความที่ยาวเกินคาดจริงๆ (หายากมากหลังคำนวณ charsPerLine ต่อ
  // ฟิลด์ไว้แล้วด้านบน) ล้นทับป้ายข้างเคียง
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    margin: CELL_MARGIN,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    padding: CELL_PADDING,
    overflow: "hidden",
  },
});

// react-pdf จะขึ้นหน้าใหม่ให้อัตโนมัติเมื่อกริดป้าย (flexWrap) ล้นพื้นที่หน้า A4 หน้าแรก เหมือนกับ
// ตารางค่าเสื่อม/ประวัติซ่อมใน asset-register-document.tsx — ไม่ต้องคำนวณแบ่งหน้าเอง (คำนวณไว้ว่า
// พอดี 3 คอลัมน์ต่อแถวจาก CELL_WIDTH ด้านบนเท่านั้น จำนวนแถวต่อหน้าปล่อยให้ react-pdf จัดการเอง)
export function AssetTagSheetDocument({ items }: { items: AssetTagPdfData[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {items.map((data, i) => (
          <View style={styles.cell} key={i}>
            <TagLabelContent data={data} sizes={SHEET_LABEL_SIZES} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
