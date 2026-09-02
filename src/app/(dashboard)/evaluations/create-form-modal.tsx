"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, type ModalHandle } from "@/components/modal";
import { confirmWarning, errorMessage, toastError } from "@/lib/swal";
import type { createForm as createFormAction } from "./actions";

type Project = { id: string; name: string };
type Template = { id: string; title: string };

export function CreateFormModal({
  projects,
  templates,
  existingProjectIds,
  createForm,
}: {
  projects: Project[];
  templates: Template[];
  existingProjectIds: string[];
  createForm: typeof createFormAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  // เติมชื่อแบบประเมินให้อัตโนมัติตามโครงการที่เลือก (ครูแก้เองได้ตามปกติ — เติมให้ต่อเมื่อยังไม่ได้
  // พิมพ์เองหรือชื่อยังตรงกับที่ระบบเติมให้ครั้งก่อน กันไม่ให้ทับสิ่งที่ครูตั้งใจพิมพ์เอง)
  function handleProjectChange(projectId: string) {
    if (titleTouched) return;
    const project = projects.find((p) => p.id === projectId);
    setTitle(project ? `แบบประเมินความพึงพอใจ${project.name}` : "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    // โครงการนี้มีแบบประเมินอยู่แล้ว — เตือนก่อนสร้างซ้ำ แต่ไม่บังคับ (บางโครงการอาจต้องประเมิน
    // มากกว่า 1 รอบ/ครั้งจริงๆ) ผู้ใช้กด "ดำเนินการต่อ" เพื่อข้ามคำเตือนนี้ได้
    const projectId = String(formData.get("project_id") ?? "");
    if (existingProjectIds.includes(projectId)) {
      const proceed = await confirmWarning({
        title: "โครงการนี้มีแบบประเมินความพึงพอใจอยู่แล้ว",
        text: "ต้องการสร้างแบบประเมินซ้ำสำหรับโครงการนี้อีกหรือไม่?",
      });
      if (!proceed) return;
    }

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
          <select name="project_id" required className="input" onChange={(e) => handleProjectChange(e.target.value)}>
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
          <input
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            required
            className="input"
            placeholder="เช่น แบบประเมินความพึงพอใจโครงการ..."
          />
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
