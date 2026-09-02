/**
 * อ่านขนาดภาพจริงจาก header ของไฟล์ (ไม่มีไลบรารีสำหรับงานนี้ในโปรเจกต์อยู่แล้ว และรูปมีแค่
 * ไม่กี่รูปต่อรายงาน) เพื่อคำนวณสัดส่วนก่อนฝังลง docx — ป้องกันภาพยืด/บิดเบี้ยวถ้าใส่ขนาดคงที่ตรงๆ
 */
export function getImageSize(buffer: Buffer, format: "png" | "jpg"): { width: number; height: number } {
  if (format === "png") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG: ไล่หา segment marker SOFn (0xC0-0xC3, 0xC5-0xC7, 0xC9-0xCB, 0xCD-0xCF) ที่เก็บ
  // ความสูง/ความกว้างไว้ที่ offset +5/+7 ของ segment
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return { width: 800, height: 600 };
}
