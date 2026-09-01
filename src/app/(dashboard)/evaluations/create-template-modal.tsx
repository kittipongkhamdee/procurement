"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, type ModalHandle } from "@/components/modal";
import { errorMessage, toastError } from "@/lib/swal";
import type { createTemplate as createTemplateAction } from "./actions";

export function CreateTemplateModal({ createTemplate }: { createTemplate: typeof createTemplateAction }) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const id = await createTemplate(formData);
      modalRef.current?.close();
      router.push(`/evaluations/${id}/edit`);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal ref={modalRef} title="สร้าง Template คำถามใหม่" trigger="+ สร้าง Template ใหม่" triggerClassName="btn-secondary">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">ชื่อ Template</label>
          <input name="title" required className="input" placeholder="เช่น แบบประเมินความพึงพอใจมาตรฐาน" />
        </div>
        <div>
          <label className="label">คำอธิบาย (ไม่บังคับ)</label>
          <textarea name="description" rows={2} className="input" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "กำลังสร้าง..." : "สร้างและไปหน้าแก้ไข"}
        </button>
      </form>
    </Modal>
  );
}
