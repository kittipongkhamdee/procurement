// รูปแบบเริ่มต้นของเลขครุภัณฑ์ (ก่อนแอดมินปรับเองที่หน้าตั้งค่าระบบ) — ตรงกับรูปแบบเดิมที่ hardcode
// ไว้ก่อนเพิ่มฟีเจอร์นี้ทุกประการ: "ต.บ.ว. 20.01 / 005 / 69"
export const DEFAULT_ASSET_CODE_TEMPLATE = "{prefix} {type_code}.{item_code} / {seq:3} / {yy}";

/** แทนค่าตัวแปรในรูปแบบ {key} หรือ {key:จำนวนหลัก} (เติม 0 นำหน้าให้ครบจำนวนหลัก) ด้วยค่าจริงจาก vars
 * — ฟังก์ชัน pure ไม่มี dependency ฝั่ง server ใช้ร่วมกันได้ทั้งตอนสร้างเลขจริง (server action) และ
 * ตอนแสดงตัวอย่างในหน้าตั้งค่า (client component) */
export function renderNumberTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)(?::(\d+))?\}/g, (_match, key: string, width?: string) => {
    const value = vars[key];
    if (value === undefined) return "";
    return width ? String(value).padStart(Number(width), "0") : String(value);
  });
}
