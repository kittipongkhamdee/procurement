import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { registerSarabunFont } from "./thai-pdf";
import { TagLabelContent, type AssetTagPdfData, type TagLabelSizes } from "./asset-tag-document";

registerSarabunFont();

// ป้าย 1 ใบขนาดเต็ม (80x50mm, ดู TAG_WIDTH/TAG_HEIGHT ใน asset-tag-document.tsx) กว้างเกินกว่าจะ
// เรียง 3 คอลัมน์บน A4 (210mm) ได้พร้อมกัน — พิมพ์รวมหลายใบจึงย่อขนาดป้ายลงเป็นสัดส่วนเดียวกัน
// (กว้าง:สูง = 8:5 เท่าเดิม) แทน ใช้ได้กับกระดาษ A4 ธรรมดา ไม่ใช่สติกเกอร์สำเร็จรูปที่มีรอยตัด
const CELL_WIDTH = 178; // ~63mm
const CELL_HEIGHT = 111; // ~39mm (สัดส่วน 8:5 เท่าป้ายเต็มขนาด)
const CELL_MARGIN = 4;
const CELL_PADDING = 8;

const SHEET_LABEL_SIZES: TagLabelSizes = { qrSize: 55, codeFontSize: 11, nameFontSize: 7.5, locationFontSize: 6.5 };

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  // กรอบเส้นประรอบป้ายแต่ละใบช่วยตัดกระดาษ (พิมพ์ลงกระดาษ A4 ธรรมดา ไม่ใช่สติกเกอร์แบบมีรอยตัด
  // สำเร็จรูป) — overflow: hidden กันข้อความที่ยาวเกินคาด (แม้ตัดคำมาให้แล้วใน TagLabelContent)
  // ล้นทับป้ายข้างเคียง
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
