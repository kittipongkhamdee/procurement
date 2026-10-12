// ค่าคงที่/ตัวช่วยของรูปทรัพย์สินใน Supabase Storage (bucket private "asset-photos")
// นอกจากรูปหลักที่พาธ P แล้ว ยังเก็บ "รูปย่อ" ขนาดเล็ก (~320px, ไม่กี่สิบ kB) ไว้ที่ thumbs/P ไว้ใช้ในรายการ/หน้าที่แสดงรูปหลายใบ
// เพื่อลดปริมาณข้อมูลที่ส่งออก (egress) — โหลดรูปหลักเฉพาะตอนต้องดูรูปเต็มจริงๆ

export const ASSET_PHOTO_BUCKET = "asset-photos";
/** ที่เก็บรูปต้นฉบับสำรองก่อนย่อรูปเก่า (เครื่องมือ "ย่อรูปทรัพย์สินเก่า" ในหน้าตั้งค่า) */
export const ASSET_PHOTO_BACKUP_BUCKET = "asset-photos-backup";
export const THUMB_PREFIX = "thumbs/";

export function thumbPathFor(path: string) {
  return `${THUMB_PREFIX}${path}`;
}
