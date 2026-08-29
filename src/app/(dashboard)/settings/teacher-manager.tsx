"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
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
  async function handleRename(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateTeacherName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
    } catch (err) {
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
                <td className="p-0">
                  <form onSubmit={(e) => handleRename(t.id, e)} className="flex items-center gap-2 px-4 py-2">
                    <input name="name" defaultValue={t.name} className="input" />
                    <button type="submit" className="btn-secondary btn-sm shrink-0">
                      บันทึก
                    </button>
                  </form>
                </td>
                <td className="text-center">
                  {t.is_active ? (
                    <span className="badge-emerald">แสดง</span>
                  ) : (
                    <span className="badge-slate">ซ่อน</span>
                  )}
                </td>
                <td className="text-right space-x-2 whitespace-nowrap px-4">
                  <button
                    type="button"
                    onClick={() => handleToggle(t.id, t.is_active)}
                    className="btn-secondary btn-sm"
                  >
                    {t.is_active ? "ปิดการแสดง" : "เปิดการแสดง"}
                  </button>
                  <button type="button" onClick={() => handleDelete(t.id, t.name)} className="btn-danger btn-sm">
                    ลบ
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
