"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "procurement-files";
const PATH_PREFIX = "project-proposals";

export function ProposalFileUpload({
  name,
  label,
  accept,
}: {
  name: string;
  label: string;
  accept: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
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
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("กรุณาเข้าสู่ระบบ");

      const ext = file.name.split(".").pop();
      const newPath = `${PATH_PREFIX}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${newPath}`,
        );
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("อัปโหลดไฟล์ไม่สำเร็จ"));
        };
        xhr.onerror = () => reject(new Error("อัปโหลดไฟล์ไม่สำเร็จ"));
        xhr.send(file);
      });

      setPath(newPath);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ");
      setFileName(null);
      setPath(null);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (path) {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([path]);
    }
    setPath(null);
    setFileName(null);
    setProgress(0);
    setError(null);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={path ?? ""} />
      {!fileName && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary btn-sm"
          >
            เลือกไฟล์
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleSelect}
            className="hidden"
          />
        </>
      )}
      {fileName && (
        <div className="rounded-lg border border-slate-200 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm text-slate-700">{fileName}</span>
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
