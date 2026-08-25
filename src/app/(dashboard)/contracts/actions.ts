"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createContract(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("proc_contracts").insert({
    contract_no: String(formData.get("contract_no") ?? ""),
    project_id: String(formData.get("project_id") ?? "") || null,
    contract_date: String(formData.get("contract_date") ?? ""),
    vendor_name: String(formData.get("vendor_name") ?? ""),
    id_card: String(formData.get("id_card") ?? "") || null,
    house_no: String(formData.get("house_no") ?? "") || null,
    moo: String(formData.get("moo") ?? "") || null,
    tambon: String(formData.get("tambon") ?? "") || null,
    amphoe: String(formData.get("amphoe") ?? "") || null,
    province: String(formData.get("province") ?? "") || null,
    zipcode: String(formData.get("zipcode") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
    detail: String(formData.get("detail") ?? "") || null,
    budget: formData.get("budget") ? Number(formData.get("budget")) : null,
    amount: Number(formData.get("amount") ?? 0),
    inspector_name: String(formData.get("inspector_name") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}

export async function deleteContract(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_contracts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}
