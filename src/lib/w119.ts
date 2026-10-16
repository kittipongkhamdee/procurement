// ว.119 — ค่าคงที่/ฟังก์ชันที่ใช้ร่วมกันทั้งฟอร์ม server action และ PDF

/** วงเงินจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน 10,000 บาท */
export const W119_LIMIT = 10000;

/** วันทำการที่ n ถัดจากวันที่ ISO (ข้ามเสาร์-อาทิตย์ ไม่นับวันหยุดนักขัตฤกษ์) */
export function addWorkingDays(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}
