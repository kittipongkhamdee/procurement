"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { TrashIcon } from "@/components/icons";
import type {
  createTeacher as createTeacherAction,
  deleteTeacher as deleteTeacherAction,
  toggleTeacherActive as toggleTeacherActiveAction,
  updateTeacherName as updateTeacherNameAction,
} from "./actions";

type Teacher = { id: string; name: string; is_active: boolean };

export function TeacherManager({
  teachers,
  createTeacher,
  updateTeacherName,
  toggleTeacherActive,
  deleteTeacher,
}: {
  teachers: Teacher[];
  createTeacher: typeof createTeacherAction;
  updateTeacherName: typeof updateTeacherNameAction;
  toggleTeacherActive: typeof toggleTeacherActiveAction;
  deleteTeacher: typeof deleteTeacherAction;
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
      await updateTeacherName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleTeacherActive(id, isActive);
      await toastSuccess(isActive ? "ปิดการแสดงชื่อแล้ว" : "เปิดการแสดงชื่อแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบชื่อ "${name}"?` });
    if (!ok) return;
    try {
      await deleteTeacher(id);
      await toastSuccess("ลบรายชื่อเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createTeacher(formData);
      await toastSuccess("เพิ่มรายชื่อเรียบร้อยแล้ว");
      form.reset();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">รายชื่อครู</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th className="text-center">แสดงชื่อ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <input
                    defaultValue={t.name}
                    onBlur={(e) => handleRenameBlur(t.id, t.name, e)}
                    className="input"
                  />
                </td>
                <td className="text-center">
                  <ToggleSwitch
                    checked={t.is_active}
                    onChange={() => handleToggle(t.id, t.is_active)}
                    labelOn="แสดง"
                    labelOff="ซ่อน"
                  />
                </td>
                <td className="text-right whitespace-nowrap px-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.name)}
                    className="icon-btn-danger"
                    aria-label="ลบ"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีรายชื่อครู
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleCreate} className="flex gap-3">
        <input name="name" placeholder="ชื่อ-นามสกุลครู" required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
