"use client";

import { useId, useRef } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type {
  createActivity as createActivityAction,
  deleteActivity as deleteActivityAction,
  deleteProject as deleteProjectAction,
  updateActivity as updateActivityAction,
  updateProject as updateProjectAction,
} from "./actions";

type Activity = { id: string; name: string | null; budget: number; responsible: string | null };
type Option = { id: string; name: string };

export function ProjectEditModal({
  projectId,
  name,
  budgetYearId,
  adminGroupId,
  budgetSourceId,
  activities,
  adminGroups,
  budgetSources,
  updateProject,
  deleteProject,
  createActivity,
  updateActivity,
  deleteActivity,
}: {
  projectId: string;
  name: string;
  budgetYearId: string;
  adminGroupId: string;
  budgetSourceId: string | null;
  activities: Activity[];
  adminGroups: Option[];
  budgetSources: Option[];
  updateProject: typeof updateProjectAction;
  deleteProject: typeof deleteProjectAction;
  createActivity: typeof createActivityAction;
  updateActivity: typeof updateActivityAction;
  deleteActivity: typeof deleteActivityAction;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const projectFormId = useId();

  async function handleUpdateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateProject(projectId, formData);
      await toastSuccess("บันทึกข้อมูลโครงการเรียบร้อยแล้ว");
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDeleteProject() {
    const ok = await confirmDelete({
      title: `ลบโครงการ "${name}"?`,
      text: "กิจกรรมย่อยทั้งหมดในโครงการนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนได้",
    });
    if (!ok) return;
    try {
      await deleteProject(projectId);
      await toastSuccess("ลบโครงการเรียบร้อยแล้ว");
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreateActivity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createActivity(projectId, formData);
      await toastSuccess("เพิ่มกิจกรรมย่อยเรียบร้อยแล้ว");
      form.reset();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleUpdateActivity(activityId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateActivity(activityId, formData);
      await toastSuccess("บันทึกกิจกรรมย่อยเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDeleteActivity(activityId: string, activityName: string) {
    const ok = await confirmDelete({ title: `ลบกิจกรรม "${activityName}"?` });
    if (!ok) return;
    try {
      await deleteActivity(activityId);
      await toastSuccess("ลบกิจกรรมย่อยเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <Modal
      ref={modalRef}
      title={`แก้ไขโครงการ: ${name}`}
      trigger="แก้ไข"
      triggerClassName="text-xs font-medium text-navy-800 hover:underline"
    >
      <form id={projectFormId} onSubmit={handleUpdateProject} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="budget_year_id" value={budgetYearId} />
        <div className="sm:col-span-2">
          <label className="label">ชื่อโครงการ</label>
          <input name="name" defaultValue={name} required className="input" />
        </div>
        <div>
          <label className="label">กลุ่มบริหาร</label>
          <select name="admin_group_id" defaultValue={adminGroupId} required className="input">
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">แหล่งเงินงบประมาณ</label>
          <select name="budget_source_id" defaultValue={budgetSourceId ?? ""} className="input">
            <option value="">ไม่ระบุ</option>
            {budgetSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="card-title">กิจกรรมย่อย</div>
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200/80">
          <div className="hidden grid-cols-[1fr_8rem_8rem_11rem] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div>ชื่อกิจกรรม</div>
            <div>งบประมาณ</div>
            <div>ผู้รับผิดชอบ</div>
            <div></div>
          </div>
          <div className="divide-y divide-slate-100">
            {activities.map((a) => (
              <form
                key={a.id}
                onSubmit={(e) => handleUpdateActivity(a.id, e)}
                className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[1fr_8rem_8rem_11rem] sm:items-center"
              >
                <div>
                  <label className="label sm:hidden">ชื่อกิจกรรม</label>
                  <input name="name" defaultValue={a.name ?? ""} className="input" />
                </div>
                <div>
                  <label className="label sm:hidden">งบประมาณ</label>
                  <input
                    type="number"
                    step="0.01"
                    name="budget"
                    defaultValue={a.budget}
                    className="input text-right"
                  />
                </div>
                <div>
                  <label className="label sm:hidden">ผู้รับผิดชอบ</label>
                  <input name="responsible" defaultValue={a.responsible ?? ""} className="input" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="submit" className="btn-secondary btn-sm">
                    บันทึก
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(a.id, a.name ?? "กิจกรรมนี้")}
                    className="btn-danger btn-sm"
                  >
                    ลบ
                  </button>
                </div>
              </form>
            ))}
            {activities.length === 0 && <div className="table-empty">ยังไม่มีกิจกรรมย่อย</div>}
          </div>
        </div>
        <form
          onSubmit={handleCreateActivity}
          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
        >
          <input name="name" placeholder="ชื่อกิจกรรมใหม่" required className="input" />
          <input type="number" step="0.01" name="budget" placeholder="งบประมาณ" className="input text-right" />
          <input name="responsible" placeholder="ผู้รับผิดชอบ" className="input" />
          <button type="submit" title="เพิ่มกิจกรรม" aria-label="เพิ่มกิจกรรมย่อย" className="icon-btn-add justify-self-end">
            <PlusIcon className="h-5 w-5" />
          </button>
        </form>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <button type="submit" form={projectFormId} className="btn-primary w-full">
          บันทึกการแก้ไข
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 p-3.5">
        <p className="mb-2 text-xs text-red-700">การลบโครงการจะลบกิจกรรมย่อยทั้งหมดไปด้วย และไม่สามารถกู้คืนได้</p>
        <button type="button" onClick={handleDeleteProject} className="btn-danger btn-sm">
          <TrashIcon className="h-4 w-4" />
          ลบโครงการนี้
        </button>
      </div>
    </Modal>
  );
}
