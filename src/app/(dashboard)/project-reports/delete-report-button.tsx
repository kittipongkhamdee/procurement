"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { deleteProjectReport } from "./actions";

export function DeleteReportButton({
  id,
  fileUrl,
  photoRefs,
  projectName,
  action,
  onChanged,
}: {
  id: string;
  fileUrl: string | null;
  photoRefs: string[];
  projectName: string;
  action: typeof deleteProjectReport;
  onChanged?: () => void;
}) {
  async function handleDelete() {
    const ok = await confirmDelete({ title: `ลบรายงานโครงการ "${projectName}"?` });
    if (!ok) return;
    try {
      await action(id, fileUrl, photoRefs);
      await toastSuccess("ลบรายงานโครงการเรียบร้อยแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <button type="button" onClick={handleDelete} className="text-xs font-medium text-red-600 hover:underline">
      ลบ
    </button>
  );
}
