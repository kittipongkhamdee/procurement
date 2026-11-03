"use client";

// ฟอร์มสัญญาจ้างเหมาบริการ (ธุรการ/นักการภารโรง/อื่นๆ) + ผนวก 1 TOR — กรอกครั้งเดียว ออกเอกสารเป็น PDF/Word
// ใช้ในหน้า "สัญญาจ้าง" ร่วมกับสัญญาจ้างครูอัตราจ้าง

import { useRef, useState } from "react";
import { toastError, toastSuccess, errorMessage } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ThaiAddressInput } from "@/components/thai-address-input";
import { PencilIcon, PlusIcon } from "@/components/icons";
import { JOB_PRESETS, installmentsAndTotal, type ServiceHireContract } from "@/lib/service-hire-contract";
import { todayTh } from "@/lib/thai";
import { saveServiceHire } from "./actions";

type Project = { id: string; name: string; budget_source_id: string | null };
type Activity = { id: string; project_id: string; name: string };
type Source = { id: string; name: string };
export type ServiceOptions = { projects: Project[]; activities: Activity[]; sources: Source[] };
export type ServiceDefaults = { school: string; tambon: string; amphoe: string; province: string; director: string };

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function ServiceHireModal({
  contract,
  defaults,
  options,
  nextNo,
  onSaved,
}: {
  contract: ServiceHireContract | null;
  defaults: ServiceDefaults;
  options: ServiceOptions;
  nextNo: string;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const c = contract;
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState(c?.job_kind ?? "ธุรการ");
  const preset = JOB_PRESETS[kind] ?? JOB_PRESETS["อื่นๆ"];
  const [jobTitle, setJobTitle] = useState(c?.job_title ?? JOB_PRESETS["ธุรการ"].job_title);
  const [torRole, setTorRole] = useState(c?.tor_job_role ?? JOB_PRESETS["ธุรการ"].tor_job_role);
  const [torEdu, setTorEdu] = useState(c?.tor_education ?? JOB_PRESETS["ธุรการ"].tor_education);
  const [torScope, setTorScope] = useState(c?.tor_scope ?? JOB_PRESETS["ธุรการ"].tor_scope);
  const [start, setStart] = useState<string | null>(c?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(c?.end_date ?? null);
  const [monthly, setMonthly] = useState(c?.monthly_rate != null ? String(c.monthly_rate) : "");
  const [installments, setInstallments] = useState(c?.installments != null ? String(c.installments) : "");
  const [total, setTotal] = useState(c?.total_amount != null ? String(c.total_amount) : "");
  const [projectId, setProjectId] = useState(c?.project_id ?? "");
  const [activityId, setActivityId] = useState(c?.activity_id ?? "");
  const [sourceId, setSourceId] = useState(c?.budget_source_id ?? "");
  const projectActivities = options.activities.filter((a) => a.project_id === projectId);

  function changeKind(next: string) {
    setKind(next);
    const p = JOB_PRESETS[next] ?? JOB_PRESETS["อื่นๆ"];
    // เปลี่ยนตำแหน่ง → เติมงานที่จ้าง/คุณสมบัติ/ขอบเขตงานตามแบบสำเร็จรูป (แก้ต่อได้) ยกเว้น "อื่นๆ" ที่ไม่ล้างข้อความที่พิมพ์ไว้
    if (next !== "อื่นๆ") {
      setJobTitle(p.job_title);
      setTorRole(p.tor_job_role);
      setTorEdu(p.tor_education);
      setTorScope(p.tor_scope);
    }
  }

  function recalc(s: string | null, e: string | null, m: string) {
    const r = installmentsAndTotal(s, e, m ? Number(m) : null);
    if (r) {
      setInstallments(String(r.installments));
      setTotal(String(r.total));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await saveServiceHire(c?.id ?? null, new FormData(e.currentTarget));
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("บันทึกสัญญาเรียบร้อยแล้ว");
      onSaved();
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      ref={modalRef}
      lazy
      wide
      title={c ? `แก้ไขสัญญา ${c.contract_no}` : "เพิ่มสัญญาจ้างเหมาบริการ"}
      trigger={
        c ? (
          <>
            <PencilIcon className="h-3.5 w-3.5" /> แก้ไข
          </>
        ) : (
          <>
            <PlusIcon className="h-4 w-4" /> เพิ่มสัญญาจ้างเหมาบริการ
          </>
        )
      }
      triggerClassName={c ? "btn-secondary btn-sm" : "btn-secondary"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">สัญญา</legend>
          <Field label="ตำแหน่งที่จ้าง (เลือกแล้วเติมงาน คุณสมบัติ ขอบเขตงานให้ แก้ต่อได้)" wide>
            <select name="job_kind" value={kind} onChange={(e) => changeKind(e.target.value)} className="input w-full">
              {Object.keys(JOB_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {kind === "นักการภารโรง" && <p className="mt-1 text-xs text-amber-700">ขอบเขตงาน/คุณสมบัติของนักการภารโรงเป็นร่างตั้งต้น กรุณาตรวจและแก้ให้ตรงกับที่โรงเรียนกำหนดก่อนใช้จริง</p>}
          </Field>
          <Field label="เลขที่สัญญา">
            <input name="contract_no" defaultValue={c?.contract_no ?? nextNo} required className="input w-full" />
          </Field>
          <Field label="วันที่ทำสัญญา">
            <ThaiDatePicker name="contract_date" defaultValue={c?.contract_date ?? todayTh()} required />
          </Field>
          <Field label="ทำสัญญา ณ (ชื่อสถานที่)" wide>
            <input name="place" defaultValue={c?.place ?? defaults.school} className="input w-full" />
          </Field>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <Field label="ตำบล">
              <input name="place_tambon" defaultValue={c?.place_tambon ?? defaults.tambon} className="input w-full" />
            </Field>
            <Field label="อำเภอ">
              <input name="place_amphoe" defaultValue={c?.place_amphoe ?? defaults.amphoe} className="input w-full" />
            </Field>
            <Field label="จังหวัด">
              <input name="place_province" defaultValue={c?.place_province ?? defaults.province} className="input w-full" />
            </Field>
          </div>
          <Field label="ผู้ว่าจ้าง (ผู้อำนวยการ)" wide>
            <input name="employer_name" defaultValue={c?.employer_name ?? ""} placeholder={defaults.director ? `ว่าง = ใช้ตามหน้าตั้งค่า (${defaults.director})` : "ว่าง = ใช้ตามหน้าตั้งค่า"} className="input w-full" />
          </Field>
          <Field label="งานที่จ้าง (ข้อ 1.1 และ TOR ข้อ 1)" wide>
            <input name="job_title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required className="input w-full" />
          </Field>
          <Field label="โครงการ" wide>
            <select
              name="project_id"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setActivityId("");
                const src = options.projects.find((p) => p.id === e.target.value)?.budget_source_id;
                if (src) setSourceId(src);
              }}
              className="input w-full"
            >
              <option value="">-- ไม่ระบุ --</option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="กิจกรรม" wide>
            <select name="activity_id" value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!projectId} className="input w-full disabled:bg-slate-50">
              <option value="">{projectId ? "-- ไม่ระบุ --" : "เลือกโครงการก่อน"}</option>
              {projectActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="แหล่งงบประมาณ" wide>
            <select name="budget_source_id" value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {options.sources.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ระยะเวลาและค่าจ้าง (คำนวณให้จากวันที่และอัตราต่อเดือน แก้เองได้)</legend>
          <Field label="วันเริ่มสัญญา">
            <ThaiDatePicker name="start_date" value={start} onChange={(v) => { setStart(v); recalc(v, end, monthly); }} />
          </Field>
          <Field label="วันสิ้นสุดสัญญา">
            <ThaiDatePicker name="end_date" value={end} onChange={(v) => { setEnd(v); recalc(start, v, monthly); }} />
          </Field>
          <Field label="ค่าจ้างต่อเดือน (บาท)">
            <input name="monthly_rate" type="number" min="0" step="0.01" value={monthly} onChange={(e) => { setMonthly(e.target.value); recalc(start, end, e.target.value); }} className="input w-full" />
          </Field>
          <Field label="จำนวนงวด">
            <input name="installments" type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} className="input w-full" />
          </Field>
          <Field label="ค่าจ้างรวมตามสัญญา (บาท)" wide>
            <input name="total_amount" type="number" min="0" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} className="input w-full" />
          </Field>
          <Field label="วันและเวลาทำการ (ข้อ 4)" wide>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <input name="work_day_from" defaultValue={c?.work_day_from ?? "จันทร์"} placeholder="ตั้งแต่วัน" className="input w-full" />
              <input name="work_day_to" defaultValue={c?.work_day_to ?? "ศุกร์"} placeholder="ถึงวัน" className="input w-full" />
              <input name="work_time_from" defaultValue={c?.work_time_from ?? "08:30"} placeholder="เวลาเริ่ม" className="input w-full" />
              <input name="work_time_to" defaultValue={c?.work_time_to ?? "16:30"} placeholder="เวลาเลิก" className="input w-full" />
              <input name="employer_status" defaultValue={c?.employer_status ?? "สถานศึกษาของรัฐ"} placeholder="สถานะผู้ว่าจ้าง" className="input w-full" />
            </div>
          </Field>
          <Field label="คืนเงินที่เหลือจากการหักภายใน (วัน)">
            <input name="refund_days" type="number" min="0" defaultValue={c?.refund_days ?? 15} className="input w-full" />
          </Field>
          <Field label="ค่าปรับต่อวันเมื่อไม่มาปฏิบัติงาน (บาท) — ไม่กรอกก็ได้">
            <input name="penalty_per_day" type="number" min="0" step="0.01" defaultValue={c?.penalty_per_day ?? ""} className="input w-full" />
          </Field>
          <Field label="ผนวก 1 (รายละเอียดงาน) จำนวนหน้า">
            <input name="annex1_pages" type="number" min="0" defaultValue={c?.annex1_pages ?? ""} className="input w-full" />
          </Field>
          <Field label="ผนวก 2 (ใบเสนอราคา) จำนวนหน้า — ไม่มีให้เว้นว่าง">
            <input name="annex2_pages" type="number" min="0" defaultValue={c?.annex2_pages ?? ""} className="input w-full" />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ผู้รับจ้าง</legend>
          <Field label="ชื่อ-นามสกุล (รวมคำนำหน้า)" wide>
            <input name="hiree_name" defaultValue={c?.hiree_name ?? ""} required className="input w-full" />
          </Field>
          <Field label="เลขบัตรประจำตัวประชาชน">
            <input name="id_card" defaultValue={c?.id_card ?? ""} inputMode="numeric" className="input w-full" />
          </Field>
          <Field label="โทรศัพท์">
            <input name="phone" defaultValue={c?.phone ?? ""} className="input w-full" />
          </Field>
          <Field label="บ้านเลขที่">
            <input name="house_no" defaultValue={c?.house_no ?? ""} className="input w-full" />
          </Field>
          <Field label="ถนน">
            <input name="road" defaultValue={c?.road ?? ""} className="input w-full" />
          </Field>
          <div className="sm:col-span-2">
            <ThaiAddressInput defaultValue={{ tambon: c?.tambon, amphoe: c?.amphoe, province: c?.province, zipcode: c?.zipcode }} />
          </div>
          <Field label="ธนาคาร (บัญชีรับเงินโอน)">
            <input name="bank_name" defaultValue={c?.bank_name ?? ""} className="input w-full" />
          </Field>
          <Field label="สาขา">
            <input name="bank_branch" defaultValue={c?.bank_branch ?? ""} className="input w-full" />
          </Field>
          <Field label="ชื่อบัญชี">
            <input name="bank_account_name" defaultValue={c?.bank_account_name ?? ""} className="input w-full" />
          </Field>
          <Field label="เลขที่บัญชี">
            <input name="bank_account_no" defaultValue={c?.bank_account_no ?? ""} className="input w-full" />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ผนวก 1 ขอบเขตของงาน (TOR)</legend>
          <Field label="ชื่อตำแหน่งในคุณสมบัติข้อ 3.9 (เช่น เจ้าหน้าที่ธุรการโรงเรียน)">
            <input name="tor_job_role" value={torRole} onChange={(e) => setTorRole(e.target.value)} className="input w-full" />
          </Field>
          <Field label="วุฒิการศึกษา (คุณสมบัติข้อ 3.3)">
            <input name="tor_education" value={torEdu} onChange={(e) => setTorEdu(e.target.value)} className="input w-full" />
          </Field>
          <Field label="ขอบเขตรายละเอียดของงานที่จ้าง (ข้อ 4) — 1 บรรทัดต่อ 1 ข้อ">
            <textarea name="tor_scope" value={torScope} onChange={(e) => setTorScope(e.target.value)} rows={7} className="input w-full" />
          </Field>
          {preset.tor_scope === "" && kind === "อื่นๆ" && <p className="text-xs text-slate-500">ตำแหน่งอื่นๆ: กรอกขอบเขตงานเองในช่องด้านบน</p>}
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">พยาน</legend>
          <Field label="พยานคนที่ 1">
            <input name="witness1_name" defaultValue={c?.witness1_name ?? ""} className="input w-full" />
          </Field>
          <Field label="พยานคนที่ 2">
            <input name="witness2_name" defaultValue={c?.witness2_name ?? ""} className="input w-full" />
          </Field>
        </fieldset>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </form>
    </Modal>
  );
}
