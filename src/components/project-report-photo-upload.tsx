"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

const UPLOAD_ENDPOINT = "/api/project-report-photo-upload";
const MAX_PHOTOS = 4;

type Photo = {
  id: string;
  file: File;
  previewUrl: string;
  /** จำนวนองศาที่หมุนตามเข็มนาฬิกา (0/90/180/270) — ใช้ทั้งพรีวิวและตอนอัปโหลดจริง */
  rotation: 0 | 90 | 180 | 270;
};

/** หมุนรูปจริงตามองศาที่เลือกด้วย canvas แล้วคืนเป็นไฟล์ใหม่ ก่อนอัปโหลด — ทำให้ไฟล์ที่เก็บไว้มีทิศทางถูกต้องแล้ว ไม่ต้องพึ่งการหมุนตอนแสดงผลใน PDF */
async function rotateFile(file: File, rotation: number): Promise<File> {
  if (rotation === 0) return file;

  const bitmap = await createImageBitmap(file);
  const swapDims = rotation === 90 || rotation === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swapDims ? bitmap.height : bitmap.width;
  canvas.height = swapDims ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type || "image/jpeg", 0.92));
  if (!blob) return file;
  return new File([blob], file.name, { type: file.type || "image/jpeg" });
}

export type ProjectReportPhotoUploadHandle = {
  /** หมุนรูป (ถ้ามี) แล้วอัปโหลดทั้งหมด คืนค่า ref ของไฟล์ที่อัปโหลดสำเร็จ */
  uploadAll: () => Promise<string[]>;
};

export const ProjectReportPhotoUpload = forwardRef<ProjectReportPhotoUploadHandle>(function ProjectReportPhotoUpload(
  _props,
  ref,
) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    async uploadAll() {
      const refs: string[] = [];
      for (const photo of photos) {
        const rotated = await rotateFile(photo.file, photo.rotation);
        const formData = new FormData();
        formData.set("file", rotated);
        const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: formData });
        const body = (await res.json()) as { ref?: string; error?: string };
        if (!res.ok || !body.ref) throw new Error(body.error || "อัปโหลดภาพถ่ายไม่สำเร็จ");
        refs.push(body.ref);
      }
      return refs;
    },
  }));

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setError(`แนบได้สูงสุด ${MAX_PHOTOS} ภาพ (เพิ่มได้อีก ${room} ภาพ)`);

    const accepted = files.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      rotation: 0 as const,
    }));
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function rotatePhoto(id: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as Photo["rotation"] } : p)),
    );
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleSelect} className="hidden" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable remote asset */}
            <img
              src={p.previewUrl}
              alt=""
              className="h-full w-full object-cover transition-transform"
              style={{ transform: `rotate(${p.rotation}deg)` }}
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-black/40 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => rotatePhoto(p.id)}
                aria-label="หมุนภาพ"
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
              >
                ⟳ หมุน
              </button>
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label="ลบภาพ"
                className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 hover:bg-white"
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/50 text-navy-700 transition-colors hover:border-navy-400 hover:bg-navy-50"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs font-semibold">เพิ่มรูปภาพ</span>
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">แนบภาพถ่ายกิจกรรมที่เด่น ๆ ได้สูงสุด {MAX_PHOTOS} ภาพ (ไม่บังคับ)</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
