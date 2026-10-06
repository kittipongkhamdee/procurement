"use client";

// กล่องเลือกโครงการแบบกำหนดเอง — <select> ของเบราว์เซอร์ใส่ป้ายสี/จัดรูปแบบในตัวเลือกไม่ได้ จึงทำเอง
// เพื่อแสดงป้ายกลุ่มบริหารงานของแต่ละโครงการ (รายการที่ส่งเข้ามาควรเรียงตามกลุ่มไว้แล้ว ดู sortProjectsByGroup)

import { useEffect, useRef, useState } from "react";

type Option = {
  id: string;
  name: string;
  adminGroup: string | null;
  adminGroupOrder: number;
};

const BADGE_COLORS = [
  "border-blue-200 bg-blue-50 text-blue-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-cyan-200 bg-cyan-50 text-cyan-700",
];
const NO_GROUP_COLOR = "border-slate-200 bg-slate-50 text-slate-600";

/** เรียงตามลำดับกลุ่มบริหารงาน (sort_order ของกลุ่ม) แล้วคงลำดับโครงการเดิมในกลุ่ม — โครงการที่ไม่มีกลุ่มอยู่ท้ายสุด
 * (Array.sort เสถียร จึงไม่สลับลำดับโครงการภายในกลุ่มเดียวกัน) */
export function sortProjectsByGroup<T extends Option>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    if (!a.adminGroup && !b.adminGroup) return 0;
    if (!a.adminGroup) return 1;
    if (!b.adminGroup) return -1;
    return (
      a.adminGroupOrder - b.adminGroupOrder ||
      a.adminGroup.localeCompare(b.adminGroup, "th")
    );
  });
}

function badgeClass(group: string | null, groupNames: string[]) {
  if (!group) return NO_GROUP_COLOR;
  return BADGE_COLORS[groupNames.indexOf(group) % BADGE_COLORS.length];
}

function GroupBadge({
  group,
  groupNames,
}: {
  group: string | null;
  groupNames: string[];
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-none ${badgeClass(group, groupNames)}`}
    >
      {group ?? "ไม่มีกลุ่ม"}
    </span>
  );
}

export function ProjectSelect({
  name,
  value,
  onChange,
  projects,
  placeholder = "เลือกโครงการ..",
}: {
  name: string;
  value: string;
  onChange: (id: string) => void;
  projects: Option[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = projects.find((p) => p.id === value);
  const groupNames = Array.from(
    new Set(projects.map((p) => p.adminGroup).filter((g): g is string => !!g)),
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input flex w-full items-center justify-between gap-2 text-left"
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2">
            <GroupBadge group={selected.adminGroup} groupNames={groupNames} />
            <span className="truncate">{selected.name}</span>
          </span>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <span aria-hidden className="shrink-0 text-xs text-slate-400">
          ▾
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {projects.map((p) => (
            <li key={p.id} role="option" aria-selected={p.id === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  p.id === value ? "bg-navy-50/60" : ""
                }`}
              >
                <GroupBadge group={p.adminGroup} groupNames={groupNames} />
                <span className="font-medium text-slate-900">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
