export type Stats = { avg: number; sd: number; cv: number | null };

/** ค่าเฉลี่ย + ส่วนเบี่ยงเบนมาตรฐาน (แบบประชากร หาร n) + สัมประสิทธิ์ความแปรปรวน (CV% = SD/ค่าเฉลี่ย
 * x 100) — cv เป็น null เมื่อค่าเฉลี่ยเป็น 0 (หารด้วยศูนย์ไม่ได้) ให้หน้าที่เรียกใช้ซ่อนค่า CV% ไปเลย */
export function computeStats(values: number[]): Stats {
  const n = values.length;
  if (n === 0) return { avg: 0, sd: 0, cv: null };
  const avg = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  const cv = avg !== 0 ? (sd / avg) * 100 : null;
  return { avg, sd, cv };
}
