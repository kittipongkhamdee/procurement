"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setUserGroups as setUserGroupsAction } from "./actions";

type GroupOption = { id: string; name: string; is_active: boolean };

export function UserGroupSelect({
  userId,
  groups,
  initialGroupIds,
  setUserGroups,
}: {
  userId: string;
  groups: GroupOption[];
  initialGroupIds: string[];
  setUserGroups: typeof setUserGroupsAction;
}) {
  const [selected, setSelected] = useState<string[]>(initialGroupIds);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function toggle(groupId: string) {
    const next = selected.includes(groupId) ? selected.filter((id) => id !== groupId) : [...selected, groupId];
    setSelected(next);
    setSaving(true);
    try {
      await setUserGroups(userId, next);
      await toastSuccess("บันทึกสถานะเรียบร้อยแล้ว");
    } catch (err) {
      setSelected(selected);
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const visibleGroups = groups.filter((g) => g.is_active || selected.includes(g.id));
  const selectedNames = groups.filter((g) => selected.includes(g.id)).map((g) => g.name);

  return (
    <div ref={ref} className="relative min-w-[10rem]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className="input flex min-h-[2.25rem] w-full items-center py-1.5 text-left text-sm disabled:opacity-60"
      >
        {selectedNames.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {selectedNames.map((n) => (
              <span key={n} className="badge-navy">
                {n}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-slate-400">ยังไม่กำหนดสถานะ</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 min-w-[12rem] overflow-y-auto rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
          {visibleGroups.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={() => toggle(g.id)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-navy-800 focus:ring-navy-600/30"
              />
              {g.name}
            </label>
          ))}
          {visibleGroups.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">ยังไม่มีสถานะ (เพิ่มได้ด้านบน)</p>
          )}
        </div>
      )}
    </div>
  );
}
