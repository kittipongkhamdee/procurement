"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { TeacherMultiSelect } from "@/components/teacher-multi-select";

type AdminGroup = Pick<Tables<"plan_admin_groups">, "id" | "name">;
type BudgetSource = Pick<Tables<"plan_budget_sources">, "id" | "name">;
type Teacher = Pick<Tables<"plan_teachers">, "id" | "name" | "is_active">;

export function ProposalForm({
  action,
  budgetYearId,
  adminGroups,
  budgetSources,
  teachers,
}: {
  action: (formData: FormData) => void | Promise<void>;
  budgetYearId: string;
  adminGroups: AdminGroup[];
  budgetSources: BudgetSource[];
  teachers: Teacher[];
}) {
  const [responsible, setResponsible] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    try {
      await action(formData);
      await toastSuccess("ส่งข้อเสนอโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <form action={handleSubmit} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="budget_year_id" value={budgetYearId} />

      <div>
        <div className="card-title">ข้อมูลทั่วไป</div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="label">ชื่อโครงการ</label>
            <input name="name" required className="input" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">ลักษณะโครงการ</label>
              <select name="project_type" defaultValue="ใหม่" className="input">
                <option value="ใหม่">โครงการใหม่</option>
                <option value="ต่อเนื่อง">โครงการต่อเนื่อง</option>
              </select>
            </div>
            <div>
              <label className="label">กลุ่มบริหารที่รับผิดชอบ</label>
              <select name="admin_group_id" required defaultValue="" className="input">
                <option value="" disabled>
                  เลือกกลุ่มบริหาร..
                </option>
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">ผู้รับผิดชอบโครงการ</label>
            <TeacherMultiSelect teachers={teachers} value={responsible} onChange={setResponsible} />
            {responsible.map((n) => (
              <input key={n} type="hidden" name="responsible" value={n} />
            ))}
          </div>
          <div>
            <label className="label">สนองกลยุทธ์ / มาตรฐานการศึกษาข้อที่</label>
            <input name="strategy_alignment" className="input" placeholder="เช่น กลยุทธ์ที่ 2 มาตรฐานที่ 1.2" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">วันที่เริ่มต้น</label>
              <input type="date" name="start_date" className="input" />
            </div>
            <div>
              <label className="label">วันที่สิ้นสุด</label>
              <input type="date" name="end_date" className="input" />
            </div>
            <div>
              <label className="label">แหล่งเงินงบประมาณ</label>
              <select name="budget_source_id" defaultValue="" className="input">
                <option value="">ไม่ระบุ</option>
                {budgetSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">งบประมาณที่ใช้ (บาท)</label>
            <input type="number" step="0.01" name="budget_amount" className="input" placeholder="0.00" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="label">หลักการและเหตุผล</label>
        <textarea name="rationale" rows={4} className="input" />
      </div>

      <div>
        <label className="label">วัตถุประสงค์</label>
        <textarea name="objectives" rows={3} className="input" placeholder="ระบุเป็นข้อ ๆ" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">เป้าหมายเชิงปริมาณ</label>
          <textarea name="target_quantity" rows={3} className="input" />
        </div>
        <div>
          <label className="label">เป้าหมายเชิงคุณภาพ</label>
          <textarea name="target_quality" rows={3} className="input" />
        </div>
      </div>

      <div>
        <label className="label">ตัวชี้วัดความสำเร็จ</label>
        <textarea name="success_indicators" rows={3} className="input" />
      </div>

      <div>
        <label className="label">วิธีดำเนินการ / ขั้นตอนการดำเนินงาน</label>
        <textarea name="procedures" rows={4} className="input" placeholder="ระบุขั้นตอนหรือกิจกรรมหลัก" />
      </div>

      <div>
        <label className="label">ผลที่คาดว่าจะได้รับ</label>
        <textarea name="expected_results" rows={3} className="input" />
      </div>

      <div>
        <label className="label">การติดตามและประเมินผล</label>
        <textarea name="evaluation_method" rows={3} className="input" />
      </div>

      <button type="submit" className="btn-primary mt-2">
        ส่งข้อเสนอโครงการ
      </button>
    </form>
  );
}
