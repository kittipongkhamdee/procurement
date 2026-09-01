export type Criterion = { min_score: number; max_score: number; label: string };

/** หาความหมายของค่าเฉลี่ยจากเกณฑ์ที่ตั้งไว้ — คืน null ถ้าไม่มีเกณฑ์ครอบคลุมค่านี้ (เช่น ยังไม่ได้
 * ตั้งเกณฑ์ หรือค่าอยู่นอกช่วงทั้งหมด) หน้าที่เรียกใช้ควรซ่อน badge ไปเลยถ้าได้ null */
export function interpretScore(score: number, criteria: Criterion[]): string | null {
  const match = criteria.find((c) => score >= c.min_score && score <= c.max_score);
  return match?.label ?? null;
}
