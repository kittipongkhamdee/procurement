"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProjectDisbursement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("proc_project_disbursements").insert({
    doc_no: String(formData.get("doc_no") ?? "") || null,
    project_id: String(formData.get("project_id") ?? "") || null,
    activity_name: String(formData.get("activity_name") ?? "") || null,
    amount: Number(formData.get("amount") ?? 0),
    created_by: user?.id ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/project-disbursements");
}

export async function markProjectDisbursementPaid(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("proc_project_disbursements")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-disbursements");
}

export async function deleteProjectDisbursement(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_project_disbursements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-disbursements");
}
