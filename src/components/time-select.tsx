"use client";

// เลือกเวลา (24 ชม.) ด้วยตัวเลือกเวลาของเครื่อง (<input type="time">) — มือถือขึ้นวงล้อเลื่อนชั่วโมง/นาที เหมือนหน้าตั้งเวลาสอบ
// ค่าเก็บเป็น "HH.MM" (เช่น "06.00") ตามรูปแบบเวลาราชการ — วันที่ยังใช้ ThaiDatePicker (พ.ศ.) แยกช่อง
// (ไม่ใช้ datetime-local เพราะปฏิทินของเครื่องแสดงปีเป็น ค.ศ.)
export function TimeSelect({ value, onChange, label = "เวลา" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(value.trim());
  const native = m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={native}
        onChange={(e) => onChange(e.target.value ? e.target.value.replace(":", ".") : "")}
        aria-label={label}
        className="input w-full"
      />
      <span className="shrink-0 text-sm text-slate-500">น.</span>
    </div>
  );
}
