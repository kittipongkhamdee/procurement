"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createAllowanceDisbursement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("proc_allowance_disbursements").insert({
    doc_no: String(formData.get("doc_no") ?? ""),
    project_id: String(formData.get("project_id") ?? "") || null,
    expense_type: String(formData.get("expense_type") ?? ""),
    fund_source: String(formData.get("fund_source") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
    created_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/allowance");
}

export async function deleteAllowanceDisbursement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_allowance_disbursements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/allowance");
}
