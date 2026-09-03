import fs from "node:fs";
import path from "node:path";

let cachedFontFaceCss: string | null = null;

/** ฝังฟอนต์ Sarabun เป็น base64 ตรงใน CSS แทนที่จะโหลดจากอินเทอร์เน็ต (Google Fonts) —
 * headless Chromium ที่รันในเซิร์ฟเวอร์เชื่อถือไม่ได้ว่าจะออกอินเทอร์เน็ตได้เสมอ/เร็วพอ */
export function getSarabunFontFaceCss(): string {
  if (cachedFontFaceCss) return cachedFontFaceCss;

  const regular = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf")).toString("base64");
  const bold = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf")).toString("base64");

  cachedFontFaceCss = `
    @font-face {
      font-family: "Sarabun";
      font-weight: normal;
      src: url(data:font/ttf;base64,${regular}) format("truetype");
    }
    @font-face {
      font-family: "Sarabun";
      font-weight: bold;
      src: url(data:font/ttf;base64,${bold}) format("truetype");
    }
  `;
  return cachedFontFaceCss;
}

let cachedGarudaEmblemDataUri: string | null = null;

/** ตราครุฑที่หัวเอกสารบันทึกข้อความ — ดึงมาจากไฟล์ต้นฉบับที่โรงเรียนใช้จริงโดยตรง (ผู้ใช้อัปโหลดมา)
 * ฝังเป็น base64 เหมือนฟอนต์ ไม่พึ่งอินเทอร์เน็ตตอนพิมพ์ */
export function getGarudaEmblemDataUri(): string {
  if (cachedGarudaEmblemDataUri) return cachedGarudaEmblemDataUri;
  const png = fs.readFileSync(path.join(process.cwd(), "src/lib/pdf-html/assets/garuda-emblem.png")).toString("base64");
  cachedGarudaEmblemDataUri = `data:image/png;base64,${png}`;
  return cachedGarudaEmblemDataUri;
}
