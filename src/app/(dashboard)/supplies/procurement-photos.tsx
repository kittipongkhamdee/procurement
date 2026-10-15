"use client";

// รูปอ้างอิงของงานซื้อ/งานจ้าง (ใบส่งของ, ใบส่งมอบงาน, ใบเสร็จรับเงิน, ใบสำคัญรับเงิน ฯลฯ)
// อัปโหลดตรงจาก browser ไปปลายทางที่ระบบตั้งไว้ (Google Drive / Supabase) ย่อรูปก่อนส่ง แล้วบันทึก ref ลง proc_purchase_photos

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressPhotoFile } from "@/lib/image-resize";
import { uploadFileDirect } from "@/lib/storage/client-upload";
import { driveFileId, driveThumbnailUrl, driveViewUrl, isDriveRef } from "@/lib/storage/ref";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { Modal } from "@/components/modal";
import { TrashIcon, UploadIcon } from "@/components/icons";
import { addProcurementPhotos, deleteProcurementPhoto } from "./procurement-actions";

export const PHOTO_CATEGORIES = ["ใบส่งของ", "ใบส่งมอบงาน", "ใบเสร็จรับเงิน", "ใบสำคัญรับเงิน", "อื่นๆ"];

export type ProcurementPhoto = { id: string; category: string; file_ref: string; thumb: string; full: string };

/** โหลดรูปของรายการ พร้อม URL สำหรับแสดง (Drive = thumbnail/ลิงก์ดู, Supabase = signed URL 1 ชม.) */
export async function loadProcurementPhotos(requestId: string): Promise<ProcurementPhoto[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("proc_purchase_photos")
    .select("id, category, file_ref")
    .eq("purchase_request_id", requestId)
    .order("created_at");
  const rows = data ?? [];
  const paths = rows.map((r) => r.file_ref).filter((r) => !isDriveRef(r));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: s } = await supabase.storage.from("procurement-files").createSignedUrls(paths, 3600);
    s?.forEach((x) => x.signedUrl && signed.set(x.path ?? "", x.signedUrl));
  }
  return rows.map((r) =>
    isDriveRef(r.file_ref)
      ? { ...r, thumb: driveThumbnailUrl(driveFileId(r.file_ref), 600), full: driveViewUrl(driveFileId(r.file_ref)) }
      : { ...r, thumb: signed.get(r.file_ref) ?? "", full: signed.get(r.file_ref) ?? "" },
  );
}

/** แสดงรูปจัดกลุ่มตามประเภท (ใช้ทั้งใน popup รูปอ้างอิงและในรายละเอียด) */
export function PhotoGroups({ photos, onDelete }: { photos: ProcurementPhoto[]; onDelete?: (p: ProcurementPhoto) => void }) {
  const groups = [...PHOTO_CATEGORIES, ...new Set(photos.map((p) => p.category).filter((c) => !PHOTO_CATEGORIES.includes(c)))]
    .map((c) => [c, photos.filter((p) => p.category === c)] as const)
    .filter(([, list]) => list.length > 0);
  if (groups.length === 0) return <p className="text-sm text-slate-500">ยังไม่มีรูปอ้างอิง</p>;
  return (
    <div className="space-y-3">
      {groups.map(([cat, list]) => (
        <div key={cat}>
          <p className="mb-1 text-sm font-medium text-slate-700">
            {cat} ({list.length})
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((p) => (
              <div key={p.id} className="relative">
                <a href={p.full} target="_blank" rel="noopener" className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก Drive/signed URL ภายนอก */}
                  <img src={p.thumb} alt={cat} className="aspect-[3/4] w-full object-cover" loading="lazy" />
                </a>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    aria-label="ลบรูป"
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 shadow hover:bg-white"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** ปุ่ม "อัพรูปอ้างอิง" (ยังไม่มีรูป) / "รูปอ้างอิง (n)" — เปิด popup ดูรูปเป็นกลุ่ม และอัปโหลดเพิ่ม (เฉพาะเจ้าหน้าที่) */
export function ProcurementPhotosButton({
  requestId,
  count,
  canEdit,
  onChanged,
}: {
  requestId: string;
  count: number;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<ProcurementPhoto[] | null>(null);
  const [category, setCategory] = useState(PHOTO_CATEGORIES[0]);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadProcurementPhotos(requestId).then((p) => alive && setPhotos(p));
    return () => {
      alive = false;
    };
  }, [open, requestId]);

  async function refresh() {
    setPhotos(await loadProcurementPhotos(requestId));
    onChanged();
  }

  async function upload(files: FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      await toastError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    const uploaded: { category: string; ref: string }[] = [];
    try {
      for (const [i, file] of list.entries()) {
        setProgress(`กำลังอัปโหลด ${i + 1}/${list.length}`);
        const small = await compressPhotoFile(file);
        const res = await uploadFileDirect(small, {
          pathPrefix: "procurement-photos",
          finalize: true,
          onProgress: (p) => setProgress(`กำลังอัปโหลด ${i + 1}/${list.length} (${p}%)`),
        });
        if (!res.ref) {
          await toastError(`อัปโหลดไม่สำเร็จ: ${res.error ?? ""}`);
          break;
        }
        uploaded.push({ category, ref: res.ref });
      }
      if (uploaded.length > 0) {
        const res = await addProcurementPhotos(requestId, uploaded);
        if (res.error) {
          await toastError(res.error);
          return;
        }
        await toastSuccess(`อัปโหลด${category} ${uploaded.length} รูปแล้ว`);
        await refresh();
      }
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setProgress(null);
    }
  }

  async function remove(p: ProcurementPhoto) {
    if (!(await confirmDelete({ title: "ลบรูปนี้?", text: p.category }))) return;
    const res = await deleteProcurementPhoto(p.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await refresh();
  }

  if (count === 0 && !canEdit) return null;
  return (
    <Modal
      title="รูปอ้างอิง"
      wide
      lazy
      onOpenChange={setOpen}
      trigger={
        <span className={count > 0 ? "btn-secondary btn-sm" : "btn-secondary btn-sm border-amber-300 text-amber-800"}>
          <UploadIcon className="h-3.5 w-3.5" />
          {count > 0 ? `รูปอ้างอิง (${count})` : "อัพรูปอ้างอิง"}
        </span>
      }
    >
      {canEdit && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="label">ประเภทเอกสาร</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {PHOTO_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <label className={`btn-primary cursor-pointer ${progress ? "pointer-events-none opacity-60" : ""}`}>
            <UploadIcon className="h-4 w-4" />
            {progress ?? "เลือกรูป / ถ่ายรูป"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {photos === null ? <p className="text-sm text-slate-500">กำลังโหลด...</p> : <PhotoGroups photos={photos} onDelete={canEdit ? remove : undefined} />}
    </Modal>
  );
}
