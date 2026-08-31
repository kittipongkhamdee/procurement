"use client";

import { useMemo, useRef, useState } from "react";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ProjectReportPhotoUpload, type ProjectReportPhotoUploadHandle } from "@/components/project-report-photo-upload";

type Project = { id: string; name: string; budget: number | null };

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function ListField({
  label,
  placeholder,
  values,
  onChange,
  addLabel,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={v}
              onChange={(e) => onChange(values.map((row, idx) => (idx === i ? e.target.value : row)))}
              className="input"
              placeholder={placeholder}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                className="btn-danger btn-sm shrink-0"
              >
                ลบ
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...values, ""])} className="btn-secondary btn-sm mt-2">
        {addLabel}
      </button>
    </div>
  );
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
  const [highlights, setHighlights] = useState<string[]>([""]);
  const [problems, setProblems] = useState<string[]>([""]);
  const [recommendations, setRecommendations] = useState<string[]>([""]);
  const [budgetApproved, setBudgetApproved] = useState("");
  const [budgetUsed, setBudgetUsed] = useState("");
  const photoUploadRef = useRef<ProjectReportPhotoUploadHandle>(null);

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

  async function handleSubmit(formData: FormData) {
    try {
      const photoRefs = await photoUploadRef.current?.uploadAll();
      formData.set("objectives_json", JSON.stringify(objectives));
      formData.set("highlights_json", JSON.stringify(highlights));
      formData.set("problems_json", JSON.stringify(problems));
      formData.set("recommendations_json", JSON.stringify(recommendations));
      formData.set("photo_refs_json", JSON.stringify(photoRefs ?? []));
      await action(formData);
      await toastSuccess("บันทึกรายงานโครงการเรียบร้อยแล้ว");
      setProjectId("");
      setObjectives([""]);
      setHighlights([""]);
      setProblems([""]);
      setRecommendations([""]);
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
          <ListField
            label="วัตถุประสงค์"
            placeholder="เพื่อ..."
            values={objectives}
            onChange={setObjectives}
            addLabel="+ เพิ่มวัตถุประสงค์"
          />
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
        <div className="grid grid-cols-1 gap-4">
          <ListField
            label="จุดเด่น / ประสบความสำเร็จ"
            placeholder="สิ่งที่ทำได้ดีในโครงการนี้..."
            values={highlights}
            onChange={setHighlights}
            addLabel="+ เพิ่มจุดเด่น"
          />
          <ListField
            label="ปัญหาและอุปสรรค"
            placeholder="ปัญหาที่เจอระหว่างดำเนินงาน..."
            values={problems}
            onChange={setProblems}
            addLabel="+ เพิ่มปัญหา"
          />
          <ListField
            label="ข้อเสนอแนะในการปรับปรุงครั้งต่อไป"
            placeholder="แนวทางแก้ไขสำหรับปีหน้า..."
            values={recommendations}
            onChange={setRecommendations}
            addLabel="+ เพิ่มข้อเสนอแนะ"
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="card-title">5. ภาพถ่ายกิจกรรม</div>
        <ProjectReportPhotoUpload ref={photoUploadRef} />
      </div>

      <button type="submit" className="btn-primary mt-2">
        บันทึกรายงานโครงการ
      </button>
    </form>
  );
}
