const GDRIVE_PREFIX = "gdrive:";

export function isDriveRef(ref: string): boolean {
  return ref.startsWith(GDRIVE_PREFIX);
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

/** ชื่อไฟล์ที่ใช้แสดงผลจาก ref — ไฟล์ Supabase ใช้ชื่อไฟล์ท้ายพาธ ส่วนไฟล์ Google Drive ไม่มีชื่อเดิมแนบมากับ ref จึงใช้ป้ายกำกับทั่วไปแทน */
export function displayNameForRef(ref: string): string {
  if (isDriveRef(ref)) return "ไฟล์ที่แนบไว้ (Google Drive)";
  return ref.split("/").pop() ?? ref;
}
