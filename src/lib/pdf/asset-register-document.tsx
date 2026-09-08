import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/types";
import { formatBaht } from "@/lib/thai";
import { registerSarabunFont, t } from "./thai-pdf";

registerSarabunFont();

const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 11,
    padding: 16,
    color: "#111827",
  },
  center: { textAlign: "center" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  // รูปครุภัณฑ์ + QR Code วางแบบ position: absolute ที่มุมซ้ายบน ไม่กินพื้นที่ในโฟลว์เอกสาร
  // (ข้อความทั้งหมดจึงอยู่ตำแหน่งเดิมเป๊ะเหมือนตอนไม่มีรูป/QR) — render ก่อนเนื้อหาอื่นในหน้า ทำให้
  // อยู่เลเยอร์ล่างสุด ถ้าสูงกว่าเนื้อหาส่วนหัว ข้อความที่ตามมาจะวาดทับข้างบนได้ตามต้องการ
  // QR อยู่ซ้ายสุด แล้วรูปครุภัณฑ์ต่อทางขวาของ QR (left ของรูปเลื่อนตาม QR_WIDTH + ระยะห่าง)
  qr: { position: "absolute", top: 15, left: 20, width: 55, height: 55, borderWidth: 1, borderColor: "#111827" },
  photo: { position: "absolute", top: 15, left: 83, width: 80, height: 60, borderWidth: 1, borderColor: "#111827", objectFit: "cover" },
  // "ส่วนราชการ"/"หน่วยงาน" อยู่ชิดขวาบนของฟอร์ม (ตามแบบฟอร์มทะเบียนคุมทรัพย์สินมาตรฐาน) แยกจาก
  // ป้าย/ค่าแถวอื่นๆ ที่ชิดซ้ายตามปกติ
  // alignSelf (ไม่ใช่ alignItems) ดันกล่องทั้งกล่องไปชิดขวาสุดของหน้า แต่ปล่อยให้แถวข้างในเรียงชิดซ้าย
  // ตามปกติภายในกล่องเอง ทำให้ขอบซ้ายของทั้ง 2 แถวตรงกัน (ถ้าใช้ alignItems: "flex-end" แทน แต่ละแถว
  // จะถูกดันชิดขวาแยกกันเอง ทำให้ขอบซ้ายเยื้องกันเมื่อความยาวข้อความ/ป้ายไม่เท่ากัน)
  rightAlign: { alignSelf: "flex-end", marginBottom: 4 },
  // ป้าย "ส่วนราชการ"/"หน่วยงาน" ยาวไม่เท่ากัน (5 กับ 4 ตัวอักษร) — กำหนดความกว้างคงที่ให้ป้าย
  // ทั้งสองแถวเพื่อให้ขอบซ้ายของป้าย (และค่าที่ตามมา) เริ่มตรงตำแหน่งเดียวกันทั้งคู่
  rightLabel: { fontWeight: "bold", marginRight: 8, width: 70 },
  row: { flexDirection: "row", marginBottom: 4 },
  // คอลัมน์ตายตัว 3 คอลัมน์ (33.33% เท่ากันทุกแถว) ให้ป้ายชื่อ/ค่าในแต่ละแถวเรียงตรงแนวเดียวกันแนวตั้ง
  // ไม่ว่าแถวนั้นจะมีกี่ช่อง (2 หรือ 3 ช่อง) ก็ยังอยู่ตำแหน่งคอลัมน์เดียวกับแถวอื่นๆ
  groupItem: { width: "33.3333%", flexDirection: "row" },
  label: { fontWeight: "bold", marginRight: 8 },
  value: { flex: 1, paddingRight: 12 },
  // ไม่ใช้ borderWidth (กรอบรอบทุกด้าน) — เส้นขอบล่างของกรอบตารางจะไปทับกับ borderBottomWidth
  // ของแถวข้อมูลแถวสุดท้าย (cell/cellLast ด้านล่าง) ทำให้เส้นล่างสุดหนากว่าเส้นแบ่งแถวอื่นๆ 2 เท่า
  // จึงกำหนดเฉพาะด้านบน/ซ้าย/ขวา ปล่อยให้เส้นล่างสุดมาจากแถวสุดท้ายเส้นเดียวพอ
  table: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#111827" },
  tHeadRow: { flexDirection: "row", backgroundColor: "#f1f5f9" },
  tRow: { flexDirection: "row" },
  // ทดลองย่อขนาดตัวอักษรในตารางลง (11pt เดิม ตามมาตรฐาน CLAUDE.md) เหลือ 10pt — เทียบสัดส่วนจากระบบ
  // สำรวจทรัพย์สินเดิม (financial-asset-survey) ที่ใช้ตาราง 9.5px จากเนื้อหาตัวหลัก 12px (~79%) เป็น
  // จุดเริ่มต้น แล้วปรับขึ้นตามที่ผู้ใช้ขอลอง — เป็นการทดลองเท่านั้น ถ้าไม่ชอบให้ย้อนกลับเป็น 11pt เดิม
  cell: {
    fontSize: 10,
    padding: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  cellLast: {
    fontSize: 10,
    padding: 4,
    borderBottomWidth: 1,
    borderColor: "#111827",
  },
  // รวมกันต้องได้ 100% พอดี — เกินแล้วตารางจะกว้างกว่าหน้ากระดาษ ทำให้คอลัมน์ท้ายๆ ล้นออกนอกขอบ
  // กระดาษ (เคยเกิดมาแล้วตอนรวมได้ 105%)
  // colDate ต้องพอสำหรับ "28/05/2569" (แถวรับเข้ารายการที่มีวันที่เต็ม) ส่วนแถวคิดค่าเสื่อมรายปี
  // อื่นๆ แสดงแค่ปี พ.ศ. 4 หลัก ซึ่งแคบกว่ามากอยู่แล้ว
  colDate: { width: "8%", paddingLeft: 2 },
  colDocRef: { width: "8%" },
  colItem: { width: "16%" },
  colQty: { width: "5%", textAlign: "center" },
  colUnit: { width: "6%", textAlign: "center" },
  colUnitPrice: { width: "8%", textAlign: "right" },
  colTotal: { width: "8%", textAlign: "right" },
  colLife: { width: "5%", textAlign: "center" },
  colRate: { width: "5%", textAlign: "right" },
  colAnnual: { width: "7%", textAlign: "right" },
  colCumulative: { width: "8%", textAlign: "right" },
  colNet: { width: "8%", textAlign: "right" },
  colNote: { width: "8%" },
  cellLine: { fontSize: 10 },
  // สไตล์ตารางหน้า 2 "ประวัติการซ่อมบำรุงรักษาทรัพย์สิน" — คอลัมน์รวมกัน 100% เหมือนกัน:
  // ครั้งที่ 8% + วันเดือนปี 12% + รายการ 45% + จำนวนเงิน 15% + หมายเหตุ 20%
  repairColSeq: { width: "8%", textAlign: "center" },
  repairColDate: { width: "12%", textAlign: "center" },
  repairColDesc: { width: "45%" },
  repairColAmount: { width: "15%", textAlign: "right" },
  repairColNote: { width: "20%" },
  // ไม่ใช้ fontWeight: "bold" — เจอบั๊กซ้ำๆ ว่าตัวอักษรตัวแรกของ Text ตัวหนาที่อยู่ในคอลัมน์กว้างแบบ
  // % (เช่น "รายการ", "อายุใช้งาน") โดนตัดหายไปเฉยๆ เฉพาะกรณีนี้ (Text ตัวหนาที่กว้างคงที่ เช่น ป้ายชื่อ
  // ในส่วนหัวเอกสาร หรือชื่อเรื่องใหญ่ที่กว้างอัตโนมัติ ไม่เจอปัญหานี้) ลองแก้ด้วยการเติมช่องว่างนำหน้า
  // (ทั้งช่องว่างธรรมดาและ non-breaking space) และเพิ่ม padding แล้วก็ยังไม่หาย จึงเปลี่ยนมาไม่ใช้ตัวหนา
  // กับหัวตารางเลย ใช้พื้นหลังสีเทาอ่อนของแถวหัวตาราง (tHeadRow) แยกความแตกต่างจากแถวข้อมูลแทน
  headLine: { fontSize: 10, textAlign: "center" },
});

export type AssetDepreciationRow = {
  yearLabel: string;
  // มีค่าเฉพาะแถวรับเข้ารายการแรก (อ้างอิงเอกสารจัดซื้อ/รับบริจาคครั้งแรก) แถวคำนวณค่าเสื่อมที่ระบบ
  // สร้างเองไม่มีเอกสารอ้างอิงจึงเป็น null เสมอ
  docRef: string | null;
  itemLabel: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  usefulLifeYears: number | null;
  ratePercent: number | null;
  annual: number | null;
  cumulative: number | null;
  net: number | null;
  // แยกเป็นบรรทัดสั้นๆ ที่ตัดคำมาให้แล้วล่วงหน้า แทนที่จะเป็นประโยคยาวประโยคเดียว — ข้อความไทยไม่มี
  // ช่องว่างคั่นคำ ทำให้ระบบตัดบรรทัดอัตโนมัติของ react-pdf ตัดคำยาวๆ กลางคำไม่ได้ ล้นออกนอกช่องแคบๆ
  // ของคอลัมน์นี้แทน (ดู thai-pdf.ts) จึงต้องกำหนดจุดตัดบรรทัดเองให้สั้นพอ
  note: string[] | null;
};

export type AssetRepairPdfRow = {
  seq: number;
  dateLabel: string;
  description: string;
  amount: number | null;
  note: string | null;
};

export type AssetRegisterPdfData = {
  asset_code: string | null;
  sequence_no: string | null;
  name: string;
  category_name: string | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  building: string;
  floor: string | null;
  room: string;
  spec: string | null;
  model: string | null;
  school_name: string;
  education_area: string | null;
  school_address: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  budget_source_name: string | null;
  acquisition_method: string | null;
  acquired_year: number | null;
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
  photo_url: string | null;
  qr_url: string | null;
  schedule: AssetDepreciationRow[];
  repairs: AssetRepairPdfRow[];
};

// react-pdf ตัดตัวอักษรตัวแรกของ Text ทิ้งเป็นบางครั้งแบบสุ่มเดา (เจอมาแล้วกับ "รายการ" -> "ายการ",
// "อายุ" -> "ายุ") ไม่ว่าจะห่อด้วย View หรือไม่ก็ตาม เพิ่ม paddingLeft อย่างเดียวไม่พอ — ลองเติม
// "ช่องว่างธรรมดา" นำหน้าไปแล้วก็ยังไม่พอ (เอนจินตัดช่องว่างธรรมดาที่ต้นบรรทัดทิ้งก่อนวัดความกว้าง
// เป็นเรื่องปกติของ text layout ทำให้ตัวจริงตัวแรกยังโดนตัดอยู่ดี) เปลี่ยนมาใช้ non-breaking space
// (U+00A0) แทน ซึ่งเอนจินไม่ตัดทิ้งเหมือนช่องว่างธรรมดา ตัวอักษรจริงตัวแรกจะได้ไม่ใช่ตัวที่โดนตัด —
// ใช้แทน t() ทุกจุดในไฟล์นี้ที่ข้อความอาจขึ้นต้นบรรทัด/เซลล์
function guard(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return ` ${t(value)}`;
}

// แถวหัวเอกสาร — รับ 1 ช่องขึ้นไปในบรรทัดเดียวกัน (เช่น "ประเภท ... รหัส ... ลักษณะ/คุณสมบัติ ...")
// ปกติแต่ละช่องอยู่ในคอลัมน์ตายตัว 3 คอลัมน์เท่ากันเสมอ (ดู groupItem) ไม่ว่าแถวนั้นจะมี 2 หรือ 3 ช่อง
// ก็ตาม เพื่อให้ป้าย/ค่าของทุกแถวเรียงตรงแนวเดียวกันแนวตั้ง — แต่บางแถว (เช่นแถวที่มีค่ายาวอย่าง
// "ลักษณะ/คุณสมบัติ") ต้องการคอลัมน์กว้างกว่า 33.33% จึงใส่ widthPercent ต่อช่องเพื่อ override ได้
function HeaderRowGroup({
  items,
}: {
  items: { label: string; value: string | null | undefined; widthPercent?: number }[];
}) {
  return (
    <View style={styles.row}>
      {items.map((it, i) => (
        <View style={[styles.groupItem, it.widthPercent != null ? { width: `${it.widthPercent}%` } : undefined]} key={i}>
          <Text style={styles.label}>{guard(it.label)}</Text>
          <Text style={styles.value}>{guard(it.value || "-")}</Text>
        </View>
      ))}
    </View>
  );
}

// หัวตารางบางคอลัมน์แคบ (เช่น "อายุใช้งาน", "เสื่อมสะสม") เป็นคำไทยยาวไม่มีช่องว่างคั่นคำ ตัดบรรทัด
// อัตโนมัติของ react-pdf ตัดกลางคำไม่ได้ ล้นทับคอลัมน์ข้างๆ (ดู note ใน AssetDepreciationRow ด้านบน) —
// จึงกำหนดจุดตัดบรรทัดของหัวตารางเองล่วงหน้าเป็นอาร์เรย์บรรทัดสั้นๆ แทนสตริงยาวประโยคเดียว
function HeadCell({ style, lines }: { style: StyleProp; lines: string | string[] }) {
  if (typeof lines === "string") {
    return <Text style={[style, styles.headLine]}>{guard(lines)}</Text>;
  }
  return (
    <View style={style}>
      {lines.map((line, i) => (
        <Text style={styles.headLine} key={i}>
          {guard(line)}
        </Text>
      ))}
    </View>
  );
}

export function AssetRegisterDocument({ data }: { data: AssetRegisterPdfData }) {
  const location = [data.building, data.floor ? `ชั้น ${data.floor}` : null, data.room ? `ห้อง ${data.room}` : null]
    .filter(Boolean)
    .join(" ");
  // แสดงชื่อทรัพย์สินควบกับหมวดหมู่ในช่อง "ประเภทครุภัณฑ์" รูปแบบ "<ชื่อหมวดหมู่> - <ชื่อครุภัณฑ์>"
  const categoryWithName = [data.category_name, data.name].filter(Boolean).join(" - ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
        {data.qr_url && <Image src={data.qr_url} style={styles.qr} />}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image ไม่ใช่ <img> ของ HTML ไม่มี prop alt */}
        {data.photo_url && <Image src={data.photo_url} style={styles.photo} />}

        <View style={styles.center}>
          <Text style={styles.title}>{guard("ทะเบียนคุมทรัพย์สิน")}</Text>
        </View>

        <View style={styles.rightAlign}>
          <View style={styles.row}>
            <Text style={styles.rightLabel}>{guard("ส่วนราชการ")}</Text>
            <Text>{guard(data.education_area || "-")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rightLabel}>{guard("หน่วยงาน")}</Text>
            <Text>{guard(data.school_name || "-")}</Text>
          </View>
        </View>

        <HeaderRowGroup
          items={[
            { label: "ประเภทครุภัณฑ์", value: categoryWithName, widthPercent: 35 },
            { label: "รหัส", value: data.asset_code, widthPercent: 20 },
            { label: "ลักษณะ/คุณสมบัติ", value: data.spec, widthPercent: 45 },
          ]}
        />
        <HeaderRowGroup
          items={[
            { label: "รุ่น/แบบ", value: data.model },
            { label: "สถานที่ตั้ง", value: location },
            { label: "ชื่อผู้ขาย/ผู้รับจ้าง/ผู้บริจาค", value: data.vendor_name },
          ]}
        />
        <HeaderRowGroup
          items={[
            { label: "ที่อยู่", value: data.vendor_address },
            { label: "โทรศัพท์", value: data.vendor_phone },
          ]}
        />
        <HeaderRowGroup
          items={[
            { label: "ประเภทเงิน", value: data.budget_source_name },
            { label: "วิธีการได้มา", value: data.acquisition_method },
          ]}
        />

        <View style={[styles.table, { marginTop: 8 }]}>
          {/* fixed ทำให้แถวหัวตารางนี้พิมพ์ซ้ำที่ตำแหน่งเดียวกันทุกครั้งที่ตารางขึ้นหน้าใหม่
              (react-pdf จะ render แถวนี้ที่ตำแหน่งเดิมของทุกหน้าที่ตารางล้นไปถึง) */}
          <View style={styles.tHeadRow} fixed>
            <HeadCell style={[styles.cell, styles.colDate]} lines={["วัน/เดือน/", "ปี"]} />
            <HeadCell style={[styles.cell, styles.colDocRef]} lines={["ที่", "เอกสาร"]} />
            <HeadCell style={[styles.cell, styles.colItem]} lines="รายการ" />
            <HeadCell style={[styles.cell, styles.colQty]} lines="จำนวน" />
            <HeadCell style={[styles.cell, styles.colUnit]} lines="หน่วย" />
            <HeadCell style={[styles.cell, styles.colUnitPrice]} lines={["ราคา/", "หน่วย"]} />
            <HeadCell style={[styles.cell, styles.colTotal]} lines={["มูลค่า", "รวม"]} />
            <HeadCell style={[styles.cell, styles.colLife]} lines={["อายุ", "ใช้งาน"]} />
            <HeadCell style={[styles.cell, styles.colRate]} lines={["อัตรา", "(%)"]} />
            <HeadCell style={[styles.cell, styles.colAnnual]} lines={["ค่าเสื่อม", "ปี"]} />
            <HeadCell style={[styles.cell, styles.colCumulative]} lines={["เสื่อม", "สะสม"]} />
            <HeadCell style={[styles.cell, styles.colNet]} lines={["มูลค่า", "สุทธิ"]} />
            <HeadCell style={[styles.cellLast, styles.colNote]} lines="หมายเหตุ" />
          </View>
          {data.schedule.map((row, i) => (
            <View style={styles.tRow} key={i}>
              <Text style={[styles.cell, styles.colDate]}>{guard(row.yearLabel)}</Text>
              <Text style={[styles.cell, styles.colDocRef]}>{guard(row.docRef ?? "")}</Text>
              <Text style={[styles.cell, styles.colItem]}>{guard(row.itemLabel)}</Text>
              <Text style={[styles.cell, styles.colQty]}>{guard(row.quantity ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnit]}>{guard(row.unit ?? "")}</Text>
              <Text style={[styles.cell, styles.colUnitPrice]}>{guard(row.unitPrice != null ? formatBaht(row.unitPrice) : "")}</Text>
              <Text style={[styles.cell, styles.colTotal]}>{guard(row.total != null ? formatBaht(row.total) : "")}</Text>
              <Text style={[styles.cell, styles.colLife]}>{guard(row.usefulLifeYears ?? "")}</Text>
              <Text style={[styles.cell, styles.colRate]}>{guard(row.ratePercent != null ? row.ratePercent.toFixed(2) : "")}</Text>
              <Text style={[styles.cell, styles.colAnnual]}>{guard(row.annual != null ? formatBaht(row.annual) : "")}</Text>
              <Text style={[styles.cell, styles.colCumulative]}>{guard(row.cumulative != null ? formatBaht(row.cumulative) : "")}</Text>
              <Text style={[styles.cell, styles.colNet]}>{guard(row.net != null ? formatBaht(row.net) : "")}</Text>
              <View style={[styles.cellLast, styles.colNote]}>
                {(row.note ?? []).map((line, j) => (
                  <Text style={styles.cellLine} key={j}>
                    {guard(line)}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Page>

      {/* หน้า 2 (ด้านหลัง) — ประวัติการซ่อมบำรุงรักษาทรัพย์สิน ตามแบบฟอร์มมาตรฐาน สพฐ.
          (ครั้งที่/วันเดือนปี/รายการ/จำนวนเงิน/หมายเหตุ) แสดงเฉพาะรายการที่บันทึกไว้ในระบบแล้ว */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={{ textAlign: "right", marginBottom: 4 }}>{guard("(ด้านหลัง)")}</Text>
        <View style={styles.center}>
          <Text style={styles.title}>{guard("ประวัติการซ่อมบำรุงรักษาทรัพย์สิน")}</Text>
        </View>

        <View style={[styles.table, { marginTop: 8 }]}>
          <View style={styles.tHeadRow}>
            <HeadCell style={[styles.cell, styles.repairColSeq]} lines="ครั้งที่" />
            <HeadCell style={[styles.cell, styles.repairColDate]} lines={["วัน เดือน", "ปี"]} />
            <HeadCell style={[styles.cell, styles.repairColDesc]} lines="รายการ" />
            <HeadCell style={[styles.cell, styles.repairColAmount]} lines={["จำนวน", "เงิน"]} />
            <HeadCell style={[styles.cellLast, styles.repairColNote]} lines="หมายเหตุ" />
          </View>
          {data.repairs.map((r) => (
            <View style={styles.tRow} key={r.seq}>
              <Text style={[styles.cell, styles.repairColSeq]}>{guard(r.seq)}</Text>
              <Text style={[styles.cell, styles.repairColDate]}>{guard(r.dateLabel)}</Text>
              <Text style={[styles.cell, styles.repairColDesc]}>{guard(r.description)}</Text>
              <Text style={[styles.cell, styles.repairColAmount]}>{guard(r.amount != null ? formatBaht(r.amount) : "")}</Text>
              <Text style={[styles.cellLast, styles.repairColNote]}>{guard(r.note ?? "")}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
