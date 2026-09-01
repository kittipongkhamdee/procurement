"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { CloseIcon } from "@/components/icons";
import type {
  createUserGroup as createUserGroupAction,
  deleteUserGroup as deleteUserGroupAction,
  toggleUserGroupActive as toggleUserGroupActiveAction,
  updateUserGroupName as updateUserGroupNameAction,
} from "./actions";

type UserGroup = { id: string; name: string; is_active: boolean };

export function UserGroupManager({
  userGroups,
  createUserGroup,
  updateUserGroupName,
  toggleUserGroupActive,
  deleteUserGroup,
  onChanged,
}: {
  userGroups: UserGroup[];
  createUserGroup: typeof createUserGroupAction;
  updateUserGroupName: typeof updateUserGroupNameAction;
  toggleUserGroupActive: typeof toggleUserGroupActiveAction;
  deleteUserGroup: typeof deleteUserGroupAction;
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
      await updateUserGroupName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
      onChanged?.();
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleUserGroupActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบสถานะ "${name}"?` });
    if (!ok) return;
    try {
      await deleteUserGroup(id);
      await toastSuccess("ลบสถานะเรียบร้อยแล้ว");
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
      await createUserGroup(formData);
      await toastSuccess("เพิ่มสถานะเรียบร้อยแล้ว");
      form.reset();
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">สถานะผู้ใช้งาน</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อสถานะ</th>
              <th className="text-center">สถานะการใช้งาน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {userGroups.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2">
                  <input defaultValue={g.name} onBlur={(e) => handleRenameBlur(g.id, g.name, e)} className="input" />
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
            {userGroups.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีสถานะผู้ใช้งาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleCreate} className="flex gap-3">
        <input name="name" placeholder="ชื่อสถานะ เช่น เจ้าหน้าที่พัสดุ" required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
