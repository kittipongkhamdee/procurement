// บัญชีวัสดุ — ประเภทวัสดุตามหลักการจำแนกประเภทรายจ่ายตามงบประมาณ และการคำนวณยอดคงเหลือแบบ FIFO
// (แถวจ่ายผูกกับล็อตรับ lot_id ราคาจ่าย = ราคาของล็อตนั้น)

export const STOCK_CATEGORIES = [
  { name: "วัสดุสำนักงาน", prefix: "วส" },
  { name: "วัสดุไฟฟ้าและวิทยุ", prefix: "วฟ" },
  { name: "วัสดุงานบ้านงานครัว", prefix: "วบ" },
  { name: "วัสดุก่อสร้าง", prefix: "วช" },
  { name: "วัสดุยานพาหนะและขนส่ง", prefix: "วย" },
  { name: "วัสดุเชื้อเพลิงและหล่อลื่น", prefix: "วน" },
  { name: "วัสดุวิทยาศาสตร์หรือการแพทย์", prefix: "ววท" },
  { name: "วัสดุการเกษตร", prefix: "วก" },
  { name: "วัสดุโฆษณาและเผยแพร่", prefix: "วฆ" },
  { name: "วัสดุคอมพิวเตอร์", prefix: "วค" },
  { name: "วัสดุการศึกษา", prefix: "วศ" },
  { name: "วัสดุกีฬา", prefix: "วกฬ" },
  { name: "วัสดุเครื่องแต่งกาย", prefix: "วต" },
  { name: "วัสดุอื่น", prefix: "วอ" },
] as const;

/** รหัสถัดไปของประเภท เช่น วส-003 */
export function nextStockCode(category: string, existing: (string | null)[]) {
  const prefix = STOCK_CATEGORIES.find((c) => c.name === category)?.prefix ?? "วอ";
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = existing.reduce((m, c) => {
    const hit = c ? re.exec(c.trim()) : null;
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** ประเภทวัสดุโดยประมาณจากชื่อ (ผู้ใช้เปลี่ยนได้) */
export function guessStockCategory(name: string) {
  const n = name;
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has("หลอดไฟ", "สายไฟ", "ปลั๊ก", "สวิตช์", "ถ่าน", "แบตเตอรี่", "เบรกเกอร์")) return "วัสดุไฟฟ้าและวิทยุ";
  if (has("หมึก", "เมาส์", "คีย์บอร์ด", "แฟลชไดร์ฟ", "ฮาร์ดดิสก์", "โทนเนอร์", "ตลับ")) return "วัสดุคอมพิวเตอร์";
  if (has("น้ำยา", "ไม้กวาด", "ถุงขยะ", "ผงซักฟอก", "สบู่", "แก้ว", "จาน", "ถัง", "ผ้าถู", "ไม้ถู")) return "วัสดุงานบ้านงานครัว";
  if (has("ปูน", "ทราย", "เหล็ก", "ตะปู", "สี", "ไม้", "ท่อ", "กระเบื้อง", "เสา")) return "วัสดุก่อสร้าง";
  if (has("ปุ๋ย", "เมล็ด", "อาหารปลา", "ยาฆ่า", "ดิน", "กระถาง", "คราด", "จอบ", "เสียม")) return "วัสดุการเกษตร";
  if (has("ลูกฟุตบอล", "ลูกบอล", "ตะกร้อ", "แบดมินตัน", "ไม้ปิงปอง", "ลูกวอลเลย์")) return "วัสดุกีฬา";
  if (has("น้ำมัน")) return "วัสดุเชื้อเพลิงและหล่อลื่น";
  if (has("ไวนิล", "ป้าย", "โปสเตอร์")) return "วัสดุโฆษณาและเผยแพร่";
  return "วัสดุสำนักงาน";
}

export type StockMove = {
  id: string;
  item_id: string;
  move_date: string;
  kind: "in" | "out";
  qty: number;
  requested_qty: number | null;
  unit_price: number;
  party: string | null;
  doc_no: string | null;
  note: string | null;
  source_type: string | null;
  source_id: string | null;
  lot_id: string | null;
  requisition_id: string | null;
  created_at: string;
};

/** เรียงตามวันที่ แล้วรับก่อนจ่ายในวันเดียวกัน แล้วตามเวลาที่บันทึก */
export function sortMoves<T extends Pick<StockMove, "move_date" | "kind" | "created_at">>(moves: T[]) {
  return [...moves].sort(
    (a, b) => a.move_date.localeCompare(b.move_date) || (a.kind === b.kind ? 0 : a.kind === "in" ? -1 : 1) || a.created_at.localeCompare(b.created_at),
  );
}

/** ล็อตรับที่ยังเหลือ (FIFO) — เรียงล็อตเก่าก่อน */
export function openLots(moves: StockMove[]) {
  const used = new Map<string, number>();
  moves.filter((m) => m.kind === "out" && m.lot_id).forEach((m) => used.set(m.lot_id!, (used.get(m.lot_id!) ?? 0) + Number(m.qty)));
  return sortMoves(moves.filter((m) => m.kind === "in"))
    .map((m) => ({ lot: m, left: Math.round((Number(m.qty) - (used.get(m.id) ?? 0)) * 1000) / 1000 }))
    .filter((l) => l.left > 0);
}

/** ยอดคงเหลือและมูลค่าคงเหลือ (ตามราคาของล็อตที่ยังเหลือ) */
export function stockBalance(moves: StockMove[]) {
  const lots = openLots(moves);
  const qty = lots.reduce((s, l) => s + l.left, 0);
  const value = lots.reduce((s, l) => s + l.left * Number(l.lot.unit_price), 0);
  return { qty: Math.round(qty * 1000) / 1000, value: Math.round(value * 100) / 100 };
}

/** แบ่งจำนวนที่จะจ่ายออกเป็นส่วนตามล็อต FIFO — จำนวนเกินคงเหลือคืน null */
export function allocateFifo(moves: StockMove[], qty: number) {
  let need = qty;
  const parts: { lotId: string; qty: number; unitPrice: number }[] = [];
  for (const l of openLots(moves)) {
    if (need <= 0) break;
    const take = Math.min(need, l.left);
    parts.push({ lotId: l.lot.id, qty: take, unitPrice: Number(l.lot.unit_price) });
    need = Math.round((need - take) * 1000) / 1000;
  }
  return need > 0 ? null : parts;
}

/** แถวในบัญชีวัสดุพร้อมคงเหลือสะสม (จำนวน) และมูลค่าคงเหลือ ณ แถวนั้น */
export function ledgerRows(moves: StockMove[]) {
  const sorted = sortMoves(moves);
  let balance = 0;
  const seen: StockMove[] = [];
  return sorted.map((m) => {
    seen.push(m);
    balance += m.kind === "in" ? Number(m.qty) : -Number(m.qty);
    return { move: m, balance: Math.round(balance * 1000) / 1000, value: stockBalance(seen).value };
  });
}
