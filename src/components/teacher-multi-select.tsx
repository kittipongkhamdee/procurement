"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TeacherOption = { id: string; name: string; is_active: boolean };

type Coords =
  | { left: number; width: number; maxHeight: number; top: number }
  | { left: number; width: number; maxHeight: number; bottom: number };

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
  const [coords, setCoords] = useState<Coords | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ใช้ portal + fixed positioning แทน absolute เดิม เพราะ dropdown อยู่ใน modal ที่มี overflow-y-auto
  // ซึ่งตัด absolute dropdown ที่โผล่พ้นขอบล่างของ modal ทิ้ง ทำให้ตัวเลือกโดนบัง/มองไม่เห็น
  useLayoutEffect(() => {
    if (!open) return;
    function updatePosition() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const gap = 4;
      const minHeight = 120;
      const preferredHeight = 224;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openAbove = spaceBelow < minHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(minHeight, Math.min(preferredHeight, openAbove ? spaceAbove : spaceBelow));
      setCoords(
        openAbove
          ? { left: rect.left, width: rect.width, maxHeight, bottom: window.innerHeight - rect.top + gap }
          : { left: rect.left, width: rect.width, maxHeight, top: rect.bottom + gap },
      );
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  function setSelected(next: string[]) {
    if (isControlled) onChange!(next);
    else setInternal(next);
  }

  function toggle(teacherName: string) {
    setSelected(selected.includes(teacherName) ? selected.filter((n) => n !== teacherName) : [...selected, teacherName]);
  }

  const visibleTeachers = teachers.filter((t) => t.is_active || selected.includes(t.name));

  return (
    <div ref={wrapperRef} className="relative">
      {name && selected.map((n) => <input key={n} type="hidden" name={name} value={n} />)}
      <button
        ref={buttonRef}
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
      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              ...("top" in coords ? { top: coords.top } : { bottom: coords.bottom }),
            }}
            className="z-50 overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
