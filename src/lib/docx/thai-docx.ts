/**
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ — เอนจินตัดบรรทัดของ Word เลยไม่รู้ว่าจะตัดตรงไหน ทำให้ข้อความ
 * ไหลเลยขอบกระดาษแทนที่จะขึ้นบรรทัดใหม่ (จุดตัดบรรทัดที่ Word รู้จักเองมีแค่ช่องว่าง/เครื่องหมาย
 * วรรคตอนที่มีอยู่แล้วในข้อความ) วิธีแก้คือแทรกอักขระ Zero-Width Space (U+200B) เป็นระยะในช่วง
 * ข้อความไทยที่ต่อกันยาวๆ โดยไม่มีช่องว่างเลย — ZWS มองไม่เห็นและไม่กินความกว้าง แต่บอก Word ว่า
 * "ตัดบรรทัดตรงนี้ได้" ทำให้ข้อความไหลเต็มบรรทัดแทนที่จะเลยขอบกระดาษ
 *
 * ระบบนี้รันบน Node.js/Vercel (ไม่มี Python runtime) จึงแทรก ZWS ทุกๆ N ตัวอักษรไทยแทนการตัดคำ
 * จริงด้วย dictionary (ต่างจาก pythainlp) — ไม่ได้ตัดตรงขอบคำเป๊ะทุกจุด แต่ให้จุดตัดบรรทัดถี่พอที่
 * Word จะไหลข้อความได้เต็มบรรทัดเหมือนกัน เพราะ ZWS มองไม่เห็นจึงไม่กระทบรูปคำที่อ่านอยู่ดี
 */
const THAI_CHAR = /[฀-๿]/;
const ZWS = "​";
const CHUNK_SIZE = 8;

export function insertZwsp(text: string): string {
  let result = "";
  let thaiRun = 0;
  for (const ch of text) {
    if (THAI_CHAR.test(ch)) {
      if (thaiRun > 0 && thaiRun % CHUNK_SIZE === 0) result += ZWS;
      thaiRun++;
    } else {
      thaiRun = 0;
    }
    result += ch;
  }
  return result;
}

export const THAI_FONT = "TH Sarabun New";
/** docx.js ใช้หน่วย half-point สำหรับขนาดตัวอักษร — 28 = 14pt (ค่าเริ่มต้นของเอกสารราชการไทย) */
export const THAI_FONT_SIZE = 28;
export const THAI_FONT_SIZE_TITLE = 36;
export const THAI_FONT_SIZE_HEADING = 32;
