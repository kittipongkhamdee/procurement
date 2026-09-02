"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { resizeLogoFile } from "@/lib/image-resize";
import type {
  removeSchoolLogo as removeSchoolLogoAction,
  setSchoolName as setSchoolNameAction,
  uploadSchoolLogo as uploadSchoolLogoAction,
} from "./actions";

export function SchoolBrandingForm({
  schoolName,
  logoUrl,
  setSchoolName,
  uploadSchoolLogo,
  removeSchoolLogo,
  onChanged,
}: {
  schoolName: string;
  logoUrl: string | null;
  setSchoolName: typeof setSchoolNameAction;
  uploadSchoolLogo: typeof uploadSchoolLogoAction;
  removeSchoolLogo: typeof removeSchoolLogoAction;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(schoolName);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);

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
    if (file.size > 8 * 1024 * 1024) {
      await toastError("ไฟล์โลโก้ใหญ่เกินไป (สูงสุด 8MB) กรุณาเลือกไฟล์ที่เล็กกว่านี้");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadingLogo(true);
    try {
      const resized = await resizeLogoFile(file);
      const fd = new FormData();
      fd.set("logo", resized);
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

  async function handleRemoveLogo() {
    const confirmed = await confirmDelete({ title: "ลบโลโก้โรงเรียน?", text: "จะกลับไปแสดงเป็นตัวอักษรย่อแทน" });
    if (!confirmed) return;
    setRemovingLogo(true);
    try {
      await removeSchoolLogo();
      await toastSuccess("ลบโลโก้แล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setRemovingLogo(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <div
          className={
            logoUrl
              ? "flex h-20 w-20 items-center justify-center"
              : "flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-950"
          }
        >
          {logoUrl ? (
            <Image src={logoUrl} alt={schoolName} width={80} height={80} unoptimized className="h-full w-full object-contain" />
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
        <div className="flex gap-2">
          <label
            htmlFor="school-logo-input"
            className={`btn-secondary btn-sm cursor-pointer ${uploadingLogo ? "pointer-events-none opacity-50" : ""}`}
          >
            {uploadingLogo ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้"}
          </label>
          {logoUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              disabled={removingLogo}
              className="btn-secondary btn-sm text-red-600 disabled:opacity-50"
            >
              {removingLogo ? "กำลังลบ..." : "ลบโลโก้"}
            </button>
          )}
        </div>
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
