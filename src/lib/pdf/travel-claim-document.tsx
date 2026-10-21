import { Rect, Document, Line, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import { formatThaiDate, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { B, CM, CONTENT_W, FAMILY, measureText, wrap } from "./procurement-set-document";

// แบบ 8708 — ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ (ส่วนที่ 1) + หลักฐานการจ่ายเงินค่าใช้จ่ายในการเดินทางไปราชการ (ส่วนที่ 2)
// ตามตัวอย่างในคู่มือการเบิกจ่ายค่าใช้จ่ายในการเดินทางไปราชการ ค่าใช้จ่ายในการฝึกอบรมและการจัดงาน (หน้า 24–27)
// ส่วนที่ 1 A4 แนวตั้ง 2 หน้า, ส่วนที่ 2 A4 แนวนอน (พิมพ์เมื่อเบิกเป็นคณะ หรือเลือกพิมพ์) — ช่องที่ไม่กรอกเป็นจุดไข่ปลา
// TH Sarabun New 16pt (ตาราง 15pt)

const FS = 16;
const FS_TABLE = 15;
const DOTS = "........................................................................................................................";
const dots = (n: number) => DOTS.slice(0, n);
const v = (s: string | null | undefined, n: number) => (s && String(s).trim() ? ` ${String(s).trim()} ` : dots(n));
const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const words = (n: number) => thaiBahtText(n).replace(/^\(|\)$/g, "");

import { PLACE_LABEL, claimTotal, travelDuration, type TravelClaim, type TravelMember, type TravelPlace } from "@/lib/travel-claim";
export type { TravelClaim, TravelMember, TravelPlace } from "@/lib/travel-claim";

const page = { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.35, paddingTop: 1.5 * CM, paddingBottom: 1.2 * CM, paddingLeft: 2.5 * CM, paddingRight: 2 * CM };
const cell = { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 };
/** ระยะห่างระหว่างบรรทัดของส่วนที่ 1 — ตั้งให้เนื้อหาเต็มหน้า A4 เหมือนแบบในคู่มือ */
const ROW_GAP = 5.2;

/** เส้นจุดไข่ปลาใต้ช่องกรอก (วาดด้วย Svg — borderStyle dotted ของ react-pdf ลากเป็นเส้นทึบ) */
function DotLeader() {
  return (
    <Svg width={1200} height={1.5} style={{ position: "absolute", left: 0, bottom: 1 }}>
      <Line x1={0} y1={0.75} x2={1200} y2={0.75} stroke="#000" strokeWidth={0.7} strokeDasharray="0.7 2.1" strokeLinecap="round" />
    </Svg>
  );
}

/** ส่วนประกอบของบรรทัด: ข้อความป้าย (string) หรือช่องกรอกมีเส้นจุด { v, w } (w ไม่ระบุ = ยืดเต็มที่เหลือ) */
type Seg = string | { v?: string | null; w?: number; align?: "left" | "center" | "right" } | { mark: boolean };
function Row({ segs, indent = 0, gap = ROW_GAP }: { segs: Seg[]; indent?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: gap, marginLeft: indent, lineHeight: 1.1 }}>
      {segs.map((sg, i) =>
        typeof sg === "string" ? (
          <Text key={i}>{t(sg)}</Text>
        ) : "mark" in sg ? (
          <Mark key={i} on={sg.mark} />
        ) : (
          <View key={i} style={[{ position: "relative", overflow: "hidden", paddingHorizontal: 3 }, sg.w ? { width: sg.w } : { flex: 1 }]}>
            <Text style={{ textAlign: sg.align ?? "center" }}>{t(sg.v?.toString().trim() || " ")}</Text>
            <DotLeader />
          </View>
        ),
      )}
    </View>
  );
}

/** ช่องเลือก — กล่องสี่เหลี่ยม ถ้าเลือกมีเครื่องหมายถูกทับ (ฟอนต์ไม่มีอักษรติ๊ก จึงวาดเอง) */
function Mark({ on }: { on: boolean }) {
  return (
    <Svg width={13} height={12} style={{ marginHorizontal: 3, marginBottom: 3 }}>
      <Rect x={1} y={3} width={8} height={8} stroke="#000" strokeWidth={0.8} fill="none" />
      {on && <Path d="M1.5 6.5 L5 10 L12 1" stroke="#000" strokeWidth={1.3} fill="none" />}
    </Svg>
  );
}

const W = CONTENT_W;
const tw = (s: string) => measureText(s, FS) + 2;
/** ตัดข้อความยาว (เรื่อง/ผู้ร่วมเดินทาง) ให้พอดีช่องแรก ที่เหลือขึ้นบรรทัดถัดไป */
function split(text: string, first: number, rest: number): string[] {
  const s = text.trim();
  if (!s) return [""];
  return wrap(s, FS, first - 8, rest - 8);
}
const thDateSegs = (iso: string | null, wd = 34, wm = 80, wy = 44): Seg[] => {
  const x = iso ? formatThaiDate(iso).split(" ") : ["", "", ""];
  return ["วันที่", { v: x[0], w: wd }, "เดือน", { v: x[1], w: wm }, "พ.ศ.", { v: x[2], w: wy }];
};
const places = (sel: TravelPlace | null): Seg[] => (["home", "office", "thailand"] as TravelPlace[]).flatMap((p) => [{ mark: sel === p }, PLACE_LABEL[p] + " "] as Seg[]);
const sum = (n: number) => (n ? money(n) : "");

function SignBox({ title, s: who, suffix = "" }: { title?: string[]; s: { name: string; position: string }; suffix?: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 6, paddingVertical: 6 }}>
      {title?.map((l, i) => (
        <Text key={i}>{t(l)}</Text>
      ))}
      <View style={{ height: title ? 22 : 6 }} />
      <Row segs={["ลงชื่อ", { w: 150 }, suffix]} gap={6} />
      <Row segs={["(", { v: who.name, w: 150 }, ")"]} indent={18} gap={6} />
      <Row segs={["ตำแหน่ง", { v: who.position }]} gap={6} />
      <Row segs={["วันที่", { w: undefined }]} gap={2} />
    </View>
  );
}

export function TravelClaimDocument({ data: d }: { data: TravelClaim }) {
  const total = claimTotal(d);
  const dur = travelDuration(d);
  const members = d.members.filter((m) => m.name.trim() || m.allowance || m.lodging || m.transport || m.other);
  const showPart2 = d.print_part2 || d.claim_for === "group";
  // พร้อมด้วย: ช่องท้ายบรรทัด "สังกัด" + บรรทัดเต็มถัดไป
  const compFirst = 175;
  const comp = split(d.companions, compFirst, W);
  // เดินทางไปปฏิบัติราชการ: บรรทัดแรกต่อจากป้าย, บรรทัดที่สองจบด้วย "โดยออกเดินทางจาก"
  const p1 = W - tw("เดินทางไปปฏิบัติราชการ");
  const pur = split(d.purpose, p1, W);
  const purLines = [pur[0] ?? "", pur.slice(1).join(" ")];
  return (
    <Document title="ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ">
      <Page size="A4" style={page}>
        <Text style={{ textAlign: "right", marginBottom: 10 }}>{t("ส่วนที่ 1 แบบ 8708")}</Text>
        <Row segs={["สัญญาเงินยืมเลขที่", { v: d.loan_no }, "วันที่", { v: d.loan_date ? formatThaiDate(d.loan_date) : "", w: 150 }]} />
        <Row segs={["ชื่อผู้ยืม", { v: d.borrower }, "จำนวนเงิน", { v: sum(d.loan_amount), w: 110 }, "บาท"]} />
        <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18, marginBottom: ROW_GAP }}>{t("ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ")}</Text>
        <Row segs={["ที่ทำการ", { v: d.office }]} indent={W * 0.48} />
        <Row segs={thDateSegs(d.date, 34, 90, 50)} indent={W * 0.43} />
        <Row segs={["เรื่อง      ขออนุมัติเบิกค่าใช้จ่ายในการเดินทางไปราชการ"]} />
        <Row segs={["เรียน      ", { v: d.to, w: 260, align: "left" }]} gap={ROW_GAP + 6} />
        <Row segs={["ตามคำสั่ง/บันทึก ที่", { v: d.order_no }, "ลงวันที่", { v: d.order_date ? formatThaiDate(d.order_date) : "", w: 130 }, "ได้อนุมัติให้"]} indent={1.5 * CM} />
        <Row segs={["ข้าพเจ้า", { v: d.name }, "ตำแหน่ง", { v: d.position, w: 170 }]} />
        <Row segs={["สังกัด", { v: d.affiliation }, "พร้อมด้วย", { v: comp[0], w: compFirst, align: "left" }]} />
        <Row segs={[{ v: comp.slice(1).join(" "), align: "left" }]} />
        <Row segs={["เดินทางไปปฏิบัติราชการ", { v: purLines[0], align: "left" }]} />
        <Row segs={[{ v: purLines[1], align: "left" }, "โดยออกเดินทางจาก"]} />
        <Row segs={[...places(d.depart_from), "ตั้งแต่", ...thDateSegs(d.depart_date, 26, 66, 36), "เวลา", { v: d.depart_time, w: 40 }, "น."]} />
        <Row segs={["และกลับถึง", ...places(d.return_to), ...thDateSegs(d.return_date, 26, 66, 36)]} />
        <Row segs={["เวลา", { v: d.return_time, w: 50 }, "น. รวมเวลาไปราชการครั้งนี้", { v: dur ? String(dur.days) : "", w: 70 }, "วัน", { v: dur ? String(dur.hours) : "", w: 70 }, "ชั่วโมง"]} />
        <Row segs={["ข้าพเจ้าขอเบิกค่าใช้จ่ายในการเดินทางไปราชการสำหรับ", { mark: d.claim_for === "self" }, "ข้าพเจ้า", { mark: d.claim_for === "group" }, "คณะเดินทาง ดังนี้"]} indent={1.5 * CM} />
        <Row segs={["ค่าเบี้ยเลี้ยงเดินทางประเภท", { v: d.allowance_type }, "จำนวน", { v: d.allowance_days, w: 50 }, "วัน รวม", { v: sum(d.allowance), w: 95, align: "right" }, "บาท"]} />
        <Row segs={["ค่าเช่าที่พักประเภท", { v: d.lodging_type }, "จำนวน", { v: d.lodging_days, w: 50 }, "วัน รวม", { v: sum(d.lodging), w: 95, align: "right" }, "บาท"]} />
        <Row segs={["ค่าพาหนะ", { v: d.transport_desc, align: "left" }, "รวม", { v: sum(d.transport), w: 95, align: "right" }, "บาท"]} />
        <Row segs={["ค่าใช้จ่ายอื่น", { v: d.other_desc, align: "left" }, "รวม", { v: sum(d.other), w: 95, align: "right" }, "บาท"]} />
        <Row segs={["รวมเงินทั้งสิ้น", { v: sum(total), w: 95, align: "right" }, "บาท"]} indent={W - 95 - tw("รวมเงินทั้งสิ้น") - tw("บาท") - 6} />
        <Row segs={["จำนวนเงิน (ตัวอักษร)", { v: total ? words(total) : "", align: "left" }]} />
        <Row segs={["ข้าพเจ้าขอรับรองว่ารายการที่กล่าวมาข้างต้นเป็นความจริง และหลักฐานการจ่ายที่ส่งมาด้วย"]} indent={1.5 * CM} />
        <Row segs={["จำนวน", { v: d.evidence_count, w: 90 }, "ฉบับ รวมทั้งจำนวนเงินที่ขอเบิกถูกต้องตามกฎหมายทุกประการ"]} />
        <View style={{ marginLeft: W * 0.3, marginTop: 8 }}>
          <Row segs={["ลงชื่อ", { w: 190 }, "ผู้ขอรับเงิน"]} />
          <Row segs={["(", { v: d.name, w: 190 }, ")"]} indent={22} />
          <Row segs={["ตำแหน่ง", { v: d.position, w: 190 }]} />
        </View>
      </Page>

      <Page size="A4" style={page}>
        <View style={{ flexDirection: "row", borderTopWidth: B, borderBottomWidth: B, marginTop: 10 }} wrap={false}>
          <View style={{ flex: 1, borderRightWidth: B }}>
            <SignBox title={["ได้ตรวจสอบหลักฐานการเบิกจ่ายเงินที่แนบ", "ถูกต้องแล้ว เห็นควรอนุมัติให้เบิกจ่ายได้"]} s={d.checker} />
          </View>
          <SignBox title={["อนุมัติให้จ่ายได้", " "]} s={d.approver} />
        </View>
        <View style={{ marginTop: 16 }}>
          <Row segs={["ได้รับเงินค่าใช้จ่ายในการเดินทางไปราชการ จำนวน", { v: sum(total) }, "บาท"]} indent={1.5 * CM} />
          <Row segs={["(", { v: total ? words(total) : "" }, ") ไว้เป็นการถูกต้องแล้ว"]} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 8 }} wrap={false}>
          <SignBox s={{ name: d.claim_for === "self" ? d.name : "", position: d.claim_for === "self" ? d.position : "" }} suffix="ผู้รับเงิน" />
          <SignBox s={d.payer} suffix="ผู้จ่ายเงิน" />
        </View>
        <View style={{ borderBottomWidth: B, paddingBottom: 8, marginTop: 14 }}>
          <Row segs={["จากเงินยืมตามสัญญาเลขที่", { v: d.loan_no }, "วันที่", { v: d.loan_date ? formatThaiDate(d.loan_date) : "", w: 160 }]} gap={0} />
        </View>
        <View style={{ marginTop: 14, borderBottomWidth: B, paddingBottom: 10 }}>
          {(() => {
            const first = W - tw("หมายเหตุ");
            const lines = d.note.trim() ? split(d.note, first, W) : [];
            const rows = Math.max(9, lines.length);
            return Array.from({ length: rows }, (_, i) => (i === 0 ? <Row key={i} segs={["หมายเหตุ", { v: lines[0] ?? "", align: "left" }]} /> : <Row key={i} segs={[{ v: lines[i] ?? "", align: "left" }]} />));
          })()}
        </View>
      </Page>

      {showPart2 && <Part2 d={d} members={members} />}
    </Document>
  );
}

const LAND_W = 841.89 - 2 * 1.5 * CM;
const C = { no: 36, name: 120, pos: 90, allow: 62, lodge: 62, trans: 62, other: 62, sum: 66, sign: 70, date: 64 };
const NOTE_W = LAND_W - Object.values(C).reduce((a, b) => a + b, 0) - B;
const MIN_ROWS = 8;

function Part2({ d, members }: { d: TravelClaim; members: TravelMember[] }) {
  const sum = (k: "allowance" | "lodging" | "transport" | "other") => members.reduce((s, m) => s + m[k], 0);
  const grand = sum("allowance") + sum("lodging") + sum("transport") + sum("other");
  const rows = [...members, ...Array.from({ length: Math.max(0, MIN_ROWS - members.length) }, () => null)];
  const head = (w: number, label: string) => (
    <View style={[cell, { width: w, justifyContent: "center" }]}>
      {label.split("\n").map((l, i) => (
        <Text key={i} style={{ textAlign: "center" }}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
  const num = (w: number, n: number | null) => <Text style={[cell, { width: w, textAlign: "right" }]}>{n ? money(n) : " "}</Text>;
  return (
    <Page size="A4" orientation="landscape" style={{ ...page, paddingLeft: 1.5 * CM, paddingRight: 1.5 * CM, paddingTop: 1.2 * CM }}>
      <View fixed>
        <Text style={{ textAlign: "right" }}>{t("ส่วนที่ 2 แบบ 8708")}</Text>
        <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18 }}>{t("หลักฐานการจ่ายเงินค่าใช้จ่ายในการเดินทางไปราชการ")}</Text>
        <Row segs={["ชื่อส่วนราชการ", { v: d.office, w: 260 }, "จังหวัด", { v: d.province, w: 160 }]} indent={110} gap={4} />
        <Row segs={["ประกอบใบเบิกค่าใช้จ่ายในการเดินทางของ", { v: d.name, w: 230 }, "ลง", ...thDateSegs(d.date, 30, 80, 44)]} gap={6} />
        <View style={{ flexDirection: "row", borderTopWidth: B, borderLeftWidth: B, fontSize: FS_TABLE }}>
          {head(C.no, "ลำดับที่")}
          {head(C.name, "ชื่อ")}
          {head(C.pos, "ตำแหน่ง")}
          <View style={{ width: C.allow + C.lodge + C.trans + C.other }}>
            <Text style={[cell, { textAlign: "center" }]}>{t("ค่าใช้จ่าย")}</Text>
            <View style={{ flexDirection: "row", flexGrow: 1 }}>
              {head(C.allow, "ค่าเบี้ยเลี้ยง")}
              {head(C.lodge, "ค่าเช่าที่พัก")}
              {head(C.trans, "ค่าพาหนะ")}
              {head(C.other, "ค่าใช้จ่ายอื่น")}
            </View>
          </View>
          {head(C.sum, "รวม")}
          {head(C.sign, "ลายมือชื่อ\nผู้รับเงิน")}
          {head(C.date, "วัน เดือน ปี\nที่รับเงิน")}
          {head(NOTE_W, "หมายเหตุ")}
        </View>
      </View>
      {rows.map((m, i) => (
        <View key={i} style={{ flexDirection: "row", borderLeftWidth: B, fontSize: FS_TABLE }} wrap={false}>
          <Text style={[cell, { width: C.no, textAlign: "center" }]}>{m ? String(i + 1) : " "}</Text>
          <View style={[cell, { width: C.name }]}>
            {(m ? wrap(m.name, FS_TABLE, C.name - 12, C.name - 12) : [" "]).map((l, j) => (
              <Text key={j}>{t(l) || " "}</Text>
            ))}
          </View>
          <View style={[cell, { width: C.pos }]}>
            {(m ? wrap(m.position, FS_TABLE, C.pos - 12, C.pos - 12) : [" "]).map((l, j) => (
              <Text key={j}>{t(l) || " "}</Text>
            ))}
          </View>
          {num(C.allow, m?.allowance ?? null)}
          {num(C.lodge, m?.lodging ?? null)}
          {num(C.trans, m?.transport ?? null)}
          {num(C.other, m?.other ?? null)}
          {num(C.sum, m ? m.allowance + m.lodging + m.transport + m.other : null)}
          <Text style={[cell, { width: C.sign }]}> </Text>
          <Text style={[cell, { width: C.date }]}> </Text>
          <View style={[cell, { width: NOTE_W }]}>
            {(m?.note ? wrap(m.note, FS_TABLE, NOTE_W - 12, NOTE_W - 12) : [" "]).map((l, j) => (
              <Text key={j}>{t(l) || " "}</Text>
            ))}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: "row", borderLeftWidth: B, fontSize: FS_TABLE }} wrap={false}>
        <Text style={[cell, { width: C.no + C.name + C.pos + 2 * B, textAlign: "center", fontWeight: "bold" }]}>{t("รวมเงิน")}</Text>
        {num(C.allow, members.length ? sum("allowance") || null : null)}
        {num(C.lodge, members.length ? sum("lodging") || null : null)}
        {num(C.trans, members.length ? sum("transport") || null : null)}
        {num(C.other, members.length ? sum("other") || null : null)}
        {num(C.sum, grand || null)}
        <Text style={[cell, { width: C.sign + C.date + NOTE_W + 2 * B }]}>{t(`ตามสัญญาเงินยืมเลขที่${v(d.loan_no, 14)}วันที่${d.loan_date ? ` ${formatThaiDate(d.loan_date)} ` : dots(14)}`)}</Text>
      </View>
      <View style={{ flexDirection: "row", marginTop: 6 }} wrap={false}>
        <View style={{ flex: 1 }}>
          <Text>{t(`จำนวนเงินรวมทั้งสิ้น (ตัวอักษร)${grand ? ` ${words(grand)} ` : dots(60)}`)}</Text>
          <Text style={{ fontSize: 13 }}>{t("คำชี้แจง 1. ค่าเบี้ยเลี้ยงและค่าเช่าที่พักให้ระบุอัตราวันละและจำนวนวันที่ขอเบิกของแต่ละบุคคลในช่องหมายเหตุ")}</Text>
          <Text style={{ fontSize: 13 }}>{t("2. ให้ผู้มีสิทธิแต่ละคนเป็นผู้ลงลายมือชื่อผู้รับเงินและวัน เดือน ปี ที่ได้รับเงิน กรณีเป็นการรับจากเงินยืม ให้ระบุวันที่ที่ได้รับจากเงินยืม")}</Text>
          <Text style={{ fontSize: 13 }}>{t("3. ผู้จ่ายเงิน หมายถึง ผู้ที่ขอยืมเงินจากทางราชการ และจ่ายเงินยืมนั้นให้แก่ผู้เดินทางแต่ละคน เป็นผู้ลงลายมือชื่อผู้จ่ายเงิน")}</Text>
        </View>
        <View style={{ width: 230, alignItems: "center" }}>
          <Row segs={["ลงชื่อ", { w: 140 }, "ผู้จ่ายเงิน"]} gap={4} />
          <Row segs={["(", { v: d.payer.name, w: 140 }, ")"]} gap={4} />
          <Row segs={["ตำแหน่ง", { v: d.payer.position, w: 140 }]} gap={4} />
          <Row segs={["วันที่", { w: 150 }]} gap={0} />
        </View>
      </View>
    </Page>
  );
}
