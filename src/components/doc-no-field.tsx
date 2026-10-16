"use client";

// เลขที่เอกสารงานพัสดุ — ระบบออกเลขอัตโนมัติตอนบันทึก ผู้ใช้ทั่วไปกรอก/แก้ไม่ได้ (แก้ได้เฉพาะแอดมิน) แสดงให้เด่นชัด

export function DocNoBadge({ no, size = "md" }: { no: string | null | undefined; size?: "md" | "lg" }) {
  if (!no) return <span className="text-sm text-slate-400">(ไม่มีเลขที่)</span>;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md bg-amber-50 font-bold text-navy-900 ring-1 ring-amber-300 ${
        size === "lg" ? "px-3 py-1 text-lg" : "px-2 py-0.5 text-sm"
      }`}
    >
      {no}
    </span>
  );
}

/** ช่องเลขที่ในฟอร์ม — แอดมิน: แก้ได้ (เว้นว่างตอนสร้าง = ออกเลขอัตโนมัติ), ผู้ใช้อื่น: แสดงอย่างเดียว */
export function DocNoField({ current, suggested, isAdmin }: { current: string | null | undefined; suggested: string; isAdmin: boolean }) {
  const isNew = current === undefined;
  return (
    <div>
      <label className="label">เลขที่เอกสาร</label>
      {isAdmin ? (
        <input
            name="doc_no"
            defaultValue={current ?? ""}
            placeholder={suggested ? `อัตโนมัติ: ${suggested}` : "ไม่มีเลขอัตโนมัติ — กรอกเองหรือเว้นว่าง"}
            className="input w-full font-bold"
          />
      ) : isNew ? (
        <div className="flex min-h-[2.5rem] flex-wrap items-center gap-2">
          {suggested ? (
            <>
              <DocNoBadge no={suggested} size="lg" />
              <span className="text-xs text-slate-500">ระบบออกเลขให้อัตโนมัติเมื่อบันทึก (เลขจริงอาจเลื่อนถ้ามีคนบันทึกก่อน)</span>
            </>
          ) : (
            <span className="text-sm text-slate-500">ไม่มีการออกเลขอัตโนมัติ (ผู้ดูแลระบบกำหนดได้)</span>
          )}
        </div>
      ) : (
        <div className="flex min-h-[2.5rem] items-center gap-2">
          <DocNoBadge no={current} size="lg" />
          <span className="text-xs text-slate-500">แก้ไขเลขที่ได้เฉพาะผู้ดูแลระบบ</span>
        </div>
      )}
    </div>
  );
}
