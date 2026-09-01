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

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** หมุนรูป (ถ้ามี) และย่อ/บีบอัดรูปที่ใหญ่เกินไปด้วย canvas ก่อนอัปโหลด — รูปจากกล้องมือถือมักมีขนาดหลาย MB
 * ซึ่งเกินขีดจำกัดขนาด request ของเซิร์ฟเวอร์ (413 Request Entity Too Large) ถ้าไม่ย่อไว้ก่อน */
async function prepareFile(file: File, rotation: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const swapDims = rotation === 90 || rotation === 270;
  const srcW = swapDims ? bitmap.height : bitmap.width;
  const srcH = swapDims ? bitmap.width : bitmap.height;
  const needsResize = srcW > MAX_DIMENSION || srcH > MAX_DIMENSION;

  if (rotation === 0 && !needsResize) return file;

  const scale = needsResize ? MAX_DIMENSION / Math.max(srcW, srcH) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;
  return new File([blob], file.name, { type: "image/jpeg" });
}

export type ProjectReportPhotoUploadHandle = {
  /** หมุนรูป (ถ้ามี) แล้วอัปโหลดทั้งหมด คืนค่า ref ของไฟล์ที่อัปโหลดสำเร็จ */
  uploadAll: () => Promise<string[]>;
};

export const ProjectReportPhotoUpload =
  forwardRef<ProjectReportPhotoUploadHandle>(
    function ProjectReportPhotoUpload(_props, ref) {
      const [photos, setPhotos] = useState<Photo[]>([]);
      const [error, setError] = useState<string | null>(null);
      const inputRef = useRef<HTMLInputElement>(null);

      useImperativeHandle(ref, () => ({
        async uploadAll() {
          const refs: string[] = [];
          for (const photo of photos) {
            const prepared = await prepareFile(photo.file, photo.rotation);
            const formData = new FormData();
            formData.set("file", prepared);
            const res = await fetch(UPLOAD_ENDPOINT, {
              method: "POST",
              body: formData,
            });
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
        if (files.length > room)
          setError(`แนบได้สูงสุด ${MAX_PHOTOS} ภาพ (เพิ่มได้อีก ${room} ภาพ)`);

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
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  rotation: ((p.rotation + 90) % 360) as Photo["rotation"],
                }
              : p,
          ),
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
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-black/40 p-1.5">
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
    },
  );
