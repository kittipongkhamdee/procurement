// ย่อ/บีบอัดรูปฝั่ง client ด้วย canvas ก่อนอัปโหลด — รูปจากกล้องมือถือมักมีขนาดหลาย MB ทำให้อัปโหลด
// ช้าและเสี่ยงชนขีดจำกัดขนาด payload ของเซิร์ฟเวอร์ ย่อไว้ก่อนช่วยทั้งความเร็วและพื้นที่จัดเก็บ
// แยก 3 แบบตามลักษณะการใช้งาน:
// - compressPhotoFile: ใช้กับภาพถ่ายจริง (เช่น รูปกิจกรรมในรายงานโครงการ) แปลงเป็น JPEG เสมอเพราะ
//   ไม่มีพื้นหลังโปร่งใสให้ต้องรักษาไว้ และ JPEG บีบอัดได้ดีกว่าสำหรับภาพถ่าย
// - resizeLogoFile: ใช้กับโลโก้/ไอคอน คงชนิดไฟล์เดิมไว้ (PNG/WebP) เพื่อไม่ให้พื้นหลังโปร่งใสหายไป
//   และข้าม SVG ไปเลยเพราะเป็นภาพเวกเตอร์ไม่มีขนาดพิกเซลตายตัวให้ย่อ
// - resizeAvatarFile: ใช้กับรูปประจำตัวผู้ใช้ ย่อเป็นภาพขนาดเล็ก (thumbnail) กว่ารูปถ่ายทั่วไปมาก
//   เพราะแสดงแค่วงกลมเล็กๆ ในแถบเมนู แปลงเป็น JPEG เสมอเหมือน compressPhotoFile

// รูปถ่ายทั่วไป: ด้านยาว 1280px คุณภาพ JPEG 75% ให้ได้ราว 100-200 kB ต่อรูป (เดิม 1600px/82% ได้ราว 300-500 kB)
// เพื่อลดปริมาณข้อมูลที่ส่งออกจาก Supabase (egress) — ยังคมพอสำหรับดูรูปเต็มและพิมพ์ในเอกสาร
const DEFAULT_PHOTO_MAX_DIMENSION = 1280;
const DEFAULT_PHOTO_JPEG_QUALITY = 0.75;
// รูป JPEG ที่ขนาดพิกเซลไม่เกินกำหนดอยู่แล้ว แต่ไฟล์ยังใหญ่กว่านี้ จะถูกบีบอัดใหม่ด้วย
const PHOTO_SKIP_RECOMPRESS_BYTES = 250 * 1024;
const DEFAULT_THUMB_MAX_DIMENSION = 320;
const DEFAULT_THUMB_JPEG_QUALITY = 0.7;
const DEFAULT_LOGO_MAX_DIMENSION = 512;
const DEFAULT_AVATAR_MAX_DIMENSION = 256;
const DEFAULT_AVATAR_JPEG_QUALITY = 0.85;

export async function compressPhotoFile(
  file: File,
  maxDimension = DEFAULT_PHOTO_MAX_DIMENSION,
  jpegQuality = DEFAULT_PHOTO_JPEG_QUALITY,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const needsResize = bitmap.width > maxDimension || bitmap.height > maxDimension;
  if (!needsResize && file.type === "image/jpeg" && file.size <= PHOTO_SKIP_RECOMPRESS_BYTES) return file;

  const scale = needsResize ? maxDimension / Math.max(bitmap.width, bitmap.height) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));
  if (!blob) return file;
  // บีบแล้วไม่เล็กลง (เช่น JPEG บีบมาดีอยู่แล้ว) — ใช้ไฟล์เดิม ไม่ทำให้ใหญ่ขึ้น
  if (!needsResize && blob.size >= file.size) return file;
  return new File([blob], file.name, { type: "image/jpeg" });
}

// รูปย่อ (thumbnail) สำหรับแสดงในรายการ — JPEG เสมอ ด้านยาวไม่เกิน maxDimension (ไม่ขยายรูปเล็ก)
export async function createPhotoThumbnail(
  file: Blob,
  maxDimension = DEFAULT_THUMB_MAX_DIMENSION,
  jpegQuality = DEFAULT_THUMB_JPEG_QUALITY,
): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));
}

export async function resizeLogoFile(file: File, maxDimension = DEFAULT_LOGO_MAX_DIMENSION): Promise<File> {
  if (file.type === "image/svg+xml") return file;

  const bitmap = await createImageBitmap(file);
  if (bitmap.width <= maxDimension && bitmap.height <= maxDimension) return file;

  const scale = maxDimension / Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const outType = file.type === "image/webp" ? "image/webp" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outType));
  if (!blob) return file;
  const ext = outType === "image/webp" ? "webp" : "png";
  return new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: outType });
}

export async function resizeAvatarFile(
  file: File,
  maxDimension = DEFAULT_AVATAR_MAX_DIMENSION,
  jpegQuality = DEFAULT_AVATAR_JPEG_QUALITY,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
