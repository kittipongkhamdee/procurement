"use client";

import { ThaiDatePicker } from "@/components/thai-date-picker";

/** ช่องวันที่+เวลาในกล่องเดียว หน้าตาแบบระบบสอบ ("วว/ดด/ปปปป --:--") แต่วันที่เป็นปฏิทิน พ.ศ. (ThaiDatePicker)
 * ค่าภายนอกยังแยกเป็นวันที่ ISO ("2026-10-22") กับเวลา "HH.MM" เหมือนเดิม */
export function DateTimeInput({
  date,
  time,
  onChange,
  minDate,
}: {
  date: string | null;
  time: string;
  onChange: (date: string | null, time: string) => void;
  minDate?: string;
}) {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(time.trim());
  const native = m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  return (
    <div className="flex w-full items-center rounded-md border border-slate-300 bg-white text-sm text-slate-900 transition focus-within:border-navy-600 focus-within:ring-2 focus-within:ring-navy-600/15">
      <div className="relative min-w-0 flex-1">
        <ThaiDatePicker
          value={date}
          onChange={(d) => onChange(d, time)}
          minDate={minDate}
          placeholder="วว/ดด/ปปปป"
          inputClassName="w-full cursor-pointer bg-transparent py-2 pl-3 pr-9 outline-none"
        />
        <svg className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </div>
      <input
        type="time"
        value={native}
        onChange={(e) => onChange(date, e.target.value ? e.target.value.replace(":", ".") : "")}
        aria-label="เวลา"
        className="w-28 shrink-0 border-l border-slate-200 bg-transparent px-2 py-2 outline-none"
      />
      <span className="shrink-0 pr-3 text-slate-500">น.</span>
    </div>
  );
}
