"use client";

import { useEffect, useRef, useState } from "react";

type TeacherOption = { id: string; name: string; is_active: boolean };

export function TeacherMultiSelect({
  name,
  teachers,
  defaultValue = [],
  value,
  onChange,
  placeholder = "เลือกผู้รับผิดชอบ",
}: {
  /** ใส่เมื่อใช้แบบ uncontrolled — จะ render hidden input ชื่อนี้ให้ครบทุกค่าที่เลือก (formData.getAll(name)) */
  name?: string;
  teachers: TeacherOption[];
  defaultValue?: string[];
  /** ใส่ value+onChange เมื่อต้องการควบคุม state จากภายนอก (controlled) */
  value?: string[];
  onChange?: (next: string[]) => void;
  placeholder?: string;
}) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState<string[]>(defaultValue);
  const selected = isControlled ? value! : internal;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function setSelected(next: string[]) {
    if (isControlled) onChange!(next);
    else setInternal(next);
  }

  function toggle(teacherName: string) {
    setSelected(selected.includes(teacherName) ? selected.filter((n) => n !== teacherName) : [...selected, teacherName]);
  }

  const visibleTeachers = teachers.filter((t) => t.is_active || selected.includes(t.name));

  return (
    <div ref={ref} className="relative">
      {name && selected.map((n) => <input key={n} type="hidden" name={name} value={n} />)}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex min-h-[2.5rem] w-full items-center text-left"
      >
        {selected.length > 0 ? (
          <span className="truncate">{selected.join(", ")}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
          {visibleTeachers.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(t.name)}
                onChange={() => toggle(t.name)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-navy-800 focus:ring-navy-600/30"
              />
              {t.name}
            </label>
          ))}
          {visibleTeachers.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">ยังไม่มีรายชื่อครู (เพิ่มได้ที่หน้าตั้งค่าระบบ)</p>
          )}
        </div>
      )}
    </div>
  );
}
