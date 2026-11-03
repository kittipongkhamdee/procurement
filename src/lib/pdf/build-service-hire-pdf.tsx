import { renderToBuffer } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ContractContext } from "@/lib/teacher-hire-contract";
import { buildServiceHireBlocks, type ServiceHireContract } from "@/lib/service-hire-contract";
import { BlocksDocument } from "./teacher-hire-document";

/** โหลดสัญญาจ้างเหมาบริการ + ข้อมูลโรงเรียน/ผู้ลงนามจากหน้าตั้งค่า (ใช้ร่วมกันทั้ง PDF และ Word) */
export async function loadServiceHire(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ contract: ServiceHireContract; ctx: ContractContext } | null> {
  const [{ data: contract }, { data: school }, { data: signer }, { data: officer }] = await Promise.all([
    supabase.from("proc_service_hire_contracts").select("*").eq("id", id).maybeSingle(),
    supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
    supabase.from("proc_app_settings").select("value").eq("key", "approval_signer_director").maybeSingle(),
    supabase.from("proc_app_settings").select("value").eq("key", "doc_signer_procurement_officer").maybeSingle(),
  ]);
  if (!contract) return null;
  return {
    contract: contract as ServiceHireContract,
    ctx: { school_name: school?.school_name ?? "โรงเรียน", area: school?.education_area ?? "", director_name: signer?.value ?? "", officer_name: officer?.value ?? "" },
  };
}

export async function renderServiceHirePdfBuffer(contract: ServiceHireContract, ctx: ContractContext): Promise<Buffer> {
  return renderToBuffer(<BlocksDocument title={`สัญญาจ้างเหมาบริการ ${contract.contract_no}`} blocks={buildServiceHireBlocks(contract, ctx)} />);
}
