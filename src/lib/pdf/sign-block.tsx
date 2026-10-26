import { Line, Svg, Text, View } from "@react-pdf/renderer";
import { t } from "./thai-pdf";
import { measureText, type MeasureFamily } from "./thai-measure";

// บล็อกลายมือชื่อมาตรฐานของเอกสาร PDF ทั้งระบบ (ผู้ใช้กำหนด ต.ค. 2569):
//   "ลงชื่อ ……………… <ตำแหน่ง/บทบาท>" — เส้นจุดไข่ปลายาวเท่าความกว้างของชื่อในวงเล็บ (ยังไม่มีชื่อ = ความกว้างเริ่มต้นไว้เขียนมือ)
//   ชื่อในวงเล็บ และบรรทัดเพิ่มเติม (ตำแหน่ง วันที่ ฯลฯ) จัดกึ่งกลางใต้เส้นจุด
// ทุกเอกสารเรียกใช้ <SignBody> ตัวนี้ตัวเดียว ให้หน้าตาเหมือนกัน — ตัวบล็อกเองกว้างเท่าเนื้อหา ผู้เรียกจัดตำแหน่งในหน้า
// (marginLeft / alignSelf / กรอบที่ alignItems: center) ตามเดิม

const GAP = 4;
/** ความกว้างเส้นจุดเมื่อยังไม่มีชื่อ (pt) */
export const SIGN_BLANK_W = 130;

function DotLeader() {
  return (
    <Svg width={1200} height={1.5} style={{ position: "absolute", left: 0, bottom: 0 }}>
      <Line x1={0} y1={0.75} x2={1200} y2={0.75} stroke="#000000" strokeWidth={0.7} strokeDasharray="0.7 2.1" strokeLinecap="round" />
    </Svg>
  );
}

export function SignBody({
  label = "ลงชื่อ",
  role = "",
  name,
  extra = [],
  size = 16,
  family = "THSarabunNew",
  blankWidth = SIGN_BLANK_W,
}: {
  /** ข้อความหน้าเส้นจุด เช่น "ลงชื่อ" / "(ลงชื่อ)" */
  label?: string;
  /** ข้อความหลังเส้นจุด เช่น "ผู้ตรวจรับพัสดุ" */
  role?: string;
  name: string | null | undefined;
  /** บรรทัดใต้ชื่อ (ตำแหน่ง/วันที่ ฯลฯ) — จัดกึ่งกลางใต้เส้นจุด */
  extra?: string[];
  size?: number;
  family?: MeasureFamily;
  blankWidth?: number;
}) {
  const m = (s: string) => measureText(s, size, false, family);
  const labelW = m(label) + GAP;
  const roleW = role ? m(role) + GAP + 4 : 0;
  const nameText = name?.trim() ? `(${name.trim()})` : "";
  const dotsW = nameText ? m(nameText) + 6 : blankWidth;
  const lines = extra.map((x) => x.trim()).filter(Boolean);
  const extraW = lines.reduce((mx, x) => Math.max(mx, m(x) + 6), 0);
  const textW = Math.max(dotsW, extraW);
  const dotsCenter = labelW + dotsW / 2;
  // บรรทัดใต้เส้นจุดยาวกว่าเส้นจุดมาก → กึ่งกลางจะล้นซ้ายของแถวลงชื่อ จึงเลื่อนทั้งก้อนไปทางขวาให้พอดี
  const shift = Math.max(0, textW / 2 - dotsCenter);
  const blockW = shift + Math.max(labelW + dotsW + roleW, dotsCenter + textW / 2);
  const fs = { fontSize: size };
  return (
    <View style={{ width: blockW }}>
      <View style={{ marginLeft: shift, flexDirection: "row", alignItems: "flex-end", lineHeight: 1.0, marginBottom: 1.5 }}>
        <Text style={[fs, { marginRight: GAP }]}>{t(label)}</Text>
        <View style={{ position: "relative", overflow: "hidden", paddingBottom: 0.5, width: dotsW, lineHeight: 1.0 }}>
          <Text style={fs}>{" "}</Text>
          <DotLeader />
        </View>
        {role ? <Text style={[fs, { marginLeft: GAP + 4 }]}>{t(role)}</Text> : null}
      </View>
      <View style={{ marginLeft: shift + dotsCenter - textW / 2, width: textW, alignItems: "center" }}>
        {nameText ? (
          <Text style={fs}>{t(nameText)}</Text>
        ) : (
          <View style={{ width: dotsW, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={fs}>{t("(")}</Text>
            <Text style={fs}>{t(")")}</Text>
          </View>
        )}
        {lines.map((x, i) => (
          <Text key={i} style={fs}>
            {t(x)}
          </Text>
        ))}
      </View>
    </View>
  );
}
