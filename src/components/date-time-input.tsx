"use client";

/** ช่องวันที่+เวลาในช่องเดียว แบบเดียวกับระบบสอบ (input datetime-local ของเบราว์เซอร์)
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
  const value = date ? `${date}T${m ? `${m[1].padStart(2, "0")}:${m[2]}` : "00:00"}` : "";
  return (
    <input
      type="datetime-local"
      value={value}
      min={minDate ? `${minDate}T00:00` : undefined}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange(null, "");
        const [d, t] = v.split("T");
        onChange(d, (t ?? "").slice(0, 5).replace(":", "."));
      }}
      className="input w-full"
    />
  );
}
