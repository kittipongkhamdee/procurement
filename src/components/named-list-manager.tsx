"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { CloseIcon } from "@/components/icons";

type Item = { id: string; name: string; is_active: boolean };

export function NamedListManager({
  title,
  itemLabel,
  placeholder,
  items,
  createItem,
  updateItemName,
  toggleItemActive,
  deleteItem,
  onChanged,
}: {
  title: string;
  itemLabel: string;
  placeholder: string;
  items: Item[];
  createItem: (formData: FormData) => Promise<void> | void;
  updateItemName: (id: string, formData: FormData) => Promise<void> | void;
  toggleItemActive: (id: string, isActive: boolean) => Promise<void> | void;
  deleteItem: (id: string) => Promise<void> | void;
  /** เรียกหลัง mutation สำเร็จทุกครั้ง — ใช้เมื่อ items มาจาก state ฝั่ง client (ไม่ใช่ props จาก
   * Server Component) เพื่อให้หน้าพ่อ refetch รายการใหม่ได้ ไม่จำเป็นต้องส่งถ้า items มาจากพ่อที่เป็น
   * Server Component อยู่แล้ว (revalidatePath ในแต่ละ action จะทำให้พ่อ re-render เองตามปกติ) */
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
      await updateItemName(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
      onChanged?.();
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleItemActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบ "${name}"?` });
    if (!ok) return;
    try {
      await deleteItem(id);
      await toastSuccess("ลบเรียบร้อยแล้ว");
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
      await createItem(formData);
      await toastSuccess("เพิ่มเรียบร้อยแล้ว");
      form.reset();
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>{itemLabel}</th>
              <th className="text-center">สถานะการใช้งาน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2">
                  <input
                    defaultValue={item.name}
                    onBlur={(e) => handleRenameBlur(item.id, item.name, e)}
                    className="input"
                  />
                </td>
                <td className="text-center">
                  <ToggleSwitch checked={item.is_active} onChange={() => handleToggle(item.id, item.is_active)} />
                </td>
                <td className="text-right whitespace-nowrap px-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.name)}
                    className="icon-btn-danger"
                    aria-label="ลบ"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleCreate} className="flex gap-3">
        <input name="name" placeholder={placeholder} required className="input" />
        <button type="submit" className="btn-primary shrink-0">
          เพิ่ม
        </button>
      </form>
    </div>
  );
}
