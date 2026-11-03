import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { buildTeacherHireBlocks, type Block, type ContractContext, type TeacherHireContract } from "@/lib/teacher-hire-contract";
import { SignBody } from "./sign-block";
import { registerThSarabunFont, t } from "./thai-pdf";
import { wrapByWidth } from "./thai-measure";

// สัญญาจ้างครูอัตราจ้าง ชุด 4 ส่วน — ฟอนต์ TH Sarabun New 16pt (มาตรฐานเอกสารของระบบ) เนื้อหามาจาก teacher-hire-contract.ts
// แต่ละส่วนขึ้นหน้าใหม่ ลายมือชื่อใช้ SignBody มาตรฐาน

registerThSarabunFont();

const FS = 16;
const FAMILY = "THSarabunNew" as const;
const PAD_L = 70;
const PAD_R = 56;
const CONTENT_W = 595.28 - PAD_L - PAD_R;
const INDENT = 42;
const SIGN_LEFT = 230;

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: FS, paddingTop: 42, paddingBottom: 40, paddingLeft: PAD_L, paddingRight: PAD_R, color: "#000" },
});

function Lines({ lines, size = FS, bold = false, align = "left" as "left" | "center" | "right", marginBottom = 0, marginLeft = 0 }: { lines: string[]; size?: number; bold?: boolean; align?: "left" | "center" | "right"; marginBottom?: number; marginLeft?: number }) {
  return (
    <View style={{ marginBottom, marginLeft }}>
      {lines.map((l, i) => (
        <Text key={i} style={{ fontSize: size, fontWeight: bold ? "bold" : "normal", textAlign: align, lineHeight: 1.08 }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

function renderBlock(b: Block, key: number) {
  switch (b.kind) {
    case "title":
      return (
        <Lines
          key={key}
          lines={wrapByWidth(b.text, b.size === "xl" ? 20 : 17, CONTENT_W - 8, CONTENT_W - 8, true, FAMILY)}
          size={b.size === "xl" ? 20 : 17}
          bold
          align="center"
          marginBottom={b.size === "xl" ? 6 : 2}
        />
      );
    case "para":
      return <Lines key={key} lines={wrapByWidth(b.text, FS, CONTENT_W - INDENT - 8, CONTENT_W - 8, false, FAMILY)} marginBottom={4} marginLeft={0} />;
    case "clause":
      return <Lines key={key} lines={wrapByWidth(b.text, FS, CONTENT_W - INDENT - 8, CONTENT_W - 8, false, FAMILY)} marginBottom={4} />;
    case "item":
      return <Lines key={key} lines={wrapByWidth(b.text, FS, CONTENT_W - 2 * INDENT - 8, CONTENT_W - 2 * INDENT - 8, false, FAMILY)} marginLeft={INDENT * 1.5} marginBottom={1} />;
    case "right":
      return <Lines key={key} lines={[b.text]} align="right" marginBottom={2} />;
    default:
      return null;
  }
}

/** แถวแรกของย่อหน้า/ข้อ เว้นย่อหน้า — เขียนเป็น 2 ส่วน: บรรทัดแรกเยื้อง ที่เหลือชิดซ้าย */
function renderIndented(b: Extract<Block, { kind: "para" | "clause" }>, key: number) {
  const lines = wrapByWidth(b.text, FS, CONTENT_W - INDENT - 8, CONTENT_W - 8, false, FAMILY);
  return (
    <View key={key} style={{ marginBottom: 4 }}>
      {lines.map((l, i) => (
        <Text key={i} style={{ fontSize: FS, lineHeight: 1.08, marginLeft: i === 0 ? INDENT : 0 }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

function SignGroup({ signs, size }: { signs: Extract<Block, { kind: "sign" }>[]; size: number }) {
  return (
    <View wrap={false} style={{ marginTop: 10, marginLeft: SIGN_LEFT }}>
      {signs.map((s, i) => (
        <View key={i} style={{ marginTop: i === 0 ? 0 : 9 }}>
          <SignBody role={s.role} name={s.name} extra={s.extra} size={size} family={FAMILY} />
        </View>
      ))}
    </View>
  );
}

function Section({ blocks }: { blocks: Block[] }) {
  const out: React.ReactNode[] = [];
  let signs: Extract<Block, { kind: "sign" }>[] = [];
  const flush = (key: number) => {
    if (signs.length) {
      out.push(<SignGroup key={`s${key}`} signs={signs} size={FS} />);
      signs = [];
    }
  };
  blocks.forEach((b, i) => {
    if (b.kind === "sign") {
      signs.push(b);
      return;
    }
    flush(i);
    if (b.kind === "para" || b.kind === "clause") out.push(renderIndented(b, i));
    else out.push(renderBlock(b, i));
  });
  flush(blocks.length);
  return <Page size="A4" style={styles.page}>{out}</Page>;
}

export function TeacherHireDocument({ contract, ctx }: { contract: TeacherHireContract; ctx: ContractContext }) {
  const blocks = buildTeacherHireBlocks(contract, ctx);
  const sections: Block[][] = [[]];
  for (const b of blocks) {
    if (b.kind === "pagebreak") sections.push([]);
    else sections[sections.length - 1].push(b);
  }
  return (
    <Document title={`สัญญาจ้างครูอัตราจ้าง ${contract.contract_no}`}>
      {sections.map((s, i) => (
        <Section key={i} blocks={s} />
      ))}
    </Document>
  );
}
