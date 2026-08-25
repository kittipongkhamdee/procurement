"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createVendor(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("proc_vendors").insert({
    name: String(formData.get("name") ?? ""),
    tax_id: String(formData.get("tax_id") ?? "") || null,
    house_no: String(formData.get("house_no") ?? "") || null,
    moo: String(formData.get("moo") ?? "") || null,
    tambon: String(formData.get("tambon") ?? "") || null,
    amphoe: String(formData.get("amphoe") ?? "") || null,
    province: String(formData.get("province") ?? "") || null,
    zipcode: String(formData.get("zipcode") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
  });

  if (error) {
    // RLS blocks this for non-staff roles (teacher/director) — expected, not a bug
    throw new Error(error.message);
  }

  revalidatePath("/vendors");
}

export async function deleteVendor(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_vendors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vendors");
}
