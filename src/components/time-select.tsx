"use client";

// เลือกเวลา (ชั่วโมง : นาที แบบ 24 ชม.) ด้วย dropdown แทนการพิมพ์เอง — ค่าเก็บเป็น "HH.MM" (เช่น "06.00") ตามรูปแบบเวลาราชการ
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimeSelect({ value, onChange, label = "เวลา" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(value.trim());
  const h = m ? m[1].padStart(2, "0") : "";
  const mi = m ? m[2] : "";
  const set = (nh: string, nm: string) => onChange(nh ? `${nh}.${nm || "00"}` : "");
  // นาทีที่ไม่ลง 5 (ข้อมูลเดิมพิมพ์เอง) ยังแสดงได้
  const minutes = mi && !MINUTES.includes(mi) ? [...MINUTES, mi].sort() : MINUTES;
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <select value={h} onChange={(e) => set(e.target.value, mi)} className="input w-full px-2" aria-label={`${label} ชั่วโมง`}>
        <option value="">ชม.</option>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="text-slate-500">:</span>
      <select value={mi} onChange={(e) => set(h || "00", e.target.value)} className="input w-full px-2" aria-label={`${label} นาที`}>
        <option value="">นาที</option>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="shrink-0 text-sm text-slate-500">น.</span>
    </div>
  );
}
