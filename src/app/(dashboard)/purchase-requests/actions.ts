"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildPurchaseRequestPdfData, renderPurchaseRequestPdfBuffer } from "@/lib/pdf/build-purchase-request-pdf";

const PDF_BUCKET = "procurement-documents";

type ItemInput = {
  name: string;
  qty: string;
  unit: string;
  unitPrice: string;
};

export async function createPurchaseRequest(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const recordDate = String(formData.get("record_date") ?? "");
  const deliveryDate = String(formData.get("delivery_date") ?? "");
  const workDays =
    recordDate && deliveryDate
      ? Math.max(
          0,
          Math.round(
            (new Date(deliveryDate).getTime() - new Date(recordDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : null;

  const projectId = String(formData.get("project_id") ?? "") || null;
  const activityId = String(formData.get("activity_id") ?? "") || null;
  const vendorId = String(formData.get("vendor_id") ?? "") || null;

  const { data: request, error } = await supabase
    .from("proc_purchase_requests")
    .insert({
      doc_type: String(formData.get("doc_type") ?? "ซื้อ") as "ซื้อ" | "จ้าง",
      doc_no: String(formData.get("doc_no") ?? ""),
      record_date: recordDate,
      delivery_date: deliveryDate,
      work_days: workDays,
      inspector_name: String(formData.get("inspector_name") ?? "") || null,
      inspector_position: String(formData.get("inspector_position") ?? "") || null,
      admin_group: String(formData.get("admin_group") ?? "") || null,
      project_id: projectId,
      activity_id: activityId,
      amount: Number(formData.get("amount") ?? 0),
      item_name: String(formData.get("item_name") ?? "") || null,
      reason: String(formData.get("reason") ?? "") || null,
      detail: String(formData.get("detail") ?? "") || null,
      vendor_id: vendorId,
      supply_officer_name: String(formData.get("supply_officer_name") ?? "") || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

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
      purchase_request_id: request.id,
      seq: index + 1,
      name: item.name,
      qty: item.qty ? Number(item.qty) : null,
      unit: item.unit || null,
      unit_price: item.unitPrice ? Number(item.unitPrice) : null,
    }));

  if (rowsToInsert.length > 0) {
    const { error: itemsError } = await supabase.from("proc_purchase_items").insert(rowsToInsert);
    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  // Best-effort: the request and its items are already saved above, so a PDF failure
  // here shouldn't fail the whole save — the [id]/pdf route can still render it live.
  try {
    const pdfResult = await buildPurchaseRequestPdfData(supabase, request.id);
    if (pdfResult) {
      const buffer = await renderPurchaseRequestPdfBuffer(pdfResult.data);
      const path = `purchase-requests/${request.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (!uploadError) {
        await supabase.from("proc_purchase_requests").update({ pdf_url: path }).eq("id", request.id);
      }
    }
  } catch {
    // ignored — see comment above
  }

  revalidatePath("/purchase-requests");
  redirect("/purchase-requests");
}
