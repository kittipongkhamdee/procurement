import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { ApprovalDocument, type ApprovalPdfData } from "./approval-document";

export async function buildApprovalPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ApprovalPdfData; fileLabel: string } | null> {
  const { data: approval, error } = await supabase
    .from("proc_approvals")
    .select(
      "doc_date, subject, addressed_to, fund_type, budget, paid, requested_amount, remaining, requested_by_name, requested_by_position, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !approval) return null;

  const { data: items } = await supabase
    .from("proc_approval_items")
    .select("seq, name, qty, unit, unit_price, total")
    .eq("approval_id", id)
    .order("seq");

  const project = approval.plan_projects as unknown as { name: string } | null;

  const data: ApprovalPdfData = {
    doc_date: approval.doc_date,
    subject: approval.subject,
    addressed_to: approval.addressed_to,
    project_name: project?.name ?? null,
    fund_type: approval.fund_type,
    budget: approval.budget != null ? Number(approval.budget) : null,
    paid: approval.paid != null ? Number(approval.paid) : null,
    requested_amount: Number(approval.requested_amount),
    remaining: approval.remaining != null ? Number(approval.remaining) : null,
    requested_by_name: approval.requested_by_name,
    requested_by_position: approval.requested_by_position,
    items: (items ?? []).map((i) => ({
      seq: i.seq,
      name: i.name,
      qty: i.qty,
      unit: i.unit,
      unit_price: i.unit_price,
      total: i.total,
    })),
  };

  return { data, fileLabel: `อนุมัติ-${approval.doc_date}` };
}

export async function renderApprovalPdfBuffer(data: ApprovalPdfData): Promise<Buffer> {
  return renderToBuffer(<ApprovalDocument data={data} />);
}
