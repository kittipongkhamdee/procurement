import { Document, Page, Text, View } from "@react-pdf/renderer";
import { formatThaiDate, thaiBahtText } from "@/lib/thai";
import { t } from "./thai-pdf";
import { B, CM, CONTENT_W, FAMILY, wrap } from "./procurement-set-document";

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
const amt = (n: number, len = 20) => (n ? ` ${money(n)} ` : dots(len));
const words = (n: number) => thaiBahtText(n).replace(/^\(|\)$/g, "");
const dmy = (iso: string | null) => {
  if (!iso) return { d: dots(6), m: dots(14), y: dots(8) };
  const [d, m, y] = formatThaiDate(iso).split(" ");
  return { d, m, y };
};
const full = (iso: string | null, n = 25) => (iso ? ` ${formatThaiDate(iso)} ` : dots(n));

import { PLACE_LABEL, claimTotal, travelDuration, type TravelClaim, type TravelMember, type TravelPlace } from "@/lib/travel-claim";
export type { TravelClaim, TravelMember, TravelPlace } from "@/lib/travel-claim";

const page = { fontFamily: FAMILY, fontSize: FS, lineHeight: 1.35, paddingTop: 1.5 * CM, paddingBottom: 1.2 * CM, paddingLeft: 2.5 * CM, paddingRight: 2 * CM };
const cell = { borderRightWidth: B, borderBottomWidth: B, paddingHorizontal: 3, paddingVertical: 1 };

/** ช่องเลือก: ที่เลือก = ✓ ทับวงกลม (ฟอนต์ TH Sarabun ไม่มีอักษรติ๊ก จึงใช้ "(/)") */
const MARK = "(/)";
const choiceText = (sel: TravelPlace | null) => (["home", "office", "thailand"] as TravelPlace[]).map((p) => `${sel === p ? MARK : "๐"} ${PLACE_LABEL[p]}`).join(" ");

function Para({ text, indent = 0, width = CONTENT_W }: { text: string; indent?: number; width?: number }) {
  return (
    <View>
      {wrap(text, FS, width - indent - 10, width - 10).map((l, i) => (
        <Text key={i} style={i === 0 ? { marginLeft: indent } : {}}>
          {t(l)}
        </Text>
      ))}
    </View>
  );
}

function SignBox({ title, s, date, suffix = "" }: { title?: string; s: { name: string; position: string }; date?: string | null; suffix?: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 6, paddingVertical: 4 }}>
      {title && <Para text={title} width={CONTENT_W / 2 - 12} />}
      <Text style={{ marginTop: title ? 14 : 4 }}>{t(`ลงชื่อ${dots(38)}${suffix}`)}</Text>
      <Text style={{ marginLeft: 24 }}>{t(`(${s.name.trim() || dots(38)})`)}</Text>
      <Text>{t(`ตำแหน่ง${v(s.position, 38)}`)}</Text>
      <Text>{t(`วันที่${date ? ` ${formatThaiDate(date)} ` : dots(40)}`)}</Text>
    </View>
  );
}

export function TravelClaimDocument({ data: d }: { data: TravelClaim }) {
  const total = claimTotal(d);
  const dur = travelDuration(d);
  const date = dmy(d.date);
  const dep = dmy(d.depart_date);
  const ret = dmy(d.return_date);
  const members = d.members.filter((m) => m.name.trim() || m.allowance || m.lodging || m.transport || m.other);
  const showPart2 = d.print_part2 || d.claim_for === "group";
  return (
    <Document title="ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ">
      <Page size="A4" style={page}>
        <Text style={{ textAlign: "right" }}>{t("ส่วนที่ 1 แบบ 8708")}</Text>
        <Text>{t(`สัญญาเงินยืมเลขที่${v(d.loan_no, 40)}วันที่${full(d.loan_date, 30)}`)}</Text>
        <Text>{t(`ชื่อผู้ยืม${v(d.borrower, 45)}จำนวนเงิน${amt(d.loan_amount, 25)}บาท`)}</Text>
        <Text style={{ textAlign: "center", fontWeight: "bold", fontSize: 18, marginTop: 4 }}>{t("ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ")}</Text>
        <Text style={{ marginLeft: CONTENT_W * 0.5 }}>{t(`ที่ทำการ${v(d.office, 40)}`)}</Text>
        <Text style={{ marginLeft: CONTENT_W * 0.45 }}>{t(`วันที่ ${date.d} เดือน ${date.m} พ.ศ. ${date.y}`)}</Text>
        <Text>{t("เรื่อง   ขออนุมัติเบิกค่าใช้จ่ายในการเดินทางไปราชการ")}</Text>
        <Text style={{ marginBottom: 4 }}>{t(`เรียน   ${d.to.trim() || dots(50)}`)}</Text>
        <Para
          indent={1.5 * CM}
          text={`ตามคำสั่ง/บันทึก ที่${v(d.order_no, 30)}ลงวันที่${full(d.order_date)}ได้อนุมัติให้ข้าพเจ้า${v(d.name, 40)}ตำแหน่ง${v(d.position, 35)}สังกัด${v(d.affiliation, 40)}พร้อมด้วย${v(d.companions, 60)}เดินทางไปปฏิบัติราชการ${v(d.purpose, 80)}โดยออกเดินทางจาก ${choiceText(d.depart_from)} ตั้งแต่วันที่ ${dep.d} เดือน ${dep.m} พ.ศ. ${dep.y} เวลา${v(d.depart_time, 10)}น. และกลับถึง ${choiceText(d.return_to)} วันที่ ${ret.d} เดือน ${ret.m} พ.ศ. ${ret.y} เวลา${v(d.return_time, 10)}น. รวมเวลาไปราชการครั้งนี้${dur ? ` ${dur.days} ` : dots(12)}วัน${dur ? ` ${dur.hours} ` : dots(12)}ชั่วโมง`}
        />
        <Para
          indent={1.5 * CM}
          text={`ข้าพเจ้าขอเบิกค่าใช้จ่ายในการเดินทางไปราชการสำหรับ ${d.claim_for === "self" ? MARK : "๐"} ข้าพเจ้า ${d.claim_for === "group" ? MARK : "๐"} คณะเดินทาง ดังนี้`}
        />
        <Text>{t(`ค่าเบี้ยเลี้ยงเดินทางประเภท${v(d.allowance_type, 30)}จำนวน${v(d.allowance_days, 10)}วัน รวม${amt(d.allowance)}บาท`)}</Text>
        <Text>{t(`ค่าเช่าที่พักประเภท${v(d.lodging_type, 36)}จำนวน${v(d.lodging_days, 10)}วัน รวม${amt(d.lodging)}บาท`)}</Text>
        <Text>{t(`ค่าพาหนะ${v(d.transport_desc, 60)}รวม${amt(d.transport)}บาท`)}</Text>
        <Text>{t(`ค่าใช้จ่ายอื่น${v(d.other_desc, 56)}รวม${amt(d.other)}บาท`)}</Text>
        <Text style={{ textAlign: "right" }}>{t(`รวมเงินทั้งสิ้น${amt(total)}บาท`)}</Text>
        <Text>{t(`จำนวนเงิน (ตัวอักษร)${total ? ` ${words(total)} ` : dots(70)}`)}</Text>
        <Para
          indent={1.5 * CM}
          text={`ข้าพเจ้าขอรับรองว่ารายการที่กล่าวมาข้างต้นเป็นความจริง และหลักฐานการจ่ายที่ส่งมาด้วย จำนวน${v(d.evidence_count, 12)}ฉบับ รวมทั้งจำนวนเงินที่ขอเบิกถูกต้องตามกฎหมายทุกประการ`}
        />
        <View style={{ marginLeft: CONTENT_W * 0.35, marginTop: 8, alignItems: "center", alignSelf: "flex-start" }} wrap={false}>
          <Text>{t(`ลงชื่อ${dots(45)}ผู้ขอรับเงิน`)}</Text>
          <Text>{t(`(${d.name.trim() || dots(45)})`)}</Text>
          <Text>{t(`ตำแหน่ง${v(d.position, 40)}`)}</Text>
        </View>
      </Page>

      <Page size="A4" style={page}>
        <View style={{ flexDirection: "row", borderTopWidth: B, borderBottomWidth: B }} wrap={false}>
          <View style={{ flex: 1, borderRightWidth: B }}>
            <SignBox title="ได้ตรวจสอบหลักฐานการเบิกจ่ายเงินที่แนบถูกต้องแล้ว เห็นควรอนุมัติให้เบิกจ่ายได้" s={d.checker} />
          </View>
          <SignBox title="อนุมัติให้จ่ายได้" s={d.approver} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Para indent={1.5 * CM} text={`ได้รับเงินค่าใช้จ่ายในการเดินทางไปราชการ จำนวน${amt(total, 30)}บาท (${total ? words(total) : dots(60)}) ไว้เป็นการถูกต้องแล้ว`} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 4 }} wrap={false}>
          <SignBox s={{ name: d.claim_for === "self" ? d.name : "", position: d.claim_for === "self" ? d.position : "" }} suffix="ผู้รับเงิน" />
          <SignBox s={d.payer} suffix="ผู้จ่ายเงิน" />
        </View>
        <View style={{ borderBottomWidth: B, paddingBottom: 6, marginTop: 6 }}>
          <Text>{t(`จากเงินยืมตามสัญญาเลขที่${v(d.loan_no, 40)}วันที่${full(d.loan_date, 30)}`)}</Text>
        </View>
        <View style={{ marginTop: 6, borderBottomWidth: B, paddingBottom: 6 }}>
          {d.note.trim() ? (
            <Para text={`หมายเหตุ ${d.note.trim()}`} />
          ) : (
            <>
              <Text>{t(`หมายเหตุ${dots(110)}`)}</Text>
              {Array.from({ length: 6 }, (_, i) => (
                <Text key={i}>{t(dots(120))}</Text>
              ))}
            </>
          )}
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
  const date = dmy(d.date);
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
        <Text style={{ textAlign: "center" }}>{t(`ชื่อส่วนราชการ${v(d.office, 50)}จังหวัด${v(d.province, 30)}`)}</Text>
        <Text style={{ textAlign: "center", marginBottom: 4 }}>
          {t(`ประกอบใบเบิกค่าใช้จ่ายในการเดินทางของ${v(d.name, 45)}ลงวันที่ ${date.d} เดือน ${date.m} พ.ศ. ${date.y}`)}
        </Text>
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
          <Text>{t(`ลงชื่อ${dots(36)}ผู้จ่ายเงิน`)}</Text>
          <Text>{t(`(${d.payer.name.trim() || dots(36)})`)}</Text>
          <Text>{t(`ตำแหน่ง${v(d.payer.position, 32)}`)}</Text>
          <Text>{t(`วันที่${dots(36)}`)}</Text>
        </View>
      </View>
    </Page>
  );
}
