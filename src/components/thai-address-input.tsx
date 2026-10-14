"use client";

// ช่องกรอก ตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์ พร้อมช่วยกรอกอัตโนมัติ — พิมพ์ช่องใดก็ได้แล้วเลือกจากรายการ
// ช่องที่เหลือจะเติมให้ (แนวเดียวกับ jquery.Thailand.js แต่เป็น React ไม่ต้องใช้ jQuery)
//
// ข้อมูล: public/data/thai-address-db.json คัดลอกมาจากแพ็กเกจ npm thai-address-database@0.0.33 (ISC,
// github.com/Sellsuki/thai-address-database — ฐานข้อมูลชุดเดียวกับ jquery.Thailand.js) รูปแบบบีบอัดแบบ
// {data, lookup, words} โหลดเมื่อผู้ใช้เริ่มพิมพ์ครั้งแรกเท่านั้น
//
// ใช้แบบ uncontrolled ในฟอร์มปกติ: แต่ละช่องเป็น <input name=...> อ่านค่าฝั่ง server ด้วย formData.get() ได้เลย
// และยังพิมพ์เองได้ถ้าที่อยู่ไม่มีในฐานข้อมูล

import { useEffect, useRef, useState } from "react";

export type ThaiAddressEntry = { tambon: string; amphoe: string; province: string; zipcode: string };
type Field = keyof ThaiAddressEntry;

type Compact = { data: unknown[]; lookup: string; words: string };

let dbPromise: Promise<ThaiAddressEntry[]> | null = null;

/** แตกฐานข้อมูลแบบบีบอัด (โครงสร้าง [จังหวัด,[[อำเภอ,[[ตำบล,รหัสไปรษณีย์|[รหัส...]]...]]...]]) — ตามวิธีของ jquery.Thailand.js */
function expand(db: Compact): ThaiAddressEntry[] {
  const lookup = db.lookup.split("|");
  const words = db.words.split("|");
  const t = (v: string | number) => {
    const text = typeof v === "number" ? lookup[v] : v;
    return text.replace(/[A-Z]/gi, (m) => {
      const ch = m.charCodeAt(0);
      return words[ch < 97 ? ch - 65 : 26 + ch - 97];
    });
  };
  const out: ThaiAddressEntry[] = [];
  for (const p of db.data as [string | number, [string | number, [string | number, string | string[]][]][]][]) {
    const province = t(p[0]);
    for (const a of p[1]) {
      const amphoe = t(a[0]);
      for (const d of a[1]) {
        const tambon = t(d[0]);
        const zips = Array.isArray(d[1]) ? d[1] : [d[1]];
        for (const zipcode of zips) out.push({ tambon, amphoe, province, zipcode: String(zipcode) });
      }
    }
  }
  return out;
}

function loadDb(): Promise<ThaiAddressEntry[]> {
  dbPromise ??= fetch("/data/thai-address-db.json")
    .then((r) => {
      if (!r.ok) throw new Error(`โหลดฐานข้อมูลที่อยู่ไม่สำเร็จ (${r.status})`);
      return r.json() as Promise<Compact>;
    })
    .then(expand)
    .catch((err) => {
      dbPromise = null; // ให้ลองใหม่ได้ครั้งหน้า
      throw err;
    });
  return dbPromise;
}

const MAX_SUGGESTIONS = 8;

const LABELS: Record<Field, string> = { tambon: "ตำบล/แขวง", amphoe: "อำเภอ/เขต", province: "จังหวัด", zipcode: "รหัสไปรษณีย์" };
const ORDER: Field[] = ["tambon", "amphoe", "province", "zipcode"];

export function ThaiAddressInput({
  defaultValue,
  names = { tambon: "tambon", amphoe: "amphoe", province: "province", zipcode: "zipcode" },
  className = "grid grid-cols-2 gap-3 sm:grid-cols-4",
}: {
  defaultValue?: Partial<Record<Field, string | null>>;
  names?: Record<Field, string>;
  className?: string;
}) {
  const [values, setValues] = useState<Record<Field, string>>({
    tambon: defaultValue?.tambon ?? "",
    amphoe: defaultValue?.amphoe ?? "",
    province: defaultValue?.province ?? "",
    zipcode: defaultValue?.zipcode ?? "",
  });
  const [db, setDb] = useState<ThaiAddressEntry[] | null>(null);
  const [active, setActive] = useState<Field | null>(null);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  function ensureDb() {
    if (db) return;
    loadDb().then(setDb).catch(() => setDb([]));
  }

  // ปิดรายการเมื่อคลิกนอกกล่อง
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setActive(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const query = active ? values[active].trim() : "";
  const suggestions =
    active && db && query
      ? db.filter((e) => e[active].startsWith(query)).slice(0, MAX_SUGGESTIONS)
      : [];

  function choose(entry: ThaiAddressEntry) {
    setValues(entry);
    setActive(null);
  }

  return (
    <div ref={boxRef} className={className}>
      {ORDER.map((field) => (
        <div key={field} className="relative">
          <label className="label">{LABELS[field]}</label>
          <input
            name={names[field]}
            value={values[field]}
            onFocus={() => {
              ensureDb();
              setActive(field);
              setHighlight(0);
            }}
            onChange={(e) => {
              setValues((v) => ({ ...v, [field]: e.target.value }));
              setActive(field);
              setHighlight(0);
            }}
            onKeyDown={(e) => {
              if (active !== field || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(suggestions[highlight]);
              } else if (e.key === "Escape") {
                setActive(null);
              }
            }}
            inputMode={field === "zipcode" ? "numeric" : undefined}
            autoComplete="off"
            className="input w-full"
          />
          {active === field && suggestions.length > 0 && (
            <ul className="absolute left-0 z-20 mt-1 max-h-64 w-72 max-w-[85vw] overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {suggestions.map((s, i) => (
                <li key={`${s.tambon}-${s.amphoe}-${s.province}-${s.zipcode}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(s)}
                    className={`block w-full px-3 py-2 text-left ${i === highlight ? "bg-navy-800/10" : "hover:bg-slate-50"}`}
                  >
                    {s.tambon} » {s.amphoe} » {s.province} » {s.zipcode}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
