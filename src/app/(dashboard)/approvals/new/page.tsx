import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { createApproval } from "../actions";
import { ApprovalForm } from "../approval-form";

export default async function NewApprovalPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: activities }, { data: approvals }, { data: adminGroups }, { data: teachers }] =
    await Promise.all([
      supabase.from("plan_projects").select("id, name").order("sort_order"),
      supabase.from("plan_activities").select("id, project_id, name, budget"),
      supabase.from("proc_approvals").select("project_id, requested_amount").eq("status", "อนุมัติ"),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
    ]);

  const budgetByProject = new Map<string, number>();
  (activities ?? []).forEach((a) => {
    budgetByProject.set(a.project_id, (budgetByProject.get(a.project_id) ?? 0) + Number(a.budget));
  });

  // เงินที่อนุมัติไปแล้วก่อนหน้าของแต่ละโครงการ — ใช้คำนวณ "เงินโครงการเหลือ" ในช่องความเห็นงานแผนงาน
  // (แพทเทิร์นเดียวกับที่หน้ารายงานโครงการใช้ดึงงบใช้จริงมาอัตโนมัติ)
  const approvedByProject = new Map<string, number>();
  (approvals ?? []).forEach((a) => {
    if (!a.project_id) return;
    approvedByProject.set(a.project_id, (approvedByProject.get(a.project_id) ?? 0) + Number(a.requested_amount));
  });

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    budget: budgetByProject.get(p.id) ?? 0,
    approvedSoFar: approvedByProject.get(p.id) ?? 0,
  }));

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
          <h1 className="page-title">สร้างบันทึกข้อความขออนุมัติ</h1>
        </div>
      </div>
      <ApprovalForm
        action={createApproval}
        projects={projectOptions}
        activities={(activities ?? []).map((a) => ({ id: a.id, project_id: a.project_id, name: a.name }))}
        adminGroups={adminGroups ?? []}
        teachers={teachers ?? []}
      />
    </div>
  );
}
