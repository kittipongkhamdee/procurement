"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { THAI_MONTHS } from "@/lib/thai";

const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const QUICK_OFFSETS: { label: string; days: number | null }[] = [
  { label: "วันนี้", days: null },
  { label: "+3 วัน", days: 3 },
  { label: "+7 วัน", days: 7 },
  { label: "+15 วัน", days: 15 },
  { label: "+30 วัน", days: 30 },
];

type Coords =
  | { left: number; width: number; top: number }
  | { left: number; width: number; bottom: number };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseIso(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** "2026-09-07" -> "7/09/2569" — รูปแบบ วัน/เดือน/ปี พ.ศ. มาตรฐานที่ใช้แสดงวันที่ทั่วทั้งระบบ */
function formatDisplay(iso: string | null): string {
  const parts = parseIso(iso);
  if (!parts) return "";
  return `${parts.d}/${pad2(parts.m)}/${parts.y + 543}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

/** ปฏิทินเลือกวัน/เดือน/ปี พ.ศ. ใช้แทน input type="date" ของเบราว์เซอร์ทุกจุดในระบบ (ปฏิทินเบราว์เซอร์
 * ส่วนใหญ่แสดงเป็น ค.ศ. ให้กรอกเอง ไม่ใช่ พ.ศ.) — ค่าภายในเก็บเป็น ISO date (ค.ศ.) เสมอ เพื่อให้ใช้กับ
 * คอลัมน์ date ของฐานข้อมูลได้ตรงๆ, แสดงผลเป็น พ.ศ. เท่านั้น */
export function ThaiDatePicker({
  name,
  defaultValue = null,
  value,
  onChange,
  placeholder = "วัน/เดือน/ปี พ.ศ.",
  required,
}: {
  /** ใส่เมื่อใช้แบบ uncontrolled ในฟอร์ม — จะ render hidden input ชื่อนี้ด้วยค่า ISO ที่เลือก */
  name?: string;
  defaultValue?: string | null;
  /** ใส่ value+onChange เมื่อต้องการควบคุม state จากภายนอก (controlled) */
  value?: string | null;
  onChange?: (iso: string | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const isControlled = value !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState<string | null>(defaultValue);
  const selected = isControlled ? value! : internal;

  const initial = parseIso(selected) ?? { y: new Date().getFullYear(), m: new Date().getMonth() + 1, d: 0 };
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // portal + fixed positioning เข้าไปใน <dialog> เอง (ถ้าอยู่ในนั้น) เหมือน TeacherMultiSelect — กัน
  // ปฏิทินโดน overflow ของ modal ตัดทิ้งหรือโดนบังทับ
  useLayoutEffect(() => {
    if (!open) return;
    setPortalTarget(wrapperRef.current?.closest("dialog") ?? document.body);
    function updatePosition() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const gap = 4;
      const margin = 12;
      const panelHeight = 340;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openAbove = spaceBelow < panelHeight && spaceAbove > spaceBelow;
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - margin * 2);
      const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
      setCoords(openAbove ? { left, width, bottom: window.innerHeight - rect.top + gap } : { left, width, top: rect.bottom + gap });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  function setSelected(iso: string | null) {
    if (isControlled) onChange!(iso);
    else setInternal(iso);
  }

  function pickDate(y: number, m: number, d: number) {
    setViewYear(y);
    setViewMonth(m);
    setSelected(toIso(y, m, d));
    setOpen(false);
  }

  function applyOffset(days: number | null) {
    const base = new Date();
    if (days) base.setDate(base.getDate() + days);
    pickDate(base.getFullYear(), base.getMonth() + 1, base.getDate());
  }

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const nowAdYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 106 }, (_, i) => nowAdYear + 5 - i);
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
  const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
  const prevMonthDays = daysInMonth(prevYear, prevMonth);
  const todayIso = toIso(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  const cells: { y: number; m: number; d: number; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) cells.push({ y: prevYear, m: prevMonth, d: prevMonthDays - i, inMonth: false });
  for (let d = 1; d <= totalDays; d++) cells.push({ y: viewYear, m: viewMonth, d, inMonth: true });
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    const nextD = last.d + 1;
    const overflow = nextD > daysInMonth(last.y, last.m);
    cells.push(
      overflow
        ? { y: viewMonth === 12 ? viewYear + 1 : viewYear, m: viewMonth === 12 ? 1 : viewMonth + 1, d: 1, inMonth: false }
        : { y: last.y, m: last.m, d: nextD, inMonth: false },
    );
    if (cells.length >= 42) break;
  }

  return (
    <div ref={wrapperRef} className="relative">
      {name && <input type="hidden" name={name} value={selected ?? ""} required={required} />}
      <input
        ref={inputRef}
        type="text"
        readOnly
        onClick={() => setOpen((v) => !v)}
        value={formatDisplay(selected)}
        placeholder={placeholder}
        className="input w-full cursor-pointer"
      />
      {open &&
        coords &&
        portalTarget &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: "fixed", left: coords.left, width: coords.width, ...("top" in coords ? { top: coords.top } : { bottom: coords.bottom }) }}
            className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => changeMonth(-1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
                ‹
              </button>
              <div className="flex items-center gap-1.5">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm"
                >
                  {THAI_MONTHS.slice(1).map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-sm"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y + 543}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => changeMonth(1)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
                ›
              </button>
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_OFFSETS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => applyOffset(q.days)}
                  className="rounded-lg px-2 py-0.5 text-xs font-medium text-navy-800 hover:bg-navy-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                const iso = toIso(c.y, c.m, c.d);
                const isSelected = selected === iso;
                const isToday = todayIso === iso;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickDate(c.y, c.m, c.d)}
                    className={`rounded-full py-1.5 text-sm ${
                      isSelected
                        ? "bg-navy-800 font-semibold text-white"
                        : c.inMonth
                          ? `text-slate-700 hover:bg-navy-50 ${isToday ? "font-semibold text-navy-800" : ""}`
                          : "text-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {c.d}
                  </button>
                );
              })}
            </div>
          </div>,
          portalTarget,
        )}
    </div>
  );
}
