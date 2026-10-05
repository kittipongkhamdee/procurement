// ป้ายประเภทไฟล์ (PDF / WORD / EXCEL ฯลฯ) — ใช้ได้ทั้งฝั่ง server และ client

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/csv": "csv",
  "application/zip": "zip",
};

export function fileExtension(name: string | null | undefined): string | null {
  const match = name?.match(/\.([A-Za-z0-9]{1,8})$/);
  return match ? match[1].toLowerCase() : null;
}

export function extensionFromMime(mime: string | null | undefined): string | null {
  if (!mime) return null;
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  if (mime.startsWith("image/")) return mime.slice("image/".length).replace("jpeg", "jpg");
  return null;
}

type Badge = { label: string; className: string };

const BADGES: { exts: string[]; badge: Badge }[] = [
  { exts: ["pdf"], badge: { label: "PDF", className: "border-red-200 bg-red-50 text-red-700" } },
  { exts: ["doc", "docx", "odt", "rtf"], badge: { label: "WORD", className: "border-blue-200 bg-blue-50 text-blue-700" } },
  {
    exts: ["xls", "xlsx", "csv", "ods"],
    badge: { label: "EXCEL", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  },
  {
    exts: ["ppt", "pptx", "odp"],
    badge: { label: "POWERPOINT", className: "border-orange-200 bg-orange-50 text-orange-700" },
  },
  {
    exts: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"],
    badge: { label: "รูปภาพ", className: "border-violet-200 bg-violet-50 text-violet-700" },
  },
  { exts: ["zip", "rar", "7z"], badge: { label: "ZIP", className: "border-amber-200 bg-amber-50 text-amber-700" } },
];

const OTHER_CLASS = "border-slate-200 bg-slate-50 text-slate-600";

/** ป้ายจากนามสกุลไฟล์ ถ้าเป็นลิงก์ภายนอกให้ส่ง url มาด้วยเพื่อเดาจากลิงก์ Google Docs/Sheets/Slides */
export function fileTypeBadge(ext: string | null, externalUrl?: string): Badge {
  if (externalUrl) {
    if (externalUrl.includes("docs.google.com/document")) return BADGES[1].badge;
    if (externalUrl.includes("docs.google.com/spreadsheets")) return BADGES[2].badge;
    if (externalUrl.includes("docs.google.com/presentation")) return BADGES[3].badge;
    ext = ext ?? fileExtension(externalUrl.split(/[?#]/)[0]);
  }
  if (ext) {
    const found = BADGES.find((b) => b.exts.includes(ext));
    if (found) return found.badge;
    return { label: ext.toUpperCase(), className: OTHER_CLASS };
  }
  return { label: externalUrl ? "ลิงก์" : "ไฟล์", className: OTHER_CLASS };
}

/** ตัดนามสกุลท้ายชื่อออกเฉพาะเมื่อตรงกับประเภทไฟล์จริง (เช่น "รายงาน.docx" + docx → "รายงาน") —
 * ไม่ตัดมั่วๆ จากจุดท้ายชื่อ กันชื่ออย่าง "แผน v1.2" โดนตัดผิด ป้ายประเภทไฟล์แสดงนามสกุลแทนอยู่แล้ว */
export function stripKnownExtension(name: string, ext: string | null | undefined): string {
  if (!ext) return name;
  const suffix = `.${ext.toLowerCase()}`;
  if (name.toLowerCase().endsWith(suffix) && name.length > suffix.length) return name.slice(0, -suffix.length).trimEnd();
  return name;
}
