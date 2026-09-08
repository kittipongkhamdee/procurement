import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { registerSarabunFont } from "./thai-pdf";
import { TagLabelContent, type AssetTagPdfData, type TagLabelSizes } from "./asset-tag-document";

registerSarabunFont();

// เต็มพอดี 3 คอลัมน์ (33.3333% ต่อคอลัมน์) แทนความกว้างคงที่เป็น pt — ไม่มีช่องว่าง/margin ระหว่าง
// ป้าย เส้นขอบของแต่ละป้ายจึงชนกันพอดีเป็นเส้นตัดต่อเนื่อง และไม่มีที่ว่างเหลือทิ้งที่ขอบหน้ากระดาษ
const SHEET_LABEL_SIZES: TagLabelSizes = {
  qrSize: 42,
  codeFontSize: 10,
  nameFontSize: 7,
  locationFontSize: 6.5,
  // เผื่อกันชนไว้มาก (ดูเหตุผลเต็มที่ TagLabelSizes.codeCharsPerLine ใน asset-tag-document.tsx) —
  // คอลัมน์แคบกว่าพิมพ์ทีละใบมาก ยิ่งต้องเผื่อเยอะเป็นพิเศษไม่ให้บรรทัดที่ตัดมากว้างเกินกล่อง
  codeCharsPerLine: 12,
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  // ไม่กำหนดความสูงตายตัว (auto ตามเนื้อหาจริง) เพื่อให้เส้นขอบบน/ล่างชิดกับข้อมูลพอดี ไม่เหลือที่ว่าง
  // เกินจำเป็น — overflow: hidden กันข้อความที่ยาวเกินคาดจริงๆ ล้นทับป้ายข้างเคียง (หายากมาก เพราะ
  // ชื่อ/สถานที่ถูกจำกัดจำนวนบรรทัดไว้แล้วใน TagLabelContent ส่วนรหัสครุภัณฑ์แสดงเต็มเสมอตามที่ขอ)
  cell: {
    width: "33.3333%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    padding: 6,
    overflow: "hidden",
  },
});

// react-pdf จะขึ้นหน้าใหม่ให้อัตโนมัติเมื่อกริดป้าย (flexWrap) ล้นพื้นที่หน้า A4 หน้าแรก เหมือนกับ
// ตารางค่าเสื่อม/ประวัติซ่อมใน asset-register-document.tsx — ไม่ต้องคำนวณแบ่งหน้าเอง
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
