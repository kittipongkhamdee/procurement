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
  textSizeClass = "text-xs",
}: {
  id: string;
  fileUrl: string | null;
  photoRefs: string[];
  projectName: string;
  action: typeof deleteProjectReport;
  onChanged?: () => void;
  /** ขนาดตัวหนังสือ — การ์ดมือถือใช้ text-xs ให้เข้ากับ meta บรรทัดเล็ก ส่วนตารางจอกว้างใช้
   * text-sm ให้เท่ากับเซลล์อื่นในแถวเดียวกัน */
  textSizeClass?: string;
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
      className={`inline-flex items-center gap-1 ${textSizeClass} font-medium text-red-600 hover:underline`}
    >
      <TrashIcon className="h-3.5 w-3.5" />
      ลบ
    </button>
  );
}
