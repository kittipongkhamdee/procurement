"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { CloseIcon } from "@/components/icons";
import type {
  createLearningArea as createLearningAreaAction,
  deleteLearningArea as deleteLearningAreaAction,
  toggleLearningAreaActive as toggleLearningAreaActiveAction,
  updateLearningAreaName as updateLearningAreaNameAction,
} from "./actions";

type LearningArea = { id: string; name: string; is_active: boolean };

export function LearningAreaManager({
  learningAreas,
  createLearningArea,
  updateLearningAreaName,
  toggleLearningAreaActive,
  deleteLearningArea,
  onChanged,
}: {
  learningAreas: LearningArea[];
  createLearningArea: typeof createLearningAreaAction;
  updateLearningAreaName: typeof updateLearningAreaNameAction;
  toggleLearningAreaActive: typeof toggleLearningAreaActiveAction;
  deleteLearningArea: typeof deleteLearningAreaAction;
  onChanged?: () => void;
}) {
  async function handleRenameBlur(id: string, currentName: string, e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name || name === currentName) {
      e.target.value = currentName;
      return;
    }
    const formData = new FormData();
    formData.set("name", name);
    try {
      await updateLearningAreaName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
      onChanged?.();
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleLearningAreaActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบกลุ่มสาระ "${name}"?` });
    if (!ok) return;
    try {
      await deleteLearningArea(id);
      await toastSuccess("ลบกลุ่มสาระเรียบร้อยแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createLearningArea(formData);
      await toastSuccess("เพิ่มกลุ่มสาระเรียบร้อยแล้ว");
      form.reset();
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">กลุ่มสาระการเรียนรู้</div>
      <p className="mb-3 text-sm text-slate-500">
        ใช้เป็นตัวเลือกในช่อง &quot;ฝ่าย/กลุ่ม/สาระฯ/งาน&quot; ของบันทึกข้อความขออนุมัติ และกรองรายการโครงการตามชื่อ — ถ้าตั้งชื่อว่า
        &quot;กลุ่มสาระการเรียนรู้…&quot; ระบบจะแสดงโครงการที่ชื่อมีคำว่า &quot;กลุ่มสาระ&quot; และชื่อวิชานั้นให้เลือก
      </p>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อกลุ่มสาระการเรียนรู้</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {learningAreas.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2">
                  <input
                    defaultValue={g.name}
                    onBlur={(e) => handleRenameBlur(g.id, g.name, e)}
                    className="input"
                  />
                </td>
                <td className="text-center">
                  <ToggleSwitch checked={g.is_active} onChange={() => handleToggle(g.id, g.is_active)} />
                </td>
                <td className="text-right whitespace-nowrap px-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(g.id, g.name)}
                    className="icon-btn-danger"
                    aria-label="ลบ"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {learningAreas.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีกลุ่มสาระการเรียนรู้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleCreate} className="flex gap-3">
        <input name="name" placeholder="ชื่อกลุ่มสาระ เช่น กลุ่มสาระการเรียนรู้คณิตศาสตร์" required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
