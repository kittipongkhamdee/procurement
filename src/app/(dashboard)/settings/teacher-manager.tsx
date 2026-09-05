"use client";

import { useMemo, useState } from "react";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { CloseIcon } from "@/components/icons";
import type {
  createTeacher as createTeacherAction,
  deleteTeacher as deleteTeacherAction,
  toggleTeacherActive as toggleTeacherActiveAction,
  updateTeacherName as updateTeacherNameAction,
} from "./actions";

type Teacher = { id: string; name: string; is_active: boolean };
type RegisteredUser = { user_id: string; full_name: string };

export function TeacherManager({
  teachers,
  registeredUsers,
  createTeacher,
  updateTeacherName,
  toggleTeacherActive,
  deleteTeacher,
  onChanged,
}: {
  teachers: Teacher[];
  registeredUsers: RegisteredUser[];
  createTeacher: typeof createTeacherAction;
  updateTeacherName: typeof updateTeacherNameAction;
  toggleTeacherActive: typeof toggleTeacherActiveAction;
  deleteTeacher: typeof deleteTeacherAction;
  onChanged?: () => void;
}) {
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importingAll, setImportingAll] = useState(false);

  // เทียบชื่อแบบ trim + lowercase กันกรณีเว้นวรรค/ตัวพิมพ์ต่างกันเล็กน้อย ไม่ให้เข้าใจผิดว่ายังไม่ได้นำเข้า
  const missingUsers = useMemo(() => {
    const existingNames = new Set(teachers.map((t) => t.name.trim().toLowerCase()));
    return registeredUsers.filter(
      (u) => u.full_name.trim() && !existingNames.has(u.full_name.trim().toLowerCase()),
    );
  }, [teachers, registeredUsers]);

  async function importUser(user: RegisteredUser) {
    setImportingId(user.user_id);
    try {
      const formData = new FormData();
      formData.set("name", user.full_name.trim());
      await createTeacher(formData);
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setImportingId(null);
    }
  }

  async function handleImportAll() {
    setImportingAll(true);
    try {
      for (const user of missingUsers) {
        const formData = new FormData();
        formData.set("name", user.full_name.trim());
        await createTeacher(formData);
      }
      await toastSuccess(`นำเข้ารายชื่อครู ${missingUsers.length} คนเรียบร้อยแล้ว`);
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setImportingAll(false);
    }
  }
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
      onChanged?.();
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleTeacherActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบครู "${name}"?` });
    if (!ok) return;
    try {
      await deleteTeacher(id);
      await toastSuccess("ลบครูเรียบร้อยแล้ว");
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
      await createTeacher(formData);
      await toastSuccess("เพิ่มครูเรียบร้อยแล้ว");
      form.reset();
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">รายชื่อครู</div>
      <p className="mb-3 text-sm text-slate-500">
        รายชื่อนี้ใช้เลือก &quot;ผู้รับผิดชอบโครงการ/กิจกรรม&quot; ตอนเสนอโครงการและสร้างโครงการ — เพิ่มชื่อครูทุกคน
        ที่ต้องเลือกเป็นผู้รับผิดชอบไว้ที่นี่
      </p>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <input defaultValue={t.name} onBlur={(e) => handleRenameBlur(t.id, t.name, e)} className="input" />
                </td>
                <td className="text-center">
                  <ToggleSwitch checked={t.is_active} onChange={() => handleToggle(t.id, t.is_active)} />
                </td>
                <td className="text-right whitespace-nowrap px-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.name)}
                    className="icon-btn-danger"
                    aria-label="ลบ"
                  >
                    <CloseIcon className="h-4 w-4" />
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
      <form onSubmit={handleCreate} className="mb-4 flex gap-3">
        <input name="name" placeholder="ชื่อ-นามสกุลครู" required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>

      {missingUsers.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              นำเข้าชื่อจากผู้ใช้ที่ลงทะเบียนแล้วในระบบ ({missingUsers.length} คนยังไม่อยู่ในรายชื่อครู)
            </p>
            <button
              type="button"
              onClick={handleImportAll}
              disabled={importingAll}
              className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importingAll ? "กำลังนำเข้า..." : "นำเข้าทั้งหมด"}
            </button>
          </div>
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {missingUsers.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm text-slate-700">{u.full_name}</span>
                <button
                  type="button"
                  onClick={() => importUser(u)}
                  disabled={importingId === u.user_id || importingAll}
                  className="btn-secondary btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importingId === u.user_id ? "กำลังนำเข้า..." : "นำเข้า"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
