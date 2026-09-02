"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TrashIcon } from "@/components/icons";
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
    <button
      type="button"
      onClick={handleDelete}
      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
    >
      <TrashIcon className="h-3.5 w-3.5" />
      ลบ
    </button>
  );
}
