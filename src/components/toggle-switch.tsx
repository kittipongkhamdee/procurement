"use client";

export function ToggleSwitch({
  checked,
  onChange,
  labelOn = "ใช้งาน",
  labelOff = "ปิดใช้งาน",
}: {
  checked: boolean;
  onChange: () => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-navy-800" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className={`text-xs font-medium ${checked ? "text-emerald-700" : "text-slate-500"}`}>
        {checked ? labelOn : labelOff}
      </span>
    </div>
  );
}
