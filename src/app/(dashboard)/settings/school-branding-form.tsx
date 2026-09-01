"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setSchoolName as setSchoolNameAction, uploadSchoolLogo as uploadSchoolLogoAction } from "./actions";

export function SchoolBrandingForm({
  schoolName,
  logoUrl,
  setSchoolName,
  uploadSchoolLogo,
  onChanged,
}: {
  schoolName: string;
  logoUrl: string | null;
  setSchoolName: typeof setSchoolNameAction;
  uploadSchoolLogo: typeof uploadSchoolLogoAction;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleSaveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingName(true);
    try {
      const fd = new FormData();
      fd.set("school_name", name);
      await setSchoolName(fd);
      await toastSuccess("บันทึกชื่อโรงเรียนแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      await uploadSchoolLogo(fd);
      await toastSuccess("อัปโหลดโลโก้แล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-gold-400 bg-navy-950">
          {logoUrl ? (
            <Image src={logoUrl} alt={schoolName} width={80} height={80} unoptimized className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-gold-400">{schoolName.charAt(0) || "ร"}</span>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleLogoChange}
          className="hidden"
          id="school-logo-input"
        />
        <label
          htmlFor="school-logo-input"
          className={`btn-secondary btn-sm cursor-pointer ${uploadingLogo ? "pointer-events-none opacity-50" : ""}`}
        >
          {uploadingLogo ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้"}
        </label>
      </div>

      <form onSubmit={handleSaveName} className="flex-1 space-y-3">
        <div>
          <label className="label">ชื่อโรงเรียน</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </div>
        <button type="submit" disabled={savingName} className="btn-primary">
          {savingName ? "กำลังบันทึก..." : "บันทึกชื่อโรงเรียน"}
        </button>
      </form>
    </div>
  );
}
