/**
 * เดารูปแบบไฟล์จากนามสกุล (ที่ build-project-report-pdf.tsx ทำ) ใช้ไม่ได้ร้อยเปอร์เซ็นต์ — กล้อง
 * iPhone เก็บเป็น .heic/.HEIC โดยดีฟอลต์ ถ้าเดาว่าเป็น jpg ทั้งที่ไบต์จริงเป็น HEIC จะฝังข้อมูลผิด
 * ชนิดลง docx (ประกาศเป็น jpg แต่ไบต์ไม่ใช่ jpg จริง) ทำให้ Word เปิดเอกสารได้ปกติแต่รูปในนั้น
 * แสดงไม่ออก (ไอคอนรูปเสีย) — อ่าน magic bytes จริงของไฟล์แทนเพื่อยืนยันชนิดก่อนฝัง
 */
export function sniffImageFormat(buffer: Buffer): "png" | "jpg" | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  return null;
}

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
