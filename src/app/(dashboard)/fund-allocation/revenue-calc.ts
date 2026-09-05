// คำนวณประมาณการรายรับ (จำนวนนักเรียน × อัตราต่อคนต่อปี) — ใช้ร่วมกันระหว่างแท็บ "รายรับ" และ
// แท็บ "จัดสรรเงิน" (ตารางสรุปรวมแต่ละรายการ) เพื่อไม่ให้สูตรคำนวณเพี้ยนกันระหว่าง 2 แท็บ

export type GradeKey = "lower_secondary" | "upper_secondary" | "m1" | "m2" | "m3" | "m4" | "m5" | "m6";
export type ItemKey = "teaching" | "student_activity" | "topup" | "equipment" | "uniform" | "textbook";

export const GRADE_LABELS: Record<GradeKey, string> = {
  lower_secondary: "มัธยมศึกษาตอนต้น",
  upper_secondary: "มัธยมศึกษาตอนปลาย",
  m1: "มัธยมศึกษาปีที่ 1",
  m2: "มัธยมศึกษาปีที่ 2",
  m3: "มัธยมศึกษาปีที่ 3",
  m4: "มัธยมศึกษาปีที่ 4",
  m5: "มัธยมศึกษาปีที่ 5",
  m6: "มัธยมศึกษาปีที่ 6",
};

export const MAIN_GRADES: GradeKey[] = ["lower_secondary", "upper_secondary"];
export const TEXTBOOK_GRADES: GradeKey[] = ["m1", "m2", "m3", "m4", "m5", "m6"];
export const LOWER_SECONDARY_GRADES: GradeKey[] = ["m1", "m2", "m3"];
export const UPPER_SECONDARY_GRADES: GradeKey[] = ["m4", "m5", "m6"];

export const ITEM_DEFS: { key: ItemKey; label: string; grades: GradeKey[] | "all" }[] = [
  { key: "teaching", label: "ค่าจัดการเรียนการสอน", grades: MAIN_GRADES },
  { key: "student_activity", label: "ค่ากิจกรรมพัฒนาผู้เรียน", grades: MAIN_GRADES },
  { key: "topup", label: "Topup นร.น้อยกว่า 300 คน", grades: "all" },
  { key: "equipment", label: "ค่าอุปกรณ์การเรียน", grades: MAIN_GRADES },
  { key: "uniform", label: "ค่าเครื่องแบบนักเรียน", grades: MAIN_GRADES },
  { key: "textbook", label: "ค่าหนังสือเรียน", grades: TEXTBOOK_GRADES },
];

export function rateKey(item: ItemKey, grade: GradeKey) {
  return `${item}:${grade}`;
}

// จำนวนนักเรียนของระดับชั้นหนึ่งๆ — กรอกแยกเป็นรายชั้น ม.1-ม.6 ที่แท็บ "นักเรียนและรายหัว" เท่านั้น
// ส่วน "มัธยมศึกษาตอนต้น"/"มัธยมศึกษาตอนปลาย" คำนวณรวมจาก ม.1-3 / ม.4-6 เสมอ ไม่ต้องกรอกซ้ำ
export function gradeCount(grade: GradeKey, counts: Partial<Record<GradeKey, number>>): number {
  if (grade === "lower_secondary") return LOWER_SECONDARY_GRADES.reduce((s, g) => s + (counts[g] ?? 0), 0);
  if (grade === "upper_secondary") return UPPER_SECONDARY_GRADES.reduce((s, g) => s + (counts[g] ?? 0), 0);
  return counts[grade] ?? 0;
}

export function computeItemTotal(
  grades: GradeKey[] | "all",
  itemKey: ItemKey,
  counts: Partial<Record<GradeKey, number>>,
  rates: Record<string, number>,
) {
  const list = grades === "all" ? (["all"] as const) : grades;
  return list.reduce((s, g) => {
    const count =
      g === "all"
        ? gradeCount("lower_secondary", counts) + gradeCount("upper_secondary", counts)
        : gradeCount(g as GradeKey, counts);
    const rate = rates[rateKey(itemKey, g as GradeKey)] ?? 0;
    return s + count * rate;
  }, 0);
}

export function computeAllItemTotals(counts: Partial<Record<GradeKey, number>>, rates: Record<string, number>) {
  return ITEM_DEFS.map((item) => ({
    key: item.key,
    label: item.label,
    total: computeItemTotal(item.grades, item.key, counts, rates),
  }));
}
