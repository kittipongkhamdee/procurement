"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { thaiBahtText } from "@/lib/thai";

export async function createDelivery(formData: FormData) {
  const supabase = await createClient();
  const amount = Number(formData.get("amount") ?? 0);

  const { error } = await supabase.from("proc_deliveries").insert({
    contract_id: String(formData.get("contract_id") ?? ""),
    delivery_date: String(formData.get("delivery_date") ?? ""),
    delivery_month: String(formData.get("delivery_month") ?? "") || null,
    amount,
    amount_text: thaiBahtText(amount),
    inspector_name: String(formData.get("inspector_name") ?? "") || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/deliveries");
}

export async function deleteDelivery(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_deliveries").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/deliveries");
}
