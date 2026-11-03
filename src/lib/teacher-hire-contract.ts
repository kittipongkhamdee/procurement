// สัญญาจ้างครูอัตราจ้าง (ผู้ปฏิบัติงานให้ราชการในสถานศึกษา) ชุด 4 ส่วน ตามไฟล์ต้นแบบของโรงเรียน:
//   1) สัญญาจ้าง  2) เงื่อนไขประกอบสัญญาจ้าง  3) สัญญาค้ำประกัน  4) คำยินยอมของคู่สมรสผู้ค้ำประกัน
// เนื้อหาอยู่ที่ไฟล์นี้ที่เดียว แล้วให้ทั้ง PDF (pdf/teacher-hire-document.tsx) และ Word (docx/build-teacher-hire-docx.ts)
// วาดจากบล็อกชุดเดียวกัน ข้อความจึงตรงกันทุกฉบับ — แก้ถ้อยคำสัญญาที่นี่ที่เดียว

import { formatThaiDate, thaiBahtText } from "@/lib/thai";

export type TeacherHireContract = {
  id: string;
  contract_no: string;
  contract_date: string;
  place: string | null;
  employer_name: string | null;
  position_title: string;
  hiree_name: string;
  hiree_age: number | null;
  hiree_id_card: string | null;
  house_no: string | null;
  moo: string | null;
  soi: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  zipcode: string | null;
  phone: string | null;
  months: number | null;
  start_date: string | null;
  end_date: string | null;
  salary: number | null;
  attach_date: string | null;
  guarantor_name: string | null;
  g_house_no: string | null;
  g_moo: string | null;
  g_soi: string | null;
  g_tambon: string | null;
  g_amphoe: string | null;
  g_province: string | null;
  g_zipcode: string | null;
  g_phone: string | null;
  g_birth_date: string | null;
  g_age: number | null;
  g_occupation: string | null;
  g_position: string | null;
  g_workplace: string | null;
  g_salary: number | null;
  g_card_no: string | null;
  g_card_issued_at: string | null;
  g_card_issue_date: string | null;
  g_card_expire_date: string | null;
  spouse_name: string | null;
  spouse_relation: string | null;
  witness1_name: string | null;
  witness2_name: string | null;
};

export type ContractContext = {
  school_name: string;
  /** สังกัด เช่น สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาสุรินทร์ */
  area: string;
  /** ผู้ลงนามฝ่ายผู้ว่าจ้าง (ผู้อำนวยการ) ตามหน้าตั้งค่า */
  director_name: string;
};

/** บล็อกเนื้อหา — ผู้วาด (PDF/Word) แปลงเป็นรูปแบบของตัวเอง */
export type Block =
  | { kind: "title"; text: string; size?: "xl" | "lg" }
  | { kind: "para"; text: string; indent?: boolean }
  | { kind: "clause"; text: string }
  | { kind: "item"; text: string }
  | { kind: "right"; text: string }
  | { kind: "sign"; role: string; name: string; extra?: string[] }
  | { kind: "pagebreak" };

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
export const thaiNum = (n: number | string) => String(n).replace(/\d/g, (d) => THAI_DIGITS[Number(d)]);

const BLANK = "..............................";
const v = (value: string | number | null | undefined, blank = BLANK) => {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s || blank;
};
const dateParts = (iso: string | null | undefined) => {
  if (!iso) return { d: "......", m: "..................", y: "........" };
  const [y, , d] = iso.split("-").map(Number);
  const text = formatThaiDate(iso); // เช่น "1 ตุลาคม 2569"
  const monthName = text.replace(/^\d+\s+/, "").replace(/\s+\d+$/, "");
  return { d: String(d), m: monthName, y: String(y + 543) };
};
const dmy = (iso: string | null | undefined) => {
  const p = dateParts(iso);
  return `${p.d} เดือน ${p.m} พ.ศ. ${p.y}`;
};
const address = (c: { house_no: string | null; moo: string | null; soi: string | null; tambon: string | null; amphoe: string | null; province: string | null; zipcode: string | null }, prefix = "") =>
  `อยู่บ้านเลขที่ ${v(c[`${prefix}house_no` as "house_no"] ?? c.house_no, "........")} หมู่ที่ ${v(c.moo, "......")} ซอย ${v(c.soi, "-")} แขวง/ตำบล ${v(c.tambon)} เขต/อำเภอ ${v(c.amphoe)} จังหวัด ${v(c.province)} รหัสไปรษณีย์ ${v(c.zipcode, ".......")}`;

export function teacherHireFileLabel(c: TeacherHireContract) {
  return `สัญญาจ้างครูอัตราจ้าง-${c.contract_no.replace(/[\\/:*?"<>|]+/g, "-")}-${c.hiree_name}`.replace(/\s+/g, " ");
}

/** ชื่อไฟล์ — เลขที่สัญญาเป็นเลขอารบิกตามที่กรอก (เช่น 7/2569) */
export function buildTeacherHireBlocks(c: TeacherHireContract, ctx: ContractContext): Block[] {
  const pos = c.position_title || "ครูอัตราจ้าง";
  const place = c.place?.trim() || ctx.school_name;
  const director = c.employer_name?.trim() || ctx.director_name;
  const months = c.months ?? 0;
  const monthsText = months ? `${months} เดือน` : "...... เดือน";
  const salaryText = c.salary ? `${c.salary.toLocaleString("th-TH")} บาท ${thaiBahtText(c.salary)}` : "...................... บาท";
  const attach = c.attach_date ?? c.contract_date;
  const hireeAddr = address(c);
  const gAddr = address(
    { house_no: c.g_house_no, moo: c.g_moo, soi: c.g_soi, tambon: c.g_tambon, amphoe: c.g_amphoe, province: c.g_province, zipcode: c.g_zipcode },
  );
  const noText = `สัญญาจ้างเลขที่ ${c.contract_no}`;
  const dirTitle = `ผู้อำนวยการ${ctx.school_name}`;

  const sign = (role: string, name: string | null | undefined, extra: string[] = []): Block => ({ kind: "sign", role, name: name?.trim() ?? "", extra });

  return [
    // ───────── 1) สัญญาจ้าง ─────────
    { kind: "title", text: noText, size: "lg" },
    { kind: "title", text: `(ระยะเวลาจ้าง ${monthsText})`, size: "lg" },
    { kind: "title", text: "สัญญาจ้างอัตราจ้างผู้ปฏิบัติงานให้ราชการในสถานศึกษา", size: "xl" },
    { kind: "title", text: `ตำแหน่ง${pos} ${ctx.school_name}`, size: "lg" },
    { kind: "title", text: "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", size: "lg" },
    {
      kind: "para",
      indent: true,
      text: `สัญญาจ้างฉบับนี้ทำขึ้น ณ ${place} เมื่อวันที่ ${dmy(c.contract_date)} ระหว่าง${ctx.school_name} โดย ${v(director)} ตำแหน่ง ${dirTitle} ${ctx.area} ซึ่งต่อไปนี้ในสัญญานี้เรียกว่า ผู้ว่าจ้าง “ฝ่ายหนึ่ง” กับ ${v(c.hiree_name)} อายุ ${v(c.hiree_age, "......")} ปี หมายเลขบัตรประจำตัวประชาชน ${v(c.hiree_id_card)} ${hireeAddr} โทรศัพท์ ${v(c.phone)} ซึ่งต่อไปในสัญญานี้เรียกว่า ผู้รับจ้าง “อีกฝ่ายหนึ่ง” ทั้งสองฝ่ายได้ตกลงร่วมกันทำสัญญาจ้างไว้ต่อกัน ดังต่อไปนี้`,
    },
    { kind: "clause", text: `ข้อ ๑ ผู้ว่าจ้างตกลงจ้างและผู้รับจ้างตกลงรับจ้างปฏิบัติงานในตำแหน่ง${pos}ผู้ปฏิบัติงานให้ราชการให้แก่${ctx.school_name} ${ctx.area}` },
    { kind: "clause", text: "ข้อ ๒ ผู้รับจ้างมีหน้าที่รับผิดชอบตามภาระงานตามคำสั่งมอบหมายงานตามที่ผู้ว่าจ้างกำหนดไว้ในเอกสารแนบท้ายสัญญาจ้าง และให้ถือว่าเอกสารแนบท้ายสัญญาจ้างดังกล่าวเป็นส่วนหนึ่งของสัญญานี้" },
    { kind: "para", indent: true, text: "ในกรณีมีปัญหาว่างานใดเป็นหน้าที่การงานตามสัญญานี้หรือไม่ หรือกรณีมีข้อสงสัยเกี่ยวกับข้อความของสัญญาหรือข้อความในเอกสารแนบท้ายสัญญาจ้างซึ่งผู้ว่าจ้างวินิจฉัยแล้ว ผู้รับจ้างจะต้องปฏิบัติตามคำวินิจฉัยนั้น" },
    { kind: "clause", text: `ข้อ ๓ ผู้ว่าจ้างตกลงจ้างผู้รับจ้างมีกำหนด ${monthsText} เริ่มตั้งแต่วันที่ ${dmy(c.start_date)} และสิ้นสุดในวันที่ ${dmy(c.end_date)}` },
    { kind: "clause", text: "ข้อ ๔ กำหนดระยะเวลามาปฏิบัติงานให้เป็นไปตามที่สถานศึกษาที่ผู้รับจ้างปฏิบัติหน้าที่อยู่กำหนด" },
    { kind: "clause", text: `ข้อ ๕ ผู้ว่าจ้างตกลงจ่าย และผู้รับจ้างตกลงรับค่าตอบแทนในตำแหน่ง${pos} อัตราเงินเดือน ${salaryText}` },
    { kind: "clause", text: "ข้อ ๖ ผู้รับจ้างอาจได้รับสิทธิประโยชน์อื่นตามระเบียบที่ทางราชการกำหนด" },
    { kind: "clause", text: "ข้อ ๗ ผู้รับจ้างตามสัญญานี้จะไม่ได้รับสิทธิ์ขอปรับเปลี่ยนการจ้างไปเป็นลูกจ้างประจำ พนักงานราชการหรือข้าราชการต่อไป หากผู้ใดประสงค์จะบรรจุเป็นพนักงานราชการ หรือข้าราชการครูต้องดำเนินการสมัครและสอบแข่งขันหรือสอบคัดเลือกตามหลักเกณฑ์วิธีการเงื่อนไขที่ คพร. และ กคศ. กำหนดตามลำดับ" },
    { kind: "clause", text: "ข้อ ๘ ผู้รับจ้างต้องประพฤติปฏิบัติตามกฎหมาย ระเบียบ ข้อบังคับของทางราชการและรักษาวินัยเช่นเดียวกับข้าราชการครูและบุคลากรทางการศึกษา" },
    { kind: "clause", text: "ข้อ ๙ ผู้รับจ้างต้องปฏิบัติงานให้กับทางราชการตามที่ได้รับมอบหมายจากหัวหน้าสถานศึกษาที่ตนปฏิบัติหน้าที่อยู่ด้วยความซื่อสัตย์สุจริต และตั้งใจปฏิบัติงานอย่างเต็มกำลังความสามารถของตนโดยแสวงหาความรู้และทักษะเพิ่มเติม หรือกระทำการใดเพื่อให้ผลงานในหน้าที่มีคุณภาพดีขึ้น ทั้งนี้ต้องรักษาผลประโยชน์และชื่อเสียงของทางราชการและไม่เปิดเผยความลับหรือข้อมูลของทางราชการให้ผู้หนึ่งผู้ใดทราบโดยมิได้รับอนุญาตจากผู้รับผิดชอบงานนั้นๆ" },
    { kind: "clause", text: "ข้อ ๑๐ ในกรณีผู้รับจ้างละทิ้งงานหรือก่อให้เกิดความเสียหายอย่างใดๆ ในระหว่างอายุสัญญาจะต้องชดใช้ค่าเสียหายหรืออาจถูกหักค่าจ้างเพื่อชดใช้ค่าเสียหายได้ เว้นแต่ความเสียหายนั้นเกิดจากเหตุสุดวิสัย" },
    { kind: "clause", text: "ข้อ ๑๑ ในกรณีสร้างสรรค์งานขึ้นใหม่ในระหว่างอายุสัญญา ให้สิทธิ์ของผลงานดังกล่าวเป็นกรรมสิทธิ์ของหน่วยงานราชการที่ตนปฏิบัติอยู่" },
    { kind: "clause", text: "ข้อ ๑๒ สัญญานี้สิ้นสุดลงเมื่อเข้ากรณีใดกรณีหนึ่ง ดังต่อไปนี้" },
    { kind: "item", text: "ครบกำหนดสัญญาจ้าง" },
    { kind: "item", text: "ผู้รับจ้างตาย" },
    { kind: "item", text: "ผู้รับจ้างลาออก" },
    { kind: "item", text: "ผู้รับจ้างถูกจำคุกโดยคำพิพากษา" },
    { kind: "item", text: "ผู้รับจ้างผิดสัญญาจ้างข้อใดข้อหนึ่งที่ก่อให้เกิดความเสียหายอย่างร้ายแรง" },
    { kind: "item", text: "ผู้รับจ้างเป็นบุคคลล้มละลาย" },
    { kind: "para", indent: true, text: `สัญญานี้ทำขึ้นสองฉบับมีข้อความถูกต้องตรงกัน คู่สัญญาได้อ่านตรวจสอบ และเข้าใจความในสัญญาโดยละเอียดแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน ณ วัน เดือน ปี ดังกล่าวข้างต้น และส่งมอบ${ctx.school_name} ๑ ชุด ผู้รับจ้าง ๑ ชุด` },
    sign("ผู้ว่าจ้าง", director, [`ตำแหน่ง ${dirTitle}`]),
    sign("ผู้รับจ้าง", c.hiree_name),
    sign("พยาน", c.witness1_name),
    sign("พยาน", c.witness2_name),

    // ───────── 2) เงื่อนไขประกอบสัญญาจ้าง ─────────
    { kind: "pagebreak" },
    { kind: "title", text: "เงื่อนไขประกอบสัญญาจ้าง", size: "xl" },
    { kind: "title", text: `แนบท้าย${noText} ลงวันที่ ${dmy(c.contract_date)}`, size: "lg" },
    { kind: "title", text: `${ctx.school_name} สังกัด${ctx.area}`, size: "lg" },
    {
      kind: "para",
      indent: true,
      text: `การจัดทำสัญญาจ้าง ตาม${noText} ลงวันที่ ${dmy(c.contract_date)} ข้าพเจ้า ${v(c.hiree_name)} อายุ ${v(c.hiree_age, "......")} ปี หมายเลขบัตรประจำตัวประชาชน ${v(c.hiree_id_card)} ${hireeAddr} โทรศัพท์ ${v(c.phone)} ได้เข้าใจและยินยอมรับในเงื่อนไขประกอบการทำสัญญาจ้าง ดังนี้`,
    },
    { kind: "clause", text: `๑. การจัดทำสัญญาจ้างครั้งนี้ ได้จัดทำสัญญาจ้างระยะเวลา ${months ? thaiNum(months) : "......"} เดือน เมื่อครบตามกำหนดสัญญาจ้างดังกล่าว ข้าพเจ้ายินยอมปฏิบัติตามเงื่อนไขในสัญญาจ้างตามข้อ ๒.` },
    { kind: "clause", text: "๒. หากข้าพเจ้าไม่สามารถเดินทางไปปฏิบัติงานตามข้อ ๒. ได้ ให้ถือว่าข้าพเจ้าสิ้นสุดสภาพตามสัญญาจ้าง และจะไม่เรียกร้องสิทธิใดๆ ทั้งสิ้น" },
    sign("ผู้ว่าจ้าง", director, [`ตำแหน่ง ${dirTitle}`]),
    sign("ผู้รับจ้าง", c.hiree_name),
    sign("พยาน", c.witness1_name),
    sign("พยาน", c.witness2_name),

    // ───────── 3) สัญญาค้ำประกัน ─────────
    { kind: "pagebreak" },
    { kind: "title", text: "สัญญาค้ำประกัน", size: "xl" },
    { kind: "title", text: "อัตราจ้างผู้ปฏิบัติงานให้ราชการในสถานศึกษา", size: "lg" },
    { kind: "title", text: `ตำแหน่ง${pos}`, size: "lg" },
    { kind: "title", text: "สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน", size: "lg" },
    { kind: "right", text: `เขียนที่${place}` },
    { kind: "right", text: `วันที่ ${dmy(attach)}` },
    {
      kind: "para",
      indent: true,
      text: `ตามที่ ${v(c.hiree_name)} ผู้รับจ้างได้ทำสัญญาจ้างอัตราจ้างผู้ปฏิบัติงานให้ราชการ ตำแหน่ง${pos} ไว้กับ ${v(director)} ตำแหน่ง ${dirTitle} ${ctx.area} ผู้รับมอบอำนาจ ผู้ว่าจ้าง ตาม${noText} ลงวันที่ ${dmy(c.contract_date)} นั้น`,
    },
    {
      kind: "para",
      indent: true,
      text: `ข้าพเจ้า ${v(c.guarantor_name)} ${gAddr} โทรศัพท์ ${v(c.g_phone)} เกิดเมื่อวันที่ ${dmy(c.g_birth_date)} อายุ ${v(c.g_age, "......")} ปี อาชีพ ${v(c.g_occupation)} ตำแหน่ง ${v(c.g_position)} สังกัดหน่วยงาน ${v(c.g_workplace)} อัตราเงินเดือน ${c.g_salary ? c.g_salary.toLocaleString("th-TH") : "......................"} บาท บัตรประจำตัวเลขที่ ${v(c.g_card_no)} ออก ณ ${v(c.g_card_issued_at)} วันออกบัตร ${dmy(c.g_card_issue_date)} บัตรหมดอายุ ${dmy(c.g_card_expire_date)} ซึ่งต่อไปนี้ในสัญญาเรียกว่า “ผู้ค้ำประกัน” ตกลงทำสัญญาค้ำประกัน ${v(c.hiree_name)} โดยมีข้อความดังต่อไปนี้`,
    },
    { kind: "clause", text: "๑. ผู้ค้ำประกันตกลงผูกพันตนค้ำประกันผู้รับจ้างต่อผู้ว่าจ้างโดยตกลงร่วมรับผิดในฐานะเป็นลูกหนี้ร่วมกับผู้รับจ้างและผู้ค้ำประกันยินยอมชำระหนี้ตามข้อผูกพันที่ระบุไว้ในสัญญาจ้างอัตราจ้างชั่วคราวทั้งสิ้นทุกประการให้แก่ผู้ว่าจ้างเมื่อเรียกร้องทันทีโดยผู้ว่าจ้างมิจำต้องเรียกร้องให้ผู้รับจ้างชำระหนี้ก่อน และผู้ค้ำประกันจะรับผิดตามสัญญานี้ตลอดไปจนกว่าจะชำระหนี้ครบเต็มจำนวน ในกรณีที่ผู้รับจ้างผิดสัญญาจ้างไม่ว่าจะกระทำหรืองดเว้นการกระทำอย่างใดอย่างหนึ่งโดยมิชอบหรือกระทำละเมิดต่อผู้อื่นจนเป็นเหตุให้เกิดความเสียหายแก่ผู้ว่าจ้าง ไม่ว่าผลแห่งการกระทำความผิดนั้นจะได้ปรากฏในขณะที่ยังเป็นผู้รับจ้างอยู่หรือปรากฏเมื่อพ้นสภาพจากการเป็นผู้รับจ้างไปแล้วก็ตาม" },
    { kind: "clause", text: "๒. ในกรณีที่ผู้ว่าจ้างผ่อนเวลาหรือผ่อนจำนวนเงินในการชำระหนี้ตามสัญญาจ้างให้แก่ผู้รับจ้างโดยจะแจ้งหรือมิได้แจ้งให้ผู้ค้ำประกันทราบก็ตาม ให้ถือว่าผู้ค้ำประกันตกลงยินยอมในการผ่อนเวลาหรือผ่อนจำนวนเงินในการชำระหนี้นั้นด้วยทุกครั้ง และผู้ค้ำประกันตกลงมิให้ถือเอาการผ่อนเวลาหรือผ่อนจำนวนเงินในการชำระหนี้ดังกล่าวเป็นเหตุปลดเปลื้องความรับผิดของผู้ค้ำประกัน และจะรับผิดในฐานะผู้ค้ำประกันตามสัญญานี้ตลอดไปจนกว่าจะมีการชำระหนี้ครบเต็มตามจำนวน" },
    { kind: "clause", text: "๓. ผู้ค้ำประกันไม่เพิกถอนการค้ำประกันตลอดระยะเวลาที่ผู้รับจ้างจะต้องรับผิดชอบอยู่ตามเงื่อนไขในสัญญาจ้าง ผู้ค้ำประกันได้อ่านและเข้าใจข้อความแห่งสัญญานี้โดยตลอดแล้ว เห็นว่าถูกต้องตรงตามเจตนารมณ์ และยินยอมปฏิบัติตามสัญญานี้ทุกประการ จึงได้ลงลายมือชื่อไว้เป็นสำคัญต่อหน้าพยาน" },
    sign("ผู้ค้ำประกัน", c.guarantor_name),
    sign("พยาน", c.witness1_name),
    sign("พยาน", c.witness2_name),

    // ───────── 4) คำยินยอมของคู่สมรสผู้ค้ำประกัน ─────────
    { kind: "pagebreak" },
    { kind: "title", text: "คำยินยอมของคู่สมรสผู้ค้ำประกัน", size: "xl" },
    { kind: "right", text: `เขียนที่ ${place}` },
    { kind: "right", text: `วันที่ ${dmy(attach)}` },
    {
      kind: "para",
      indent: true,
      text: `ข้าพเจ้า ${v(c.spouse_name)} ${c.spouse_relation === "ภรรยา" ? "ภรรยา" : c.spouse_relation === "สามี" ? "สามี" : "สามี/ภรรยา"}ของ ${v(c.guarantor_name)} ยินยอมให้ ${v(c.guarantor_name)} ทำสัญญาฉบับนี้ได้ เพื่อค้ำประกัน (ชื่อผู้รับจ้าง) ${v(c.hiree_name)} ปฏิบัติงาน ตำแหน่ง${pos} ให้แก่${ctx.school_name} สังกัด ${ctx.area}`,
    },
    sign("ผู้ให้คำยินยอม (คู่สมรสผู้ค้ำประกัน)", c.spouse_name),
    sign("พยาน", c.witness1_name),
    sign("พยาน", c.witness2_name),
  ];
}
