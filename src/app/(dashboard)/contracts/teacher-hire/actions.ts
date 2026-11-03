"use server";

import { createClient } from "@/lib/supabase/server";
import { dbFail } from "@/lib/action-log";
import { deleteFromStorage } from "@/lib/storage";

// สัญญาจ้างครูอัตราจ้าง — สิทธิ์จริงอยู่ที่ RLS ของ proc_teacher_hire_contracts (admin/พัสดุ/การเงิน เขียนได้ ลบได้เฉพาะ admin)

function text(fd: FormData, key: string): string | null {
  return String(fd.get(key) ?? "").trim() || null;
}
function num(fd: FormData, key: string): number | null {
  const raw = String(fd.get(key) ?? "").replace(/,/g, "").trim();
  return raw && !Number.isNaN(Number(raw)) ? Number(raw) : null;
}

function fields(fd: FormData) {
  const contractNo = text(fd, "contract_no");
  const contractDate = text(fd, "contract_date");
  const hireeName = text(fd, "hiree_name");
  if (!contractNo) return { error: "กรุณากรอกเลขที่สัญญา" } as const;
  if (!contractDate) return { error: "กรุณาเลือกวันที่ทำสัญญา" } as const;
  if (!hireeName) return { error: "กรุณากรอกชื่อผู้รับจ้าง" } as const;
  const start = text(fd, "start_date");
  const end = text(fd, "end_date");
  if (start && end && end < start) return { error: "วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา" } as const;
  const rel = text(fd, "spouse_relation");
  return {
    values: {
      contract_no: contractNo,
      contract_date: contractDate,
      place: text(fd, "place"),
      employer_name: text(fd, "employer_name"),
      position_title: text(fd, "position_title") ?? "ครูอัตราจ้าง",
      hiree_name: hireeName,
      hiree_age: num(fd, "hiree_age"),
      hiree_id_card: text(fd, "hiree_id_card"),
      house_no: text(fd, "house_no"),
      moo: text(fd, "moo"),
      soi: text(fd, "soi"),
      tambon: text(fd, "tambon"),
      amphoe: text(fd, "amphoe"),
      province: text(fd, "province"),
      zipcode: text(fd, "zipcode"),
      phone: text(fd, "phone"),
      months: num(fd, "months"),
      start_date: start,
      end_date: end,
      salary: num(fd, "salary"),
      attach_date: text(fd, "attach_date"),
      guarantor_name: text(fd, "guarantor_name"),
      g_house_no: text(fd, "g_house_no"),
      g_moo: text(fd, "g_moo"),
      g_soi: text(fd, "g_soi"),
      g_tambon: text(fd, "g_tambon"),
      g_amphoe: text(fd, "g_amphoe"),
      g_province: text(fd, "g_province"),
      g_zipcode: text(fd, "g_zipcode"),
      g_phone: text(fd, "g_phone"),
      g_birth_date: text(fd, "g_birth_date"),
      g_age: num(fd, "g_age"),
      g_occupation: text(fd, "g_occupation"),
      g_position: text(fd, "g_position"),
      g_workplace: text(fd, "g_workplace"),
      g_salary: num(fd, "g_salary"),
      g_card_no: text(fd, "g_card_no"),
      g_card_issued_at: text(fd, "g_card_issued_at"),
      g_card_issue_date: text(fd, "g_card_issue_date"),
      g_card_expire_date: text(fd, "g_card_expire_date"),
      spouse_name: text(fd, "spouse_name"),
      spouse_relation: rel === "สามี" || rel === "ภรรยา" ? rel : null,
      witness1_name: text(fd, "witness1_name"),
      witness2_name: text(fd, "witness2_name"),
      project_id: text(fd, "project_id"),
      activity_id: text(fd, "activity_id"),
      budget_source_id: text(fd, "budget_source_id"),
    },
  } as const;
}

export async function saveTeacherHire(id: string | null, formData: FormData): Promise<{ error?: string }> {
  const parsed = fields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("proc_teacher_hire_contracts").update({ ...parsed.values, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("proc_teacher_hire_contracts").insert(parsed.values);
  return error ? dbFail("saveTeacherHire", error.message) : {};
}

export async function deleteTeacherHire(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // ไฟล์สัญญาฉบับจริงเก็บที่แถวสรุปในทะเบียนสัญญา (ถูกลบตามอัตโนมัติ) — ลบไฟล์ในที่เก็บไฟล์ด้วยไม่ให้ค้าง
  const { data: row } = await supabase.from("proc_teacher_hire_contracts").select("register_contract_id").eq("id", id).maybeSingle();
  const { data: reg } = row?.register_contract_id
    ? await supabase.from("proc_contracts").select("contract_file_path").eq("id", row.register_contract_id).maybeSingle()
    : { data: null };
  const { error } = await supabase.from("proc_teacher_hire_contracts").delete().eq("id", id);
  if (error) return dbFail("deleteTeacherHire", error.message);
  if (reg?.contract_file_path) await deleteFromStorage(supabase, reg.contract_file_path, "procurement-files").catch(() => {});
  return {};
}


// ───────── สัญญาจ้างเหมาบริการ (ธุรการ/นักการภารโรง/อื่นๆ) ─────────

function serviceFields(fd: FormData) {
  const contractNo = text(fd, "contract_no");
  const contractDate = text(fd, "contract_date");
  const hireeName = text(fd, "hiree_name");
  const jobTitle = text(fd, "job_title");
  if (!contractNo) return { error: "กรุณากรอกเลขที่สัญญา" } as const;
  if (!contractDate) return { error: "กรุณาเลือกวันที่ทำสัญญา" } as const;
  if (!hireeName) return { error: "กรุณากรอกชื่อผู้รับจ้าง" } as const;
  if (!jobTitle) return { error: "กรุณากรอกงานที่จ้าง" } as const;
  const start = text(fd, "start_date");
  const end = text(fd, "end_date");
  if (start && end && end < start) return { error: "วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มสัญญา" } as const;
  const kind = text(fd, "job_kind");
  return {
    values: {
      contract_no: contractNo,
      contract_date: contractDate,
      place: text(fd, "place"),
      place_tambon: text(fd, "place_tambon"),
      place_amphoe: text(fd, "place_amphoe"),
      place_province: text(fd, "place_province"),
      employer_name: text(fd, "employer_name"),
      job_kind: kind === "ธุรการ" || kind === "นักการภารโรง" ? kind : "อื่นๆ",
      job_title: jobTitle,
      hiree_name: hireeName,
      id_card: text(fd, "id_card"),
      house_no: text(fd, "house_no"),
      road: text(fd, "road"),
      tambon: text(fd, "tambon"),
      amphoe: text(fd, "amphoe"),
      province: text(fd, "province"),
      zipcode: text(fd, "zipcode"),
      phone: text(fd, "phone"),
      start_date: start,
      end_date: end,
      monthly_rate: num(fd, "monthly_rate"),
      total_amount: num(fd, "total_amount"),
      installments: num(fd, "installments"),
      bank_name: text(fd, "bank_name"),
      bank_branch: text(fd, "bank_branch"),
      bank_account_name: text(fd, "bank_account_name"),
      bank_account_no: text(fd, "bank_account_no"),
      employer_status: text(fd, "employer_status"),
      work_day_from: text(fd, "work_day_from"),
      work_day_to: text(fd, "work_day_to"),
      work_time_from: text(fd, "work_time_from"),
      work_time_to: text(fd, "work_time_to"),
      refund_days: num(fd, "refund_days"),
      annex1_pages: num(fd, "annex1_pages"),
      annex2_pages: num(fd, "annex2_pages"),
      tor_scope: text(fd, "tor_scope"),
      tor_job_role: text(fd, "tor_job_role"),
      tor_education: text(fd, "tor_education"),
      penalty_per_day: num(fd, "penalty_per_day"),
      witness1_name: text(fd, "witness1_name"),
      witness2_name: text(fd, "witness2_name"),
      project_id: text(fd, "project_id"),
      activity_id: text(fd, "activity_id"),
      budget_source_id: text(fd, "budget_source_id"),
    },
  } as const;
}

export async function saveServiceHire(id: string | null, formData: FormData): Promise<{ error?: string }> {
  const parsed = serviceFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("proc_service_hire_contracts").update({ ...parsed.values, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("proc_service_hire_contracts").insert(parsed.values);
  return error ? dbFail("saveServiceHire", error.message) : {};
}

export async function deleteServiceHire(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("proc_service_hire_contracts").select("register_contract_id").eq("id", id).maybeSingle();
  const { data: reg } = row?.register_contract_id
    ? await supabase.from("proc_contracts").select("contract_file_path").eq("id", row.register_contract_id).maybeSingle()
    : { data: null };
  const { error } = await supabase.from("proc_service_hire_contracts").delete().eq("id", id);
  if (error) return dbFail("deleteServiceHire", error.message);
  if (reg?.contract_file_path) await deleteFromStorage(supabase, reg.contract_file_path, "procurement-files").catch(() => {});
  return {};
}
