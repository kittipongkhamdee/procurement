/**
 * Content-Disposition header values must be a ByteString (Latin-1) — any Thai character
 * throws "Cannot convert argument to a ByteString" at the Headers layer. Encode the real
 * (Thai) filename per RFC 5987 filename*, with an ASCII-only filename= fallback for
 * clients that don't support it.
 */
/**
 * รหัสครุภัณฑ์ (asset_code) มักมี "/" อยู่ในตัว (รูปแบบ "รหัสประเภท.รหัสชนิด / เลขลำดับ / ปีงบ" —
 * ดู generateAssetCode ใน asset-register/actions.ts) เอามาต่อเป็นชื่อไฟล์ตรงๆ ไม่ได้ เพราะ "/" ถูก
 * ตีความเป็นตัวคั่นพาธของระบบไฟล์ในหลายอุปกรณ์/เบราว์เซอร์ — เจอเป็นบั๊กจริงตอนพิมพ์ป้ายสติกเกอร์
 * ทีละใบแล้วเปิดออกมาเป็นไฟล์รูปภาพแทน PDF (มือถือ/เบราว์เซอร์บางตัวสับสนเวลาแยกวิเคราะห์ชื่อไฟล์ที่มี
 * "/" แทรกอยู่) ใช้ฟังก์ชันนี้ทำความสะอาดทุกจุดที่เอาค่าจากผู้ใช้ไปต่อเป็นชื่อไฟล์
 */
export function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentDisposition(disposition: "inline" | "attachment", filename: string) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
