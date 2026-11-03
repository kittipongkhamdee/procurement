"use client";

// สัญญาจ้างครูอัตราจ้าง — กรอกข้อมูลครั้งเดียว ออกเอกสาร 4 ส่วน (สัญญาจ้าง เงื่อนไขประกอบ สัญญาค้ำประกัน คำยินยอมคู่สมรส)
// เป็น PDF/Word ข้อมูลมีเลขบัตรประชาชนและที่อยู่ จึงให้เฉพาะ admin/เจ้าหน้าที่พัสดุ/เจ้าหน้าที่การเงินเข้าถึง (RLS)

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatBaht, formatThaiDate, todayTh } from "@/lib/thai";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ThaiAddressInput } from "@/components/thai-address-input";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { fixThaiTypo, type TeacherHireContract } from "@/lib/teacher-hire-contract";
import { deleteTeacherHire, saveTeacherHire } from "./actions";
import { ContractFileButtons } from "../contract-list";

const STAFF = ["admin", "supply_officer", "finance_officer"];

type Defaults = { place: string; director: string };
type Project = { id: string; name: string; budget_source_id: string | null };
type Activity = { id: string; project_id: string; name: string };
type Source = { id: string; name: string };
type Options = { projects: Project[]; activities: Activity[]; sources: Source[] };

/** จำนวนเดือน (ปัดขึ้น) ระหว่างวันเริ่ม–สิ้นสุดสัญญา เช่น 1 ต.ค. – 31 มี.ค. = 6 เดือน */
function monthsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end || end < start) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  let months = (ey - sy) * 12 + (em - sm);
  if (ed >= sd - 1) months += 1;
  return Math.max(months, 1);
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ContractModal({ contract, defaults, options, onSaved }: { contract: TeacherHireContract | null; defaults: Defaults; options: Options; onSaved: () => void }) {
  const modalRef = useRef<ModalHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [start, setStart] = useState<string | null>(contract?.start_date ?? null);
  const [end, setEnd] = useState<string | null>(contract?.end_date ?? null);
  const [months, setMonths] = useState(contract?.months != null ? String(contract.months) : "");
  const c = contract;
  const [projectId, setProjectId] = useState(c?.project_id ?? "");
  const [activityId, setActivityId] = useState(c?.activity_id ?? "");
  const [sourceId, setSourceId] = useState(c?.budget_source_id ?? "");
  const projectActivities = options.activities.filter((a) => a.project_id === projectId);

  function onDates(s: string | null, e: string | null) {
    const m = monthsBetween(s, e);
    if (m) setMonths(String(m));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await saveTeacherHire(c?.id ?? null, new FormData(e.currentTarget));
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
      title={c ? `แก้ไขสัญญา ${c.contract_no}` : "เพิ่มสัญญาจ้างครูอัตราจ้าง"}
      trigger={
        c ? (
          <>
            <PencilIcon className="h-3.5 w-3.5" /> แก้ไข
          </>
        ) : (
          <>
            <PlusIcon className="h-4 w-4" /> เพิ่มสัญญา
          </>
        )
      }
      triggerClassName={c ? "btn-secondary btn-sm" : "btn-primary"}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">สัญญา</legend>
          <Field label="เลขที่สัญญา">
            <input name="contract_no" defaultValue={c?.contract_no ?? ""} required placeholder="เช่น 7/2569" className="input w-full" />
          </Field>
          <Field label="วันที่ทำสัญญา">
            <ThaiDatePicker name="contract_date" defaultValue={c?.contract_date ?? todayTh()} required />
          </Field>
          <Field label="ทำสัญญา ณ (สถานที่)" wide>
            <input name="place" defaultValue={c?.place ?? defaults.place} className="input w-full" />
          </Field>
          <Field label="ผู้ว่าจ้าง (ผู้อำนวยการ)" wide>
            <input name="employer_name" defaultValue={c?.employer_name ?? ""} placeholder={defaults.director ? `ว่าง = ใช้ตามหน้าตั้งค่า (${defaults.director})` : "ว่าง = ใช้ตามหน้าตั้งค่า"} className="input w-full" />
          </Field>
          <Field label="โครงการ" wide>
            <select
              name="project_id"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setActivityId("");
                // แหล่งงบประมาณเริ่มต้นตามโครงการที่เลือก (แก้ทับได้)
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
          <Field label="ตำแหน่งที่จ้าง">
            <input name="position_title" defaultValue={c?.position_title ?? "ครูอัตราจ้าง"} className="input w-full" />
          </Field>
          <Field label="อัตราเงินเดือน (บาท)">
            <input name="salary" type="number" min="0" step="0.01" defaultValue={c?.salary ?? ""} className="input w-full" />
          </Field>
          <Field label="วันเริ่มสัญญา">
            <ThaiDatePicker name="start_date" value={start} onChange={(v) => { setStart(v); onDates(v, end); }} />
          </Field>
          <Field label="วันสิ้นสุดสัญญา">
            <ThaiDatePicker name="end_date" value={end} onChange={(v) => { setEnd(v); onDates(start, v); }} />
          </Field>
          <Field label="ระยะเวลาจ้าง (เดือน) — คำนวณจากวันที่ แก้เองได้">
            <input name="months" type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} className="input w-full" />
          </Field>
          <Field label="วันที่เอกสารแนบ (เงื่อนไข/ค้ำประกัน/คำยินยอม) — ว่าง = วันที่ทำสัญญา">
            <ThaiDatePicker name="attach_date" defaultValue={c?.attach_date ?? null} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ผู้รับจ้าง</legend>
          <Field label="ชื่อ-นามสกุล (รวมคำนำหน้า)" wide>
            <input name="hiree_name" defaultValue={c?.hiree_name ?? ""} required placeholder="เช่น นางสาวสมหญิง ใจดี" className="input w-full" />
          </Field>
          <Field label="อายุ (ปี)">
            <input name="hiree_age" type="number" min="0" defaultValue={c?.hiree_age ?? ""} className="input w-full" />
          </Field>
          <Field label="เลขบัตรประจำตัวประชาชน">
            <input name="hiree_id_card" defaultValue={c?.hiree_id_card ?? ""} inputMode="numeric" className="input w-full" />
          </Field>
          <Field label="บ้านเลขที่">
            <input name="house_no" defaultValue={c?.house_no ?? ""} className="input w-full" />
          </Field>
          <Field label="หมู่ที่">
            <input name="moo" defaultValue={c?.moo ?? ""} className="input w-full" />
          </Field>
          <Field label="ซอย">
            <input name="soi" defaultValue={c?.soi ?? ""} className="input w-full" />
          </Field>
          <Field label="โทรศัพท์">
            <input name="phone" defaultValue={c?.phone ?? ""} className="input w-full" />
          </Field>
          <div className="sm:col-span-2">
            <ThaiAddressInput defaultValue={{ tambon: c?.tambon, amphoe: c?.amphoe, province: c?.province, zipcode: c?.zipcode }} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ผู้ค้ำประกัน (เว้นว่างได้ — ในเอกสารจะเป็นเส้นจุดไว้เขียนมือ)</legend>
          <Field label="ชื่อ-นามสกุล (รวมคำนำหน้า)" wide>
            <input name="guarantor_name" defaultValue={c?.guarantor_name ?? ""} className="input w-full" />
          </Field>
          <Field label="บ้านเลขที่">
            <input name="g_house_no" defaultValue={c?.g_house_no ?? ""} className="input w-full" />
          </Field>
          <Field label="หมู่ที่">
            <input name="g_moo" defaultValue={c?.g_moo ?? ""} className="input w-full" />
          </Field>
          <Field label="ซอย">
            <input name="g_soi" defaultValue={c?.g_soi ?? ""} className="input w-full" />
          </Field>
          <Field label="โทรศัพท์">
            <input name="g_phone" defaultValue={c?.g_phone ?? ""} className="input w-full" />
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
            <Field label="ตำบล/แขวง">
              <input name="g_tambon" defaultValue={c?.g_tambon ?? ""} className="input w-full" />
            </Field>
            <Field label="อำเภอ/เขต">
              <input name="g_amphoe" defaultValue={c?.g_amphoe ?? ""} className="input w-full" />
            </Field>
            <Field label="จังหวัด">
              <input name="g_province" defaultValue={c?.g_province ?? ""} className="input w-full" />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <input name="g_zipcode" defaultValue={c?.g_zipcode ?? ""} className="input w-full" />
            </Field>
          </div>
          <Field label="วันเกิด">
            <ThaiDatePicker name="g_birth_date" defaultValue={c?.g_birth_date ?? null} />
          </Field>
          <Field label="อายุ (ปี)">
            <input name="g_age" type="number" min="0" defaultValue={c?.g_age ?? ""} className="input w-full" />
          </Field>
          <Field label="อาชีพ">
            <input name="g_occupation" defaultValue={c?.g_occupation ?? ""} className="input w-full" />
          </Field>
          <Field label="ตำแหน่ง">
            <input name="g_position" defaultValue={c?.g_position ?? ""} className="input w-full" />
          </Field>
          <Field label="สังกัดหน่วยงาน" wide>
            <input name="g_workplace" defaultValue={c?.g_workplace ?? ""} className="input w-full" />
          </Field>
          <Field label="อัตราเงินเดือน (บาท)">
            <input name="g_salary" type="number" min="0" step="0.01" defaultValue={c?.g_salary ?? ""} className="input w-full" />
          </Field>
          <Field label="บัตรประจำตัวเลขที่">
            <input name="g_card_no" defaultValue={c?.g_card_no ?? ""} className="input w-full" />
          </Field>
          <Field label="ออก ณ">
            <input name="g_card_issued_at" defaultValue={c?.g_card_issued_at ?? ""} className="input w-full" />
          </Field>
          <Field label="วันออกบัตร">
            <ThaiDatePicker name="g_card_issue_date" defaultValue={c?.g_card_issue_date ?? null} />
          </Field>
          <Field label="วันบัตรหมดอายุ">
            <ThaiDatePicker name="g_card_expire_date" defaultValue={c?.g_card_expire_date ?? null} />
          </Field>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">คู่สมรสผู้ค้ำประกัน และพยาน</legend>
          <Field label="ชื่อคู่สมรสผู้ค้ำประกัน">
            <input name="spouse_name" defaultValue={c?.spouse_name ?? ""} className="input w-full" />
          </Field>
          <Field label="เป็น">
            <select name="spouse_relation" defaultValue={c?.spouse_relation ?? ""} className="input w-full">
              <option value="">สามี/ภรรยา (เว้นไว้ให้เลือกเอง)</option>
              <option value="สามี">สามี</option>
              <option value="ภรรยา">ภรรยา</option>
            </select>
          </Field>
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

export default function TeacherHirePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const canManage = STAFF.includes(user?.role ?? "");
  const [rows, setRows] = useState<TeacherHireContract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<Defaults>({ place: "", director: "" });
  const [options, setOptions] = useState<Options>({ projects: [], activities: [], sources: [] });
  // ไฟล์สัญญาฉบับจริง (PDF) เก็บที่แถวสรุปในทะเบียนสัญญา (proc_contracts.contract_file_path) — key = id แถวสรุป
  const [files, setFiles] = useState<Map<string, string | null>>(new Map());
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const [{ data, error }, { data: school }, { data: signer }, { data: projectsData }, { data: sourcesData }] = await Promise.all([
      supabase.from("proc_teacher_hire_contracts").select("*").order("contract_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("proc_school_settings").select("school_name, school_address").eq("id", true).maybeSingle(),
      supabase.from("proc_app_settings").select("value").eq("key", "approval_signer_director").maybeSingle(),
      currentYear
        ? supabase.from("plan_projects").select("id, name, budget_source_id").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] as Project[] }),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order"),
    ]);
    const rowsData = (data as unknown as TeacherHireContract[]) ?? [];
    const registerIds = rowsData.map((r) => r.register_contract_id).filter((id): id is string => !!id);
    const { data: fileRows } = registerIds.length ? await supabase.from("proc_contracts").select("id, contract_file_path").in("id", registerIds) : { data: [] as { id: string; contract_file_path: string | null }[] };
    setFiles(new Map((fileRows ?? []).map((f) => [f.id, f.contract_file_path])));
    // โครงการเดิมของสัญญาที่ไม่อยู่ในรายการปีปัจจุบัน — ให้ยังเลือกค้างไว้ได้ตอนแก้ไข
    const known = new Set((projectsData ?? []).map((p) => p.id));
    const missing = Array.from(new Set(rowsData.map((r) => r.project_id).filter((id): id is string => !!id && !known.has(id))));
    const { data: oldProjects } = missing.length ? await supabase.from("plan_projects").select("id, name, budget_source_id").in("id", missing) : { data: [] as Project[] };
    const allProjects = [...(projectsData ?? []), ...(oldProjects ?? [])];
    const { data: activitiesData } = allProjects.length
      ? await supabase.from("plan_activities").select("id, project_id, name").in("project_id", allProjects.map((p) => p.id)).order("sort_order")
      : { data: [] as Activity[] };
    setOptions({ projects: allProjects, activities: (activitiesData ?? []).map((a) => ({ ...a, name: a.name ?? "(ไม่มีชื่อ)" })), sources: sourcesData ?? [] });
    if (error) setError(error.message);
    setRows((data as unknown as TeacherHireContract[]) ?? []);
    const addr = school?.school_address ?? "";
    const amphoe = addr.match(/อำเภอ\s*\S+/)?.[0] ?? "";
    const province = addr.match(/จังหวัด\s*\S+/)?.[0] ?? "";
    setDefaults({ place: fixThaiTypo([school?.school_name, amphoe, province].filter(Boolean).join(" ")), director: signer?.value ?? "" });
  }, []);

  useEffect(() => {
    if (!authLoading && canManage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [authLoading, canManage, reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows || !q) return rows ?? [];
    return rows.filter((r) => [r.contract_no, r.hiree_name, r.guarantor_name].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, query]);

  async function handleDelete(r: TeacherHireContract) {
    const ok = await confirmDelete({ title: `ลบสัญญา ${r.contract_no}?`, text: r.hiree_name });
    if (!ok) return;
    try {
      const res = await deleteTeacherHire(r.id);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("ลบสัญญาเรียบร้อยแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  if (authLoading) return <PageLoadingSkeleton />;
  if (!canManage) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ เจ้าหน้าที่พัสดุ และเจ้าหน้าที่การเงินเท่านั้น (มีข้อมูลส่วนบุคคลของผู้รับจ้างและผู้ค้ำประกัน)
      </div>
    );
  }

  const registerId = (r: TeacherHireContract) => r.register_contract_id ?? null;

  const buttons = (r: TeacherHireContract) => (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/contracts/teacher-hire/${r.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
        พิมพ์ PDF
      </a>
      <a href={`/contracts/teacher-hire/${r.id}/word`} className="btn-secondary btn-sm">
        ดาวน์โหลด Word
      </a>
      {registerId(r) && (
        <ContractFileButtons contract={{ id: registerId(r) as string, contract_no: r.contract_no, contract_file_path: files.get(registerId(r) as string) ?? null }} onChanged={reload} canDelete={isAdmin} />
      )}
      <ContractModal contract={r} defaults={defaults} options={options} onSaved={reload} />
      {isAdmin && (
        <button type="button" onClick={() => handleDelete(r)} className="btn-danger btn-sm">
          <TrashIcon className="h-3.5 w-3.5" /> ลบ
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/contracts" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            งานสัญญา
          </Link>
          <h1 className="page-title">สัญญาจ้าง</h1>
          <p className="page-subtitle">สัญญาจ้างครูอัตราจ้าง — กรอกข้อมูลครั้งเดียว ออกเอกสาร 4 ส่วน: สัญญาจ้าง เงื่อนไขประกอบสัญญา สัญญาค้ำประกัน คำยินยอมคู่สมรสผู้ค้ำประกัน (บันทึกแล้วจะแสดงในทะเบียนสัญญาและเลือกในการส่งมอบตามสัญญาได้)</p>
        </div>
        <ContractModal contract={null} defaults={defaults} options={options} onSaved={reload} />
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่สัญญา/ชื่อผู้รับจ้าง/ผู้ค้ำประกัน" className="input mt-4 w-full sm:w-80" />

      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          {error && <p className="mt-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

          <div className="mt-4 space-y-3 md:hidden">
            {filtered.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">ยังไม่มีสัญญา</p>}
            {filtered.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-900">
                  {r.contract_no} · {r.hiree_name}
                </p>
                <p className="text-slate-600">
                  {r.start_date ? formatThaiDate(r.start_date) : "-"} – {r.end_date ? formatThaiDate(r.end_date) : "-"} · {r.salary ? `${formatBaht(r.salary)} บาท` : "-"}
                </p>
                <div className="mt-2">{buttons(r)}</div>
              </div>
            ))}
          </div>

          <div className="table-shell mt-4 hidden md:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>เลขที่สัญญา</th>
                  <th>วันที่ทำสัญญา</th>
                  <th>ผู้รับจ้าง</th>
                  <th>ระยะเวลาจ้าง</th>
                  <th className="text-right">เงินเดือน (บาท)</th>
                  <th>ผู้ค้ำประกัน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      ยังไม่มีสัญญา
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{r.contract_no}</td>
                    <td className="whitespace-nowrap">{formatThaiDate(r.contract_date)}</td>
                    <td>{r.hiree_name}</td>
                    <td className="whitespace-nowrap">
                      {r.start_date ? formatThaiDate(r.start_date) : "-"} – {r.end_date ? formatThaiDate(r.end_date) : "-"}
                      {r.months ? ` (${r.months} เดือน)` : ""}
                    </td>
                    <td className="text-right">{r.salary ? formatBaht(r.salary) : "-"}</td>
                    <td>{r.guarantor_name ?? <span className="text-slate-400">-</span>}</td>
                    <td>{buttons(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
