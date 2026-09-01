"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { compressPhotoFile } from "@/lib/image-resize";

const UPLOAD_ENDPOINT = "/api/project-report-photo-upload";
const MAX_PHOTOS = 4;
const JPEG_QUALITY = 0.82;

type Photo = {
  id: string;
  /** null สำหรับรูปเดิมที่เคยอัปโหลดไว้แล้ว (โหมดแก้ไข) — เก็บไว้แค่ ref ไม่ต้องอัปโหลดซ้ำ */
  file: File | null;
  /** ref เดิมของรูปนี้ ถ้ามาจากรายงานที่เคยบันทึกไว้แล้ว */
  existingRef?: string;
  /** ไฟล์ที่ย่อ/บีบอัดแล้ว (rotation = 0) เตรียมไว้ล่วงหน้าตั้งแต่ตอนเลือกรูป — ไม่ต้องรอทำตอนกดบันทึก
   * ทำให้ตอนกดบันทึกจริงเหลือแค่หมุน (ถ้ามี) รูปที่เล็กอยู่แล้ว ซึ่งเร็วกว่ามากเมื่อเทียบกับไฟล์ต้นฉบับหลาย MB */
  preparedFile: File | null;
  previewUrl: string;
  /** จำนวนองศาที่หมุนตามเข็มนาฬิกา (0/90/180/270) — ใช้ทั้งพรีวิวและตอนอัปโหลดจริง (เฉพาะรูปใหม่) */
  rotation: 0 | 90 | 180 | 270;
};

/** หมุนรูปที่เตรียม/ย่อไว้แล้วด้วย canvas — ทำงานเร็วเพราะไฟล์ต้นทางเล็กอยู่แล้ว */
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/jpeg" });
}

async function uploadPreparedFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: formData });
  let body: { ref?: string; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // เซิร์ฟเวอร์อาจตอบกลับเป็นข้อความธรรมดา (เช่น 413 Request Entity Too Large) ไม่ใช่ JSON — ใช้ข้อความสำรองด้านล่างแทน
  }
  if (!res.ok || !body.ref) {
    throw new Error(
      body.error ||
        (res.status === 413
          ? "ไฟล์ภาพขนาดใหญ่เกินไป กรุณาใช้ไฟล์ขนาดเล็กลง"
          : "อัปโหลดภาพถ่ายไม่สำเร็จ"),
    );
  }
  return body.ref;
}

export type ProjectReportPhotoUploadHandle = {
  /** หมุนรูปใหม่ (ถ้ามี) แล้วอัปโหลดทั้งหมดพร้อมกัน คืนค่า ref ของรูปทั้งหมด (รูปเดิมที่เก็บไว้ + รูปใหม่ที่อัปโหลดสำเร็จ) */
  uploadAll: () => Promise<string[]>;
};

export type ExistingPhoto = { ref: string; url: string };

export const ProjectReportPhotoUpload = forwardRef<
  ProjectReportPhotoUploadHandle,
  { initialPhotos?: ExistingPhoto[] }
>(function ProjectReportPhotoUpload({ initialPhotos }, ref) {
  const [photos, setPhotos] = useState<Photo[]>(
    () =>
      initialPhotos?.map((p) => ({
        id: crypto.randomUUID(),
        file: null,
        existingRef: p.ref,
        preparedFile: null,
        previewUrl: p.url,
        rotation: 0 as const,
      })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    async uploadAll() {
      return Promise.all(
        photos.map(async (photo) => {
          if (photo.existingRef) return photo.existingRef;
          if (!photo.file) throw new Error("อัปโหลดภาพถ่ายไม่สำเร็จ");
          const base = photo.preparedFile ?? (await compressPhotoFile(photo.file));
          const rotated = await rotateFile(base, photo.rotation);
          return uploadPreparedFile(rotated);
        }),
      );
    },
  }));

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room)
      setError(`แนบได้สูงสุด ${MAX_PHOTOS} ภาพ (เพิ่มได้อีก ${room} ภาพ)`);

    const accepted = files.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preparedFile: null,
      previewUrl: URL.createObjectURL(file),
      rotation: 0 as const,
    }));
    setPhotos((prev) => [...prev, ...accepted]);

    // เริ่มย่อ/บีบอัดรูปทันทีตอนเลือกไฟล์ ไม่ต้องรอถึงตอนกดบันทึก — ทำให้ตอนบันทึกจริงเร็วขึ้นมาก
    for (const p of accepted) {
      compressPhotoFile(p.file).then((preparedFile) => {
        setPhotos((prev) =>
          prev.map((photo) =>
            photo.id === p.id ? { ...photo, preparedFile } : photo,
          ),
        );
      });
    }
  }

  function rotatePhoto(id: string) {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, rotation: ((p.rotation + 90) % 360) as Photo["rotation"] }
          : p,
      ),
    );
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && !target.existingRef) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const p = photos[i];
          if (p) {
            return (
              <div
                key={p.id}
                className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimizable remote asset */}
                <img
                  src={p.previewUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform"
                  style={{ transform: `rotate(${p.rotation}deg)` }}
                />
                {!p.existingRef && !p.preparedFile && (
                  <div className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    กำลังเตรียมรูป...
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-black/40 p-1.5">
                  {!p.existingRef && (
                    <button
                      type="button"
                      onClick={() => rotatePhoto(p.id)}
                      aria-label="หมุนภาพ"
                      className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                    >
                      ⟳ หมุน
                    </button>
                  )}
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
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/50 text-navy-700 transition-colors hover:border-navy-400 hover:bg-navy-50"
            >
              <span className="text-2xl leading-none">+</span>
              <span className="text-xs font-semibold">เพิ่มรูปภาพ</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        แนบภาพถ่ายกิจกรรมที่เด่น ๆ ได้สูงสุด {MAX_PHOTOS} ภาพ (ไม่บังคับ)
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
