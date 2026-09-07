"use client";

import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { createSurveyRound, toggleSurveyRoundOpen } from "./actions";

type SurveyRound = { id: string; year: number; name: string; is_open: boolean };

export function SurveyRoundTab({
  canManage,
  rounds,
  onChanged,
}: {
  canManage: boolean;
  rounds: SurveyRound[];
  onChanged: () => void;
}) {
  async function handleToggle(id: string, isOpen: boolean) {
    try {
      await toggleSurveyRoundOpen(id, isOpen);
      await toastSuccess(isOpen ? "ปิดรอบสำรวจแล้ว" : "เปิดรอบสำรวจแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createSurveyRound(formData);
      await toastSuccess("เพิ่มรอบสำรวจเรียบร้อยแล้ว");
      form.reset();
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">รอบสำรวจทรัพย์สิน</div>
      <p className="mb-4 text-sm text-slate-500">
        รอบที่เปิดอยู่ (&quot;กำลังสำรวจ&quot;) จะรับข้อมูลจากฟอร์มสำรวจสาธารณะได้ — ไม่กระทบการดู/แก้ไข
        ทะเบียนในหน้านี้
      </p>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th className="whitespace-nowrap">ปีงบประมาณ</th>
              <th>ชื่อรอบสำรวจ</th>
              <th className="text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap tabular-nums">{r.year}</td>
                <td>{r.name}</td>
                <td className="text-center">
                  {canManage ? (
                    <ToggleSwitch
                      checked={r.is_open}
                      onChange={() => handleToggle(r.id, r.is_open)}
                      labelOn="กำลังสำรวจ"
                      labelOff="ปิดแล้ว"
                    />
                  ) : (
                    <span className={r.is_open ? "badge-emerald" : "badge-slate"}>
                      {r.is_open ? "กำลังสำรวจ" : "ปิดแล้ว"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rounds.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีรอบสำรวจ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input
            name="year"
            type="number"
            placeholder="ปีงบประมาณ เช่น 2569"
            required
            className="input w-40"
          />
          <input name="name" placeholder="ชื่อรอบสำรวจ" required className="input flex-1" />
          <button type="submit" className="btn-primary shrink-0">
            เพิ่มรอบสำรวจ
          </button>
        </form>
      )}
    </div>
  );
}
