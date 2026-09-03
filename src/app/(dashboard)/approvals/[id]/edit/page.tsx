import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { updateApproval } from "../../actions";
import { ApprovalForm, type ApprovalFormInitial } from "../../approval-form";

export default async function EditApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: approval },
    { data: items },
    { data: projects },
    { data: activities },
    { data: approvals },
    { data: adminGroups },
    { data: teachers },
  ] = await Promise.all([
    supabase
      .from("proc_approvals")
      .select(
        "id, doc_number, doc_date, subject, addressed_to, department, activity_name, project_id, plan_date_text, group_name, budget_year_text, requested_by_name, requested_by_position, fund_type, summary_items, status",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("proc_approval_items").select("name, qty, unit_price, note").eq("approval_id", id).order("seq"),
    supabase.from("plan_projects").select("id, name").order("sort_order"),
    supabase.from("plan_activities").select("id, project_id, name, budget"),
    supabase.from("proc_approvals").select("id, project_id, requested_amount").eq("status", "อนุมัติ"),
    supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
  ]);

  if (!approval) notFound();
  if (approval.status !== "รออนุมัติ") notFound();

  const budgetByProject = new Map<string, number>();
  (activities ?? []).forEach((a) => {
    budgetByProject.set(a.project_id, (budgetByProject.get(a.project_id) ?? 0) + Number(a.budget));
  });

  // เงินที่อนุมัติไปแล้วของโครงการนี้ (ไม่รวมรายการนี้เอง เพราะยังเป็น "รออนุมัติ" อยู่แล้ว)
  const approvedByProject = new Map<string, number>();
  (approvals ?? []).forEach((a) => {
    if (!a.project_id || a.id === id) return;
    approvedByProject.set(a.project_id, (approvedByProject.get(a.project_id) ?? 0) + Number(a.requested_amount));
  });

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    budget: budgetByProject.get(p.id) ?? 0,
    approvedSoFar: approvedByProject.get(p.id) ?? 0,
  }));

  const initial: ApprovalFormInitial = {
    doc_number: approval.doc_number,
    doc_date: approval.doc_date,
    subject: approval.subject,
    addressed_to: approval.addressed_to,
    department: approval.department,
    activity_name: approval.activity_name,
    project_id: approval.project_id,
    plan_date_text: approval.plan_date_text,
    group_name: approval.group_name,
    budget_year_text: approval.budget_year_text,
    requested_by_name: approval.requested_by_name,
    requested_by_position: approval.requested_by_position,
    fund_type: approval.fund_type,
    summary_items:
      (approval.summary_items as unknown as { label: string; amount: number | null; note: string | null }[]) ?? [],
    items: (items ?? []).map((i) => ({ name: i.name, qty: i.qty, unit_price: i.unit_price, note: i.note })),
  };

  return (
    <div>
      <Link
        href="/approvals"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปการบันทึกขออนุมัติ
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">แก้ไขบันทึกข้อความขออนุมัติ</h1>
        </div>
      </div>
      <ApprovalForm
        action={updateApproval.bind(null, id)}
        projects={projectOptions}
        activities={(activities ?? []).map((a) => ({ id: a.id, project_id: a.project_id, name: a.name }))}
        adminGroups={adminGroups ?? []}
        teachers={teachers ?? []}
        initial={initial}
        submitLabel="บันทึกการแก้ไข"
      />
    </div>
  );
}
