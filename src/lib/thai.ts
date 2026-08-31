const THAI_MONTHS = [
  "",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** "2026-08-25" หรือ "2026-08-25T10:00:00.000Z" -> "25 สิงหาคม 2569" */
export function formatThaiDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${THAI_MONTHS[month]} ${year + 543}`;
}

const DIGIT_WORDS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const UNIT_WORDS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function convertDigits(str: string): string {
  let text = "";
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const n = parseInt(str.charAt(i), 10);
    const pos = len - i - 1;
    if (n === 0) continue;
    if (pos === 0 && n === 1 && len > 1 && str.charAt(len - 2) !== "0") {
      text += "เอ็ด";
    } else if (pos === 1 && n === 2) {
      text += "ยี่สิบ";
    } else if (pos === 1 && n === 1) {
      text += "สิบ";
    } else {
      text += DIGIT_WORDS[n] + UNIT_WORDS[pos];
    }
  }
  return text;
}

/** 1234.5 -> "(หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์)" */
export function thaiBahtText(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";
  const [bahtStr, satangStr] = amount.toFixed(2).split(".");
  const bahtText = convertDigits(bahtStr);
  const satangText = convertDigits(satangStr);

  let result = "";
  if (bahtText !== "") result += bahtText + "บาท";
  else if (satangText !== "") result += "ศูนย์บาท";

  result += satangText !== "" ? satangText + "สตางค์" : "ถ้วน";

  return result === "" ? "ศูนย์บาทถ้วน" : `(${result})`;
}

export function formatBaht(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
