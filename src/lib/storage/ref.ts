const GDRIVE_PREFIX = "gdrive:";

export function isDriveRef(ref: string): boolean {
  return ref.startsWith(GDRIVE_PREFIX);
}

/** ลิงก์ภายนอกที่ผู้ใช้วางเองตรงๆ (เช่น ลิงก์แชร์ Google Drive ของตัวเอง) แทนการอัปโหลดไฟล์เข้าระบบ —
 * ต่างจาก isDriveRef ที่หมายถึงไฟล์ที่ระบบอัปโหลดขึ้น Google Drive เองผ่าน service account ลิงก์แบบนี้
 * ระบบไม่ได้เป็นเจ้าของไฟล์ จึงไม่มีสิทธิ์ลบ/สร้าง signed URL ให้ — เปิดตรงๆ ตามลิงก์ที่ผู้ใช้ให้ไว้เลย */
export function isExternalLink(ref: string): boolean {
  return ref.startsWith("http://") || ref.startsWith("https://");
}

export function driveFileId(ref: string): string {
  return ref.slice(GDRIVE_PREFIX.length);
}

export function encodeDriveRef(fileId: string): string {
  return `${GDRIVE_PREFIX}${fileId}`;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** URL รูปภาพโดยตรงสำหรับฝัง <img> (ต่างจาก driveViewUrl ซึ่งเป็นหน้าเว็บสำหรับเปิดดู ไม่ใช่ไฟล์รูป
 * โดยตรง) ใช้ได้เพราะไฟล์ที่อัปโหลดผ่าน driveUpload ตั้งสิทธิ์ "เผยแพร่แบบดูได้" (anyone/reader) ไว้แล้ว */
export function driveThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/** ชื่อไฟล์ที่ใช้แสดงผลจาก ref — ไฟล์ Supabase ใช้ชื่อไฟล์ท้ายพาธ ส่วนไฟล์ Google Drive ไม่มีชื่อเดิมแนบมากับ ref จึงใช้ป้ายกำกับทั่วไปแทน */
export function displayNameForRef(ref: string): string {
  if (isDriveRef(ref)) return "ไฟล์ที่แนบไว้ (Google Drive)";
  return ref.split("/").pop() ?? ref;
}
