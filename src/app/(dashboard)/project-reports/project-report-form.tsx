"use client";

import { useMemo, useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";

type Project = { id: string; name: string; budget: number | null };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export function ProjectReportForm({
  projects,
  action,
}: {
  projects: Project[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [projectId, setProjectId] = useState("");
  const [objectives, setObjectives] = useState<string[]>([""]);
  const [budgetApproved, setBudgetApproved] = useState("");
  const [budgetUsed, setBudgetUsed] = useState("");

  const budgetRemaining = useMemo(() => {
    const approved = parseFloat(budgetApproved);
    const used = parseFloat(budgetUsed);
    if (Number.isNaN(approved) || Number.isNaN(used)) return null;
    return approved - used;
  }, [budgetApproved, budgetUsed]);

  function handleProjectChange(id: string) {
    setProjectId(id);
    const project = projects.find((p) => p.id === id);
    if (project?.budget != null) setBudgetApproved(String(project.budget));
  }

  function updateObjective(index: number, value: string) {
    setObjectives((prev) => prev.map((o, i) => (i === index ? value : o)));
  }

  async function handleSubmit(formData: FormData) {
    formData.set("objectives_json", JSON.stringify(objectives));
    try {
      await action(formData);
      await toastSuccess("บันทึกรายงานโครงการเรียบร้อยแล้ว");
      setProjectId("");
      setObjectives([""]);
      setBudgetApproved("");
      setBudgetUsed("");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4">
      <div>
        <div className="card-title">1. ส่วนหัวรายงาน</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">ชื่อโครงการ</label>
            <select
              name="project_id"
              required
              value={projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="input"
            >
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
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <input name="responsible_name" className="input" placeholder="ชื่อ-นามสกุล และตำแหน่ง/กลุ่มสาระฯ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">เริ่มดำเนินงาน</label>
              <input type="date" name="period_start" className="input" />
            </div>
            <div>
              <label className="label">สิ้นสุดดำเนินงาน</label>
              <input type="date" name="period_end" className="input" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">2. หลักการและวัตถุประสงค์</div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">ความเป็นมา (สรุปเหตุผลที่จัดโครงการนี้)</label>
            <textarea name="background" rows={2} className="input" />
          </div>
          <div>
            <label className="label">วัตถุประสงค์</label>
            <div className="grid grid-cols-1 gap-2">
              {objectives.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={o}
                    onChange={(e) => updateObjective(i, e.target.value)}
                    className="input"
                    placeholder={`เพื่อ...`}
                  />
                  {objectives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setObjectives((prev) => prev.filter((_, idx) => idx !== i))}
                      className="btn-danger btn-sm shrink-0"
                    >
                      ลบ
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setObjectives((prev) => [...prev, ""])}
              className="btn-secondary btn-sm mt-2"
            >
              + เพิ่มวัตถุประสงค์
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">3. ผลการดำเนินงานโครงการ</div>
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">เชิงปริมาณ: เป้าหมาย</label>
              <input name="quantity_goal" className="input" placeholder="เช่น ผู้เข้าร่วม 50 คน" />
            </div>
            <div>
              <label className="label">เชิงปริมาณ: ผลที่ทำได้จริง</label>
              <input name="quantity_actual" className="input" placeholder="เช่น ผู้เข้าร่วม 52 คน (104%)" />
            </div>
          </div>
          <div>
            <label className="label">เชิงคุณภาพ</label>
            <textarea
              name="quality_result"
              rows={2}
              className="input"
              placeholder="ผู้เข้าร่วมได้รับความรู้อะไรบ้าง หรือเกิดการเปลี่ยนแปลงอย่างไร"
            />
          </div>
          <div className="sm:w-56">
            <label className="label">ผลการประเมินความพึงพอใจ (ร้อยละ)</label>
            <input type="number" step="0.01" name="satisfaction_percent" className="input" placeholder="0.00" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">งบประมาณที่ได้รับอนุมัติ</label>
              <input
                type="number"
                step="0.01"
                name="budget_approved"
                value={budgetApproved}
                onChange={(e) => setBudgetApproved(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">งบประมาณที่ใช้ไปจริง</label>
              <input
                type="number"
                step="0.01"
                name="budget_used"
                value={budgetUsed}
                onChange={(e) => setBudgetUsed(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">คงเหลือ</label>
              <div className="input flex items-center bg-slate-50 font-medium text-slate-600">
                {budgetRemaining != null ? `${formatBaht(budgetRemaining)} บาท` : "-"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">4. สรุปภาพรวมและข้อเสนอแนะ</div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">จุดเด่น / ประสบความสำเร็จ</label>
            <textarea name="highlights" rows={2} className="input" />
          </div>
          <div>
            <label className="label">ปัญหาและอุปสรรค</label>
            <textarea name="problems" rows={2} className="input" />
          </div>
          <div>
            <label className="label">ข้อเสนอแนะในการปรับปรุงครั้งต่อไป</label>
            <textarea name="recommendations" rows={2} className="input" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">5. ส่วนท้าย (ลงนาม)</div>
        <div className="sm:w-72">
          <label className="label">ชื่อผู้รายงาน</label>
          <input name="reporter_name" className="input" placeholder="ชื่อ-นามสกุลผู้รายงาน" />
        </div>
      </div>

      <button type="submit" className="btn-primary mt-2">
        บันทึกรายงานโครงการ
      </button>
    </form>
  );
}
