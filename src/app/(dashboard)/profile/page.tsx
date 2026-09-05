"use client";

// หน้าโปรไฟล์ของฉัน — เปลี่ยนรูปประจำตัว + เปลี่ยนรหัสผ่าน ของบัญชีตัวเอง (ไม่ใช่หน้าจัดการผู้ใช้คนอื่น
// ซึ่งอยู่ที่ /admin/users) ย่อรูปฝั่ง client ก่อนอัปโหลดเสมอ (resizeAvatarFile) กันรูปจากกล้องมือถือ
// ขนาดหลาย MB ทำให้อัปโหลดช้า/กินพื้นที่จัดเก็บเกินจำเป็นสำหรับแค่วงกลมเล็กๆ ในแถบเมนู

import { useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { resizeAvatarFile } from "@/lib/image-resize";
import { LockIcon, UserIcon } from "@/components/icons";
import { changePassword, removeAvatar, uploadAvatar } from "./actions";

export default function ProfilePage() {
  const { displayName, roleLabel, avatarUrl, loading, refresh } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      await toastError("ไฟล์รูปใหญ่เกินไป (สูงสุด 8MB) กรุณาเลือกไฟล์ที่เล็กกว่านี้");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const resized = await resizeAvatarFile(file);
      const fd = new FormData();
      fd.set("avatar", resized);
      await uploadAvatar(fd);
      await refresh();
      await toastSuccess("อัปโหลดรูปประจำตัวแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    const confirmed = await confirmDelete({ title: "ลบรูปประจำตัว?", text: "จะกลับไปแสดงเป็นตัวอักษรย่อแทน" });
    if (!confirmed) return;
    setRemoving(true);
    try {
      await removeAvatar();
      await refresh();
      await toastSuccess("ลบรูปประจำตัวแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const fd = new FormData();
      fd.set("new_password", newPassword);
      fd.set("confirm_password", confirmPassword);
      await changePassword(fd);
      setNewPassword("");
      setConfirmPassword("");
      await toastSuccess("เปลี่ยนรหัสผ่านแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const initial = displayName ? displayName.trim().charAt(0) : "?";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">โปรไฟล์ของฉัน</h1>
          <p className="page-subtitle">จัดการรูปประจำตัวและรหัสผ่านของบัญชีคุณ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-title mb-4 flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            รูปประจำตัว
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold-500">
              {loading ? (
                <span className="h-full w-full animate-pulse bg-slate-200" />
              ) : avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} width={96} height={96} unoptimized className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-navy-950">{initial}</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <p className="truncate text-sm font-medium text-slate-800">{displayName}</p>
              {roleLabel && <p className="truncate text-xs text-slate-400">{roleLabel}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
                id="avatar-input"
              />
              <div className="mt-1 flex gap-2">
                <label
                  htmlFor="avatar-input"
                  className={`btn-secondary btn-sm cursor-pointer ${uploading ? "pointer-events-none opacity-50" : ""}`}
                >
                  {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={removing}
                    className="btn-secondary btn-sm text-red-600 disabled:opacity-50"
                  >
                    {removing ? "กำลังลบ..." : "ลบรูป"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title mb-4 flex items-center gap-2">
            <LockIcon className="h-4 w-4" />
            เปลี่ยนรหัสผ่าน
          </div>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label htmlFor="new_password" className="label">
                รหัสผ่านใหม่
              </label>
              <input
                id="new_password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="label">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                id="confirm_password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
