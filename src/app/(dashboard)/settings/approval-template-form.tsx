"use client";

import { useRef, useState } from "react";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { removeApprovalTemplate as removeApprovalTemplateAction, uploadApprovalTemplate as uploadApprovalTemplateAction } from "./actions";

export function ApprovalTemplateForm({
  hasCustomTemplate,
  uploadApprovalTemplate,
  removeApprovalTemplate,
  onChanged,
}: {
  hasCustomTemplate: boolean;
  uploadApprovalTemplate: typeof uploadApprovalTemplateAction;
  removeApprovalTemplate: typeof removeApprovalTemplateAction;
  onChanged: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmed = await confirmWarning({
      title: "แทนที่เทมเพลตเดิม?",
      text: "ถ้าตำแหน่งช่องกรอกในไฟล์ใหม่ต่างจากเดิม ข้อความที่ระบบเขียนทับอาจไม่ตรงช่อง ต้องแจ้งให้ปรับพิกัดในโค้ดใหม่ให้ตรงกับไฟล์นี้",
      confirmButtonText: "อัปโหลด",
    });
    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("template", file);
      await uploadApprovalTemplate(fd);
      await toastSuccess("อัปโหลดเทมเพลตแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    const confirmed = await confirmDelete({ title: "กลับไปใช้เทมเพลตเริ่มต้น?", text: "จะลบไฟล์ที่อัปโหลดเองและใช้เทมเพลตเดิมของระบบแทน" });
    if (!confirmed) return;
    setRemoving(true);
    try {
      await removeApprovalTemplate();
      await toastSuccess("กลับไปใช้เทมเพลตเริ่มต้นแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        สถานะปัจจุบัน:{" "}
        {hasCustomTemplate ? (
          <span className="badge-emerald">ใช้เทมเพลตที่อัปโหลดเอง</span>
        ) : (
          <span className="badge-slate">ใช้เทมเพลตเริ่มต้นของระบบ</span>
        )}
      </p>
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ ตำแหน่งที่ระบบเขียนข้อความทับ (เลขที่หนังสือ, วันที่, รายการ ฯลฯ) คำนวณให้ตรงกับหน้าตาเทมเพลต
        ปัจจุบันเท่านั้น ถ้าอัปโหลดไฟล์ที่ย้ายตำแหน่งช่องกรอกไปจากเดิม ข้อความจะเขียนไม่ตรงช่อง —
        เหมาะกับกรณีแก้ไขเล็กน้อย (เปลี่ยนคำ/โลโก้/ตราครุฑ) โดยไม่ขยับตำแหน่งช่องเดิม ถ้าเปลี่ยนโครงร่าง
        เอกสารทั้งหมด ต้องแจ้งให้ปรับพิกัดในโค้ดใหม่ให้ตรงกับไฟล์ที่อัปโหลดด้วย
      </div>
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" id="approval-template-input" />
      <div className="flex gap-2">
        <label
          htmlFor="approval-template-input"
          className={`btn-secondary btn-sm cursor-pointer ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          {uploading ? "กำลังอัปโหลด..." : "อัปโหลดเทมเพลต PDF ใหม่"}
        </label>
        {hasCustomTemplate && (
          <button type="button" onClick={handleRemove} disabled={removing} className="btn-secondary btn-sm text-red-600 disabled:opacity-50">
            {removing ? "กำลังลบ..." : "กลับไปใช้เทมเพลตเริ่มต้น"}
          </button>
        )}
      </div>
    </div>
  );
}
