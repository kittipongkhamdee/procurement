"use client";

import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { updateUserFullName as updateUserFullNameAction } from "./actions";

export function UserNameField({
  userId,
  fullName,
  updateUserFullName,
}: {
  userId: string;
  fullName: string;
  updateUserFullName: typeof updateUserFullNameAction;
}) {
  async function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name || name === fullName) {
      e.target.value = fullName;
      return;
    }
    const formData = new FormData();
    formData.set("full_name", name);
    try {
      await updateUserFullName(userId, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
    } catch (err) {
      e.target.value = fullName;
      await toastError(errorMessage(err));
    }
  }

  return (
    <input
      defaultValue={fullName}
      onBlur={handleBlur}
      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
    />
  );
}
