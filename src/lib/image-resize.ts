// ย่อ/บีบอัดรูปฝั่ง client ด้วย canvas ก่อนอัปโหลด — รูปจากกล้องมือถือมักมีขนาดหลาย MB ทำให้อัปโหลด
// ช้าและเสี่ยงชนขีดจำกัดขนาด payload ของเซิร์ฟเวอร์ ย่อไว้ก่อนช่วยทั้งความเร็วและพื้นที่จัดเก็บ
// แยก 2 แบบตามลักษณะการใช้งาน:
// - compressPhotoFile: ใช้กับภาพถ่ายจริง (เช่น รูปกิจกรรมในรายงานโครงการ) แปลงเป็น JPEG เสมอเพราะ
//   ไม่มีพื้นหลังโปร่งใสให้ต้องรักษาไว้ และ JPEG บีบอัดได้ดีกว่าสำหรับภาพถ่าย
// - resizeLogoFile: ใช้กับโลโก้/ไอคอน คงชนิดไฟล์เดิมไว้ (PNG/WebP) เพื่อไม่ให้พื้นหลังโปร่งใสหายไป
//   และข้าม SVG ไปเลยเพราะเป็นภาพเวกเตอร์ไม่มีขนาดพิกเซลตายตัวให้ย่อ

const DEFAULT_PHOTO_MAX_DIMENSION = 1600;
const DEFAULT_PHOTO_JPEG_QUALITY = 0.82;
const DEFAULT_LOGO_MAX_DIMENSION = 512;

export async function compressPhotoFile(
  file: File,
  maxDimension = DEFAULT_PHOTO_MAX_DIMENSION,
  jpegQuality = DEFAULT_PHOTO_JPEG_QUALITY,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const needsResize = bitmap.width > maxDimension || bitmap.height > maxDimension;
  if (!needsResize && file.type === "image/jpeg") return file;

  const scale = needsResize ? maxDimension / Math.max(bitmap.width, bitmap.height) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", jpegQuality));
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/jpeg" });
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
