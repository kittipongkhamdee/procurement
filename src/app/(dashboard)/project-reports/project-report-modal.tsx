"use client";

import { useRef, type ReactNode } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import {
  ProjectReportForm,
  type Project,
  type ProjectReportInitial,
} from "./project-report-form";
import type {
  createProjectReport,
  extractBackgroundFromProposalFile as extractBackgroundFromProposalFileAction,
} from "./actions";

/** ปิด popup เองก็ต่อเมื่อบันทึกสำเร็จเท่านั้น (ไม่ใช้ closeOnSubmit ของ Modal ที่ปิดทันทีตอนกด
 * ไม่ว่าจะสำเร็จหรือพัง — เดิมทำให้กดบันทึกแล้ว popup หายไปเงียบๆ โดยไม่รู้ว่าสำเร็จหรือไม่)
 * ใช้ร่วมกันทั้งเสนอรายงานใหม่และแก้ไขรายงานเดิม — ใส่ initial มาก็เป็นโหมดแก้ไข */
export function ProjectReportModal({
  projects,
  action,
  aiExtractionEnabled,
  extractBackgroundFromProposalFile,
  title = "รายงานสรุปโครงการ",
  trigger = "+ รายงานโครงการใหม่",
  triggerClassName = "btn-primary",
  initial,
  submitLabel,
}: {
  projects: Project[];
  action: typeof createProjectReport;
  aiExtractionEnabled?: boolean;
  extractBackgroundFromProposalFile?: typeof extractBackgroundFromProposalFileAction;
  title?: string;
  trigger?: ReactNode;
  triggerClassName?: string;
  initial?: ProjectReportInitial;
  submitLabel?: string;
}) {
  const modalRef = useRef<ModalHandle>(null);

  return (
    <Modal
      ref={modalRef}
      title={title}
      trigger={trigger}
      triggerClassName={triggerClassName}
    >
      <ProjectReportForm
        projects={projects}
        action={action}
        aiExtractionEnabled={aiExtractionEnabled}
        extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
        onSuccess={() => modalRef.current?.close()}
        initial={initial}
        submitLabel={submitLabel}
      />
    </Modal>
  );
}
