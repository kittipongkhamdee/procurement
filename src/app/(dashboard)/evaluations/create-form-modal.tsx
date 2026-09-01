"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, type ModalHandle } from "@/components/modal";
import { errorMessage, toastError } from "@/lib/swal";
import type { createForm as createFormAction } from "./actions";

type Project = { id: string; name: string };
type Template = { id: string; title: string };

export function CreateFormModal({
  projects,
  templates,
  createForm,
}: {
  projects: Project[];
  templates: Template[];
  createForm: typeof createFormAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const id = await createForm(formData);
      modalRef.current?.close();
      router.push(`/evaluations/${id}/edit`);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal ref={modalRef} title="สร้างแบบประเมินใหม่" trigger="+ สร้างแบบประเมินใหม่" triggerClassName="btn-primary">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label">โครงการ</label>
          <select name="project_id" required className="input">
            <option value="" disabled>
              เลือกโครงการ..
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ชื่อแบบประเมิน</label>
          <input name="title" required className="input" placeholder="เช่น แบบประเมินความพึงพอใจโครงการ..." />
        </div>
        <div>
          <label className="label">คำอธิบาย (ไม่บังคับ)</label>
          <textarea name="description" rows={2} className="input" placeholder="แสดงให้ผู้ตอบแบบประเมินเห็น" />
        </div>
        {templates.length > 0 && (
          <div>
            <label className="label">เริ่มจาก Template (ไม่บังคับ)</label>
            <select name="template_source_id" className="input">
              <option value="">เริ่มจากว่าง</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "กำลังสร้าง..." : "สร้างและไปหน้าแก้ไข"}
        </button>
      </form>
    </Modal>
  );
}
