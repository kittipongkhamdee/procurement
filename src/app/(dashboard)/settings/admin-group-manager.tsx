"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import type {
  createAdminGroup as createAdminGroupAction,
  deleteAdminGroup as deleteAdminGroupAction,
  toggleAdminGroupActive as toggleAdminGroupActiveAction,
  updateAdminGroupName as updateAdminGroupNameAction,
} from "./actions";

type AdminGroup = { id: string; name: string; is_active: boolean };

export function AdminGroupManager({
  adminGroups,
  createAdminGroup,
  updateAdminGroupName,
  toggleAdminGroupActive,
  deleteAdminGroup,
}: {
  adminGroups: AdminGroup[];
  createAdminGroup: typeof createAdminGroupAction;
  updateAdminGroupName: typeof updateAdminGroupNameAction;
  toggleAdminGroupActive: typeof toggleAdminGroupActiveAction;
  deleteAdminGroup: typeof deleteAdminGroupAction;
}) {
  async function handleRename(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateAdminGroupName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleAdminGroupActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบกลุ่มบริหาร "${name}"?` });
    if (!ok) return;
    try {
      await deleteAdminGroup(id);
      await toastSuccess("ลบกลุ่มบริหารเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createAdminGroup(formData);
      await toastSuccess("เพิ่มกลุ่มบริหารเรียบร้อยแล้ว");
      form.reset();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">กลุ่มบริหารงาน</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อกลุ่มบริหาร</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {adminGroups.map((g) => (
              <tr key={g.id}>
                <td className="p-0">
                  <form onSubmit={(e) => handleRename(g.id, e)} className="flex items-center gap-2 px-4 py-2">
                    <input name="name" defaultValue={g.name} className="input" />
                    <button type="submit" className="btn-secondary btn-sm shrink-0">
                      บันทึก
                    </button>
                  </form>
                </td>
                <td className="text-center">
                  <ToggleSwitch checked={g.is_active} onChange={() => handleToggle(g.id, g.is_active)} />
                </td>
                <td className="text-right whitespace-nowrap px-4">
                  <button type="button" onClick={() => handleDelete(g.id, g.name)} className="btn-danger btn-sm">
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
            {adminGroups.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีกลุ่มบริหาร
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleCreate} className="flex gap-3">
        <input name="name" placeholder="ชื่อกลุ่มบริหาร เช่น กลุ่มบริหารวิชาการ" required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
