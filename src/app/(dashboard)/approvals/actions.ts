"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ItemInput = { name: string; qty: string; unit: string; unitPrice: string };

export async function createApproval(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requestedAmount = Number(formData.get("requested_amount") ?? 0);

  const { data: approval, error } = await supabase
    .from("proc_approvals")
    .insert({
      doc_date: String(formData.get("doc_date") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      addressed_to: String(formData.get("addressed_to") ?? ""),
      project_id: String(formData.get("project_id") ?? "") || null,
      fund_type: String(formData.get("fund_type") ?? "") || null,
      budget: formData.get("budget") ? Number(formData.get("budget")) : null,
      paid: formData.get("paid") ? Number(formData.get("paid")) : null,
      requested_amount: requestedAmount,
      remaining: formData.get("remaining") ? Number(formData.get("remaining")) : null,
      detail_text: String(formData.get("detail_text") ?? "") || null,
      requested_by_name: String(formData.get("requested_by_name") ?? "") || null,
      requested_by_position: String(formData.get("requested_by_position") ?? "") || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const itemsRaw = String(formData.get("items_json") ?? "[]");
  let items: ItemInput[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  const rowsToInsert = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.name.trim() !== "")
    .map(({ item, index }) => ({
      approval_id: approval.id,
      seq: index + 1,
      name: item.name,
      qty: item.qty ? Number(item.qty) : null,
      unit: item.unit || null,
      unit_price: item.unitPrice ? Number(item.unitPrice) : null,
    }));

  if (rowsToInsert.length > 0) {
    const { error: itemsError } = await supabase.from("proc_approval_items").insert(rowsToInsert);
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/approvals");
  redirect("/approvals");
}

export async function deleteApproval(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("proc_approvals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}
