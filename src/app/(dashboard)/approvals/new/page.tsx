import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { createApproval } from "../actions";
import { ApprovalForm } from "../approval-form";

export default async function NewApprovalPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: activities }, { data: disbursements }] = await Promise.all([
    supabase.from("plan_projects").select("id, name").order("sort_order"),
    supabase.from("plan_activities").select("project_id, budget"),
    supabase.from("proc_project_disbursements").select("project_id, amount, status"),
  ]);

  const budgetByProject = new Map<string, number>();
  (activities ?? []).forEach((a) => {
    budgetByProject.set(a.project_id, (budgetByProject.get(a.project_id) ?? 0) + Number(a.budget));
  });

  const paidByProject = new Map<string, number>();
  (disbursements ?? [])
    .filter((d) => d.status === "paid" && d.project_id)
    .forEach((d) => {
      const pid = d.project_id as string;
      paidByProject.set(pid, (paidByProject.get(pid) ?? 0) + Number(d.amount));
    });

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    budget: budgetByProject.get(p.id) ?? 0,
    paid: paidByProject.get(p.id) ?? 0,
  }));

  return (
    <div>
      <Link
        href="/approvals"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปประวัติการบันทึกขออนุมัติ
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">สร้างบันทึกข้อความขออนุมัติ</h1>
        </div>
      </div>
      <ApprovalForm action={createApproval} projects={projectOptions} />
    </div>
  );
}
