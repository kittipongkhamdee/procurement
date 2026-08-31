"use client";

import { useRef, useState } from "react";
import { displayNameForRef } from "@/lib/storage/ref";
import { UploadIcon } from "@/components/icons";

const UPLOAD_ENDPOINT = "/api/proposal-file-upload";

export function ProposalFileUpload({
  name,
  label,
  accept,
  initialPath,
  onPathChange,
}: {
  name: string;
  label: string;
  accept: string;
  /** ref ไฟล์ที่บันทึกไว้แล้ว (โหมดแก้ไข) — ถ้ากดลบไฟล์นี้จะไม่ลบออกจาก storage ทันที รอให้บันทึกฟอร์มก่อน */
  initialPath?: string | null;
  /** แจ้ง ref ไฟล์ปัจจุบันขึ้นไปยัง component แม่ (เช่น เพื่อใช้เป็นต้นฉบับให้ AI อ่าน) */
  onPathChange?: (path: string | null) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(initialPath ? displayNameForRef(initialPath) : null);
  const [path, setPath] = useState<string | null>(initialPath ?? null);
  const [isNew, setIsNew] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    setProgress(0);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const ref = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", UPLOAD_ENDPOINT);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          let body: { ref?: string; error?: string } = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            // ignore parse error, handled below
          }
          if (xhr.status >= 200 && xhr.status < 300 && body.ref) resolve(body.ref);
          else reject(new Error(body.error || "อัปโหลดไฟล์ไม่สำเร็จ"));
        };
        xhr.onerror = () => reject(new Error("อัปโหลดไฟล์ไม่สำเร็จ"));
        xhr.send(formData);
      });

      setPath(ref);
      setIsNew(true);
      setProgress(100);
      onPathChange?.(ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
      setFileName(null);
      setPath(null);
      onPathChange?.(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (path && isNew) {
      await fetch(UPLOAD_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: path }),
      }).catch(() => {});
    }
    setPath(null);
    setFileName(null);
    setIsNew(false);
    setProgress(0);
    setError(null);
    onPathChange?.(null);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={path ?? ""} />
      <input ref={inputRef} type="file" accept={accept} onChange={handleSelect} className="hidden" />
      {!fileName && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-navy-200 bg-navy-50/50 px-3 py-5 text-navy-700 transition-colors hover:border-navy-400 hover:bg-navy-50"
        >
          <UploadIcon className="h-6 w-6" />
          <span className="text-sm font-semibold">เลือกไฟล์</span>
        </button>
      )}
      {fileName && (
        <div className="rounded-xl border-2 border-navy-200 bg-navy-50/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-700">{fileName}</span>
            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                aria-label="ลบไฟล์"
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                ✕
              </button>
            )}
          </div>
          {uploading && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-navy-700 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
