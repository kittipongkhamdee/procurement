// บัญชีรับ-จ่ายเงินสถานศึกษา (/finance/ledger) — แทนไฟล์ Excel "โปรแกรมการเงินโรงเรียน" (ชีต DATA/M1/คงเหลือประจำวัน/ทะเบียนรายเดือน)
// ยอดเงินแยก 3 ช่องตามรายงานเงินคงเหลือประจำวัน: เงินสด / เงินฝากธนาคาร / เงินฝากส่วนราชการผู้เบิก
// รายการ: รับ (เข้าช่องปลายทาง) / จ่าย (ออกจากช่องต้นทาง) / โอนระหว่างช่อง (เช่น ถอนเงินฝากมาเป็นเงินสด, นำเงินสดฝากธนาคาร)
// เลขที่เอกสาร: บร = ใบเสร็จรับเงิน (เล่มที่/เลขที่ตามเล่ม กรอกเอง), บค = ใบสำคัญรับเงิน (ผู้รับไม่มีใบเสร็จ),
// บจ = ใบเสร็จรับเงินจากผู้ขาย/บริษัท — บค/บจ รันเลขตามปีงบประมาณ (บค 1/2570)

export type Pocket = "cash" | "bank" | "gov";
export type TxnKind = "receive" | "pay" | "transfer";
export type DocKind = "บร" | "บค" | "บจ";

export const POCKETS: Pocket[] = ["cash", "bank", "gov"];
export const POCKET_LABEL: Record<Pocket, string> = { cash: "เงินสด", bank: "เงินฝากธนาคาร", gov: "เงินฝากส่วนราชการผู้เบิก" };
export const POCKET_SHORT: Record<Pocket, string> = { cash: "เงินสด", bank: "ธนาคาร", gov: "ส่วนราชการ" };
export const KIND_LABEL: Record<TxnKind, string> = { receive: "รับ", pay: "จ่าย", transfer: "โอน/ถอน/ฝาก" };
export const DOC_KINDS: { value: DocKind; label: string; hint: string }[] = [
  { value: "บค", label: "บค. ใบสำคัญรับเงิน", hint: "จ่ายให้บุคคลที่ออกใบเสร็จไม่ได้ (เช่น ค่าจ้างแม่ครัว จ้างเหมาบุคคล) — ผู้รับเงินเซ็นใบสำคัญรับเงินพร้อมสำเนาบัตรประชาชน" },
  { value: "บจ", label: "บจ. ใบเสร็จรับเงิน (ผู้ขาย)", hint: "ร้านค้า/บริษัท/หน่วยงานออกใบเสร็จรับเงินให้ (เช่น ซื้อวัสดุ ค่าไฟฟ้า ค่าน้ำ)" },
  { value: "บร", label: "บร. ใบเสร็จรับเงิน (โรงเรียนออก)", hint: "รับเงิน — กรอกเล่มที่/เลขที่ตามเล่มใบเสร็จของโรงเรียน" },
];

export type MoneyType = { id: string; name: string; category: string | null; account_id: string | null; sort_order: number; is_active: boolean };
export type FinAccount = { id: string; name: string; bank_name: string | null; account_no: string | null; sort_order: number; is_active: boolean };
export type Opening = { fiscal_year: number; money_type_id: string; cash: number; bank: number; gov: number };
export type FinTxn = {
  id: string;
  fiscal_year: number;
  txn_date: string;
  kind: TxnKind;
  from_pocket: Pocket | null;
  to_pocket: Pocket | null;
  doc_kind: DocKind | null;
  doc_seq: number | null;
  doc_no: string | null;
  description: string;
  payee: string | null;
  amount: number;
  money_type_id: string;
  project_id: string | null;
  activity_id: string | null;
  note: string | null;
  created_at: string;
};

export type Balance = Record<Pocket, number>;
export const zero = (): Balance => ({ cash: 0, bank: 0, gov: 0 });
export const total = (b: Balance) => round2(b.cash + b.bank + b.gov);
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** ปีงบประมาณ พ.ศ. ของวันที่ ISO (ต.ค. ขึ้นปีใหม่) */
export function fiscalYearOf(iso: string): number {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}
/** ช่วงวันที่ของปีงบประมาณ พ.ศ. (1 ต.ค. – 30 ก.ย.) */
export function fiscalRange(fy: number): [string, string] {
  return [`${fy - 544}-10-01`, `${fy - 543}-09-30`];
}
/** เดือนของปีงบ (ต.ค. → ก.ย.) เป็น "YYYY-MM" */
export function fiscalMonths(fy: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((9 + i) % 12) + 1;
    const y = fy - 543 - (m >= 10 ? 1 : 0);
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}
const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export function thaiMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

/** ผลของรายการต่อยอด 3 ช่อง */
export function effect(t: Pick<FinTxn, "kind" | "from_pocket" | "to_pocket" | "amount">): Balance {
  const d = zero();
  const a = Number(t.amount);
  if (t.kind === "receive" && t.to_pocket) d[t.to_pocket] += a;
  if (t.kind === "pay" && t.from_pocket) d[t.from_pocket] -= a;
  if (t.kind === "transfer" && t.from_pocket && t.to_pocket) {
    d[t.from_pocket] -= a;
    d[t.to_pocket] += a;
  }
  return d;
}
export function addBal(a: Balance, b: Balance): Balance {
  return { cash: round2(a.cash + b.cash), bank: round2(a.bank + b.bank), gov: round2(a.gov + b.gov) };
}

/** ยอดคงเหลือแยกประเภทเงิน ณ สิ้นวัน upTo (รวมยอดยกมาของปีงบ) */
export function balancesByType(openings: Opening[], txns: FinTxn[], upTo?: string): Map<string, Balance> {
  const m = new Map<string, Balance>();
  for (const o of openings) m.set(o.money_type_id, { cash: Number(o.cash), bank: Number(o.bank), gov: Number(o.gov) });
  for (const t of txns) {
    if (upTo && t.txn_date > upTo) continue;
    m.set(t.money_type_id, addBal(m.get(t.money_type_id) ?? zero(), effect(t)));
  }
  return m;
}

/** รับ/จ่ายของรายการในมุมทะเบียนคุม — โอนระหว่างช่องไม่นับเป็นรับหรือจ่าย */
export const receiveOf = (t: FinTxn) => (t.kind === "receive" ? Number(t.amount) : 0);
export const payOf = (t: FinTxn) => (t.kind === "pay" ? Number(t.amount) : 0);

/** เลขที่เอกสารที่แสดง: บค/บจ = "บค 3/2570", บร = ตามที่กรอก */
export function docLabel(t: Pick<FinTxn, "doc_kind" | "doc_seq" | "doc_no" | "fiscal_year">): string {
  if ((t.doc_kind === "บค" || t.doc_kind === "บจ") && t.doc_seq) return `${t.doc_kind} ${t.doc_seq}/${t.fiscal_year}`;
  if (t.doc_kind === "บร") return t.doc_no ? `บร ${t.doc_no}` : "บร";
  return t.doc_no ?? "";
}

export function sortTxns<T extends Pick<FinTxn, "txn_date" | "created_at">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.txn_date.localeCompare(b.txn_date) || a.created_at.localeCompare(b.created_at));
}

export type RegisterRow = { txn: FinTxn; receive: number; pay: number; balance: Balance };
/** ทะเบียนคุมเงินประเภทหนึ่งของเดือนหนึ่ง — ยอดยกมา (ยกมาต้นปี + รายการก่อนเดือนนี้), แถวรายการพร้อมยอดคงเหลือสะสม, รวมเดือน/ต้นปี */
export function registerForMonth(opening: Balance, txns: FinTxn[], ym: string) {
  const sorted = sortTxns(txns);
  let bal = { ...opening };
  let ytdReceive = 0;
  let ytdPay = 0;
  for (const t of sorted) {
    if (t.txn_date.slice(0, 7) >= ym) break;
    bal = addBal(bal, effect(t));
    ytdReceive += receiveOf(t);
    ytdPay += payOf(t);
  }
  const broughtForward = { ...bal };
  const rows: RegisterRow[] = [];
  let mReceive = 0;
  let mPay = 0;
  for (const t of sorted.filter((x) => x.txn_date.slice(0, 7) === ym)) {
    bal = addBal(bal, effect(t));
    rows.push({ txn: t, receive: receiveOf(t), pay: payOf(t), balance: { ...bal } });
    mReceive += receiveOf(t);
    mPay += payOf(t);
  }
  return {
    broughtForward,
    rows,
    month: { receive: round2(mReceive), pay: round2(mPay) },
    ytd: { receive: round2(ytdReceive + mReceive), pay: round2(ytdPay + mPay) },
    carriedForward: bal,
  };
}

/** หมวดในรายงานเงินคงเหลือประจำวัน (ตามลำดับประเภทเงิน) */
export function groupByCategory<T extends Pick<MoneyType, "category" | "sort_order" | "name">>(types: T[]): { category: string; types: T[] }[] {
  const out: { category: string; types: T[] }[] = [];
  for (const t of [...types].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "th"))) {
    const c = t.category?.trim() || t.name;
    const g = out.find((x) => x.category === c);
    if (g) g.types.push(t);
    else out.push({ category: c, types: [t] });
  }
  return out;
}

/** ผู้ลงนามรายงานเงินคงเหลือประจำวัน — เก็บใน fin_settings */
export const FIN_SIGNER_KEYS = [
  { key: "fin_officer", label: "เจ้าหน้าที่การเงิน (ผู้จัดทำรายงาน)" },
  { key: "fin_committee_1", label: "คณะกรรมการเก็บรักษาเงิน คนที่ 1" },
  { key: "fin_committee_2", label: "คณะกรรมการเก็บรักษาเงิน คนที่ 2" },
  { key: "fin_committee_3", label: "คณะกรรมการเก็บรักษาเงิน คนที่ 3" },
  { key: "fin_head", label: "หัวหน้าหน่วยงานย่อย (ผู้อำนวยการ)" },
] as const;
export type FinSignerKey = (typeof FIN_SIGNER_KEYS)[number]["key"];
