"use client";

// สเต็ปเปอร์ + กล่องแจ้งเตือน "รอการพิจารณาจากท่าน" ใช้ร่วมกันในหน้าที่มีขั้นตอนเห็นชอบ/อนุมัติแบบ
// เรียงลำดับ (เสนอโครงการ, การบันทึกขออนุมัติ) — มิเรอร์แพทเทิร์นเดียวกับ AcknowledgeTimeline ที่ใช้ใน
// /asset-audits/[id] (รองผู้อำนวยการ/ผู้อำนวยการรับทราบผลตรวจสอบพัสดุ)

import { BellIcon, CheckIcon, CloseIcon } from "@/components/icons";
import { formatThaiDate } from "@/lib/thai";

export type FlowStepState = "done" | "rejected" | "current" | "pending";

export type FlowStep = {
  label: string;
  state: FlowStepState;
  by?: string | null;
  at?: string | null;
};

export function ApprovalTimeline({ steps }: { steps: FlowStep[] }) {
  return (
    <div>
      <div className="flex items-center">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1] : null;
          const lineColor = prev?.state === "rejected" ? "bg-red-300" : prev?.state === "done" ? "bg-emerald-400" : "bg-slate-200";
          return (
            <div key={s.label} className="contents">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  s.state === "rejected"
                    ? "border-red-500 bg-red-500 text-white"
                    : s.state === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : s.state === "current"
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {s.state === "rejected" ? (
                  <CloseIcon className="h-4 w-4" />
                ) : s.state === "done" ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              {i < steps.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${lineColor}`} />}
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s) => (
          <div key={s.label}>
            <p
              className={`text-xs font-medium ${
                s.state === "rejected" ? "text-red-700" : s.state === "done" ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              {s.label}
            </p>
            {s.at && (
              <p className="text-[11px] text-slate-400">
                {s.by ? `${s.by} · ` : ""}
                {formatThaiDate(s.at)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PendingActionCallout({
  title = "รอการพิจารณาจากท่าน",
  subtitle,
  children,
}: {
  title?: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <BellIcon className="h-5 w-5 text-amber-700" />
        </span>
        <div>
          <p className="font-semibold text-amber-900">{title}</p>
          <p className="text-sm text-amber-700">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
