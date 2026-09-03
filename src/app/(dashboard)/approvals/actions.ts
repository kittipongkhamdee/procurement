"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildApprovalPdfData, renderApprovalPdfBuffer } from "@/lib/pdf/build-approval-pdf";

const PDF_BUCKET = "procurement-documents";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return supabase;
}

/** อนุญาตให้ผู้ดูแลระบบ หรือผู้ที่มีสถานะผู้ใช้งานตามชื่อที่ระบุ (เช่น "ผู้อำนวยการ") ทำรายการได้ —
 * แพทเทิร์นเดียวกับ requireAdminOrGroup ใน project-proposals/actions.ts */
async function requireAdminOrGroup(groupName: string) {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") return { supabase, signerName: profile.full_name ?? user.email ?? "" };

  const { data: membership } = await supabase
    .from("proc_user_group_members")
    .select("group_id, proc_user_groups!inner(name)")
    .eq("user_id", user.id)
    .eq("proc_user_groups.name", groupName)
    .maybeSingle();
  if (!membership) throw new Error(`เฉพาะผู้ดูแลระบบหรือผู้มีสถานะ "${groupName}" เท่านั้น`);
  return { supabase, signerName: profile?.full_name ?? user.email ?? "" };
}

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

  // Best-effort: the approval and its items are already saved above, so a PDF failure
  // here shouldn't fail the whole save — the [id]/pdf route can still render it live.
  try {
    const pdfResult = await buildApprovalPdfData(supabase, approval.id);
    if (pdfResult) {
      const buffer = await renderApprovalPdfBuffer(pdfResult.data);
      const path = `approvals/${approval.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });
      if (!uploadError) {
        await supabase.from("proc_approvals").update({ approval_pdf_url: path }).eq("id", approval.id);
      }
    }
  } catch {
    // ignored — see comment above
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

export async function updateApprovalStatus(id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) {
  const { supabase, signerName } = await requireAdminOrGroup("ผู้อำนวยการ");
  const { error } = await supabase
    .from("proc_approvals")
    .update({
      status: decision,
      approved_by_name: signerName.trim() || null,
      approved_at: new Date().toISOString(),
      approve_note: note?.trim() || null,
    })
    .eq("id", id)
    .eq("status", "รออนุมัติ");
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}

/** ย้อนสถานะกลับเป็น "รออนุมัติ" เผื่อกดอนุมัติ/ไม่อนุมัติผิด */
export async function resetApprovalStatus(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("proc_approvals")
    .update({ status: "รออนุมัติ", approved_by_name: null, approved_at: null, approve_note: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/approvals");
}
