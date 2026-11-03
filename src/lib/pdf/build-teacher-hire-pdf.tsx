import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ContractContext, TeacherHireContract } from "@/lib/teacher-hire-contract";
import { TeacherHireDocument } from "./teacher-hire-document";

/** โหลดสัญญา + ข้อมูลโรงเรียน/ผู้ลงนามจากหน้าตั้งค่า (ใช้ร่วมกันทั้ง PDF และ Word) */
export async function loadTeacherHire(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ contract: TeacherHireContract; ctx: ContractContext } | null> {
  const [{ data: contract }, { data: school }, { data: signer }] = await Promise.all([
    supabase.from("proc_teacher_hire_contracts").select("*").eq("id", id).maybeSingle(),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
    supabase.from("proc_app_settings").select("value").eq("key", "approval_signer_director").maybeSingle(),
  ]);
  if (!contract) return null;
  return {
    contract: contract as TeacherHireContract,
    ctx: {
      school_name: school?.school_name ?? "โรงเรียน",
      area: school?.education_area ?? "",
      director_name: signer?.value ?? "",
    },
  };
}

export async function renderTeacherHirePdfBuffer(contract: TeacherHireContract, ctx: ContractContext): Promise<Buffer> {
  return renderToBuffer(<TeacherHireDocument contract={contract} ctx={ctx} />);
}
