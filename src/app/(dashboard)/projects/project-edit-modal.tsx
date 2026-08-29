"use client";

import { useRef } from "react";
import { Modal, type ModalHandle } from "@/components/modal";
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

  async function handleUpdateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateProject(projectId, formData);
      await toastSuccess("บันทึกข้อมูลโครงการเรียบร้อยแล้ว");
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
      <form onSubmit={handleUpdateProject} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <button type="submit" className="btn-primary sm:col-span-2">
          บันทึกการแก้ไข
        </button>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="card-title">กิจกรรมย่อย</div>
        <div className="table-shell mb-3">
          <table className="table-base">
            <thead>
              <tr>
                <th>ชื่อกิจกรรม</th>
                <th className="text-right">งบประมาณ</th>
                <th>ผู้รับผิดชอบ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => (
                <tr key={a.id}>
                  <td colSpan={4} className="p-0">
                    <form
                      onSubmit={(e) => handleUpdateActivity(a.id, e)}
                      className="grid grid-cols-1 items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
                    >
                      <input name="name" defaultValue={a.name ?? ""} className="input" />
                      <input
                        type="number"
                        step="0.01"
                        name="budget"
                        defaultValue={a.budget}
                        className="input text-right"
                      />
                      <input name="responsible" defaultValue={a.responsible ?? ""} className="input" />
                      <div className="flex justify-end gap-2">
                        <button type="submit" className="text-xs font-medium text-navy-800 hover:underline">
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(a.id, a.name ?? "กิจกรรมนี้")}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          ลบ
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    ยังไม่มีกิจกรรมย่อย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <form
          onSubmit={handleCreateActivity}
          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
        >
          <input name="name" placeholder="ชื่อกิจกรรมใหม่" required className="input" />
          <input type="number" step="0.01" name="budget" placeholder="งบประมาณ" className="input text-right" />
          <input name="responsible" placeholder="ผู้รับผิดชอบ" className="input" />
          <button type="submit" className="btn-secondary">
            เพิ่ม
          </button>
        </form>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <button type="button" onClick={handleDeleteProject} className="text-xs font-medium text-red-600 hover:underline">
          ลบโครงการนี้
        </button>
      </div>
    </Modal>
  );
}
