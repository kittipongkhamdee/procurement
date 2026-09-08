import { Document, Page, View, StyleSheet } from "@react-pdf/renderer";
import { registerSarabunFont } from "./thai-pdf";
import { TAG_WIDTH, TAG_HEIGHT, TagLabelContent, type AssetTagPdfData } from "./asset-tag-document";

registerSarabunFont();

const CELL_MARGIN = 4;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
  },
  // กรอบเส้นประรอบป้ายแต่ละใบช่วยตัดกระดาษ/แบ่งขอบเวลาพิมพ์ลงกระดาษ A4 ธรรมดา (ไม่ใช่สติกเกอร์
  // แบบมีรอยตัดสำเร็จรูป) — ป้ายแต่ละใบขนาดเท่ากับ AssetTagDocument (TAG_WIDTH x TAG_HEIGHT) ทุก
  // ประการ เพื่อให้ตัดออกมาแล้วขนาดตรงกับพิมพ์ทีละใบ
  cell: {
    width: TAG_WIDTH,
    height: TAG_HEIGHT,
    margin: CELL_MARGIN,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    padding: 10,
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
            <TagLabelContent data={data} />
          </View>
        ))}
      </Page>
    </Document>
  );
}
