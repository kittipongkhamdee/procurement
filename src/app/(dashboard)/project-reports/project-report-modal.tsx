"use client";

import { useRef } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { ProjectReportForm, type Project } from "./project-report-form";
import type {
  createProjectReport,
  extractBackgroundFromProposalFile as extractBackgroundFromProposalFileAction,
} from "./actions";

/** ปิด popup เองก็ต่อเมื่อบันทึกสำเร็จเท่านั้น (ไม่ใช้ closeOnSubmit ของ Modal ที่ปิดทันทีตอนกด
 * ไม่ว่าจะสำเร็จหรือพัง — เดิมทำให้กดบันทึกแล้ว popup หายไปเงียบๆ โดยไม่รู้ว่าสำเร็จหรือไม่) */
export function ProjectReportModal({
  projects,
  action,
  aiExtractionEnabled,
  extractBackgroundFromProposalFile,
}: {
  projects: Project[];
  action: typeof createProjectReport;
  aiExtractionEnabled?: boolean;
  extractBackgroundFromProposalFile?: typeof extractBackgroundFromProposalFileAction;
}) {
  const modalRef = useRef<ModalHandle>(null);

  return (
    <Modal
      ref={modalRef}
      title="รายงานสรุปโครงการ"
      trigger="+ รายงานโครงการใหม่"
      triggerClassName="btn-primary"
    >
      <ProjectReportForm
        projects={projects}
        action={action}
        aiExtractionEnabled={aiExtractionEnabled}
        extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
        onSuccess={() => modalRef.current?.close()}
      />
    </Modal>
  );
}
