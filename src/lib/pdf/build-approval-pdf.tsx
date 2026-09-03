import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { formatThaiDate } from "@/lib/thai";
import { renderApprovalHtml } from "@/lib/pdf-html/approval-template";
import { renderHtmlToPdfBuffer } from "@/lib/pdf-html/render-html-pdf";
import type { ApprovalPdfData } from "@/lib/pdf-html/approval-types";

const SIGNER_KEYS = [
  "approval_signer_planning",
  "approval_signer_finance",
  "approval_signer_deputy",
  "approval_signer_director",
] as const;

export async function buildApprovalPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ApprovalPdfData; fileLabel: string } | null> {
  const { data: approval, error } = await supabase
    .from("proc_approvals")
    .select(
      "doc_number, doc_date, subject, addressed_to, department, activity_name, plan_date_text, fund_type, budget, requested_amount, remaining, summary_items, requested_by_name, requested_by_position, deputy_decision, deputy_note, status, approve_note, approved_at, group_name, budget_year_text, plan_projects(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !approval) return null;

  const [{ data: items }, { data: signerSettings }, { data: schoolSettings }] = await Promise.all([
    supabase.from("proc_approval_items").select("seq, name, qty, unit_price, total, note").eq("approval_id", id).order("seq"),
    supabase.from("proc_app_settings").select("key, value").in("key", SIGNER_KEYS),
    supabase.from("proc_school_settings").select("school_name, logo_url").eq("id", true).maybeSingle(),
  ]);

  const signerByKey = new Map((signerSettings ?? []).map((s) => [s.key, s.value]));
  const project = approval.plan_projects as unknown as { name: string } | null;

  const data: ApprovalPdfData = {
    doc_number: approval.doc_number,
    doc_date: formatThaiDate(approval.doc_date),
    subject: approval.subject,
    addressed_to: approval.addressed_to,
    department: approval.department,
    activity_name: approval.activity_name,
    project_name: project?.name ?? null,
    plan_date_text: approval.plan_date_text,
    requested_amount: Number(approval.requested_amount),
    summary_items: (approval.summary_items as unknown as { label: string; amount: number | null; note: string | null }[]) ?? [],
    requested_by_name: approval.requested_by_name,
    requested_by_position: approval.requested_by_position,

    budget: approval.budget != null ? Number(approval.budget) : null,
    remaining: approval.remaining != null ? Number(approval.remaining) : null,

    fund_type: approval.fund_type,

    deputy_decision: approval.deputy_decision as "ควร" | "ไม่ควร" | null,
    deputy_note: approval.deputy_note,

    status: approval.status as "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ",
    approve_note: approval.approve_note,
    approved_at: approval.approved_at,

    signer_planning: signerByKey.get("approval_signer_planning") ?? null,
    signer_finance: signerByKey.get("approval_signer_finance") ?? null,
    signer_deputy: signerByKey.get("approval_signer_deputy") ?? null,
    signer_director: signerByKey.get("approval_signer_director") ?? null,

    school_name: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
    school_logo_url: schoolSettings?.logo_url ?? null,

    group_name: approval.group_name,
    budget_year_text: approval.budget_year_text,
    items: (items ?? []).map((i) => ({
      seq: i.seq,
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price,
      total: i.total,
      note: i.note,
    })),
  };

  return { data, fileLabel: `อนุมัติ-${approval.doc_date}` };
}

export async function renderApprovalPdfBuffer(data: ApprovalPdfData): Promise<Buffer> {
  const html = renderApprovalHtml(data);
  return renderHtmlToPdfBuffer(html);
}
