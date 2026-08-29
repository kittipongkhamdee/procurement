import { createClient } from "@/lib/supabase/server";
import { Modal } from "@/components/modal";
import { FolderIcon } from "@/components/icons";
import { CreateProjectForm } from "./create-project-form";
import { ProjectEditModal } from "./project-edit-modal";
import {
  createActivity,
  createProject,
  deleteActivity,
  deleteProject,
  updateActivity,
  updateProject,
} from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Activity = { id: string; name: string | null; budget: number; responsible: string[] | null };

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const isAdmin = myProfile?.role === "admin";

  const { data: budgetYears } = await supabase
    .from("plan_budget_years")
    .select("id, year, name, is_open")
    .order("year", { ascending: false });

  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];

  const [{ data: adminGroups }, { data: budgetSources }, { data: teachers }] = await Promise.all([
    supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
  ]);

  const { data: projects, error } = currentYear
    ? await supabase
        .from("plan_projects")
        .select(
          "id, name, budget, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(id, name, budget, responsible)",
        )
        .eq("budget_year_id", currentYear.id)
        .order("sort_order")
    : { data: [], error: null };

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: disbursements } =
    projectIds.length > 0
      ? await supabase
          .from("proc_project_disbursements")
          .select("project_id, amount")
          .eq("status", "paid")
          .in("project_id", projectIds)
      : { data: [] };

  const spentByProject = new Map<string, number>();
  for (const d of disbursements ?? []) {
    if (!d.project_id) continue;
    spentByProject.set(d.project_id, (spentByProject.get(d.project_id) ?? 0) + Number(d.amount ?? 0));
  }

  const rows = (projects ?? []).map((p) => {
    const activities = p.plan_activities as unknown as Activity[];
    const budget =
      activities.length > 0
        ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0)
        : Number(p.budget ?? 0);
    const spent = spentByProject.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      projectBudget: Number(p.budget ?? 0),
      budgetYearId: p.budget_year_id,
      adminGroupId: p.admin_group_id,
      budgetSourceId: p.budget_source_id,
      adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
      budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
      activities,
      budget,
      spent,
      remaining: budget - spent,
    };
  });

  const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ</h1>
          <p className="page-subtitle">
            ตามแผนปฏิบัติการ{currentYear ? ` ปีงบประมาณ ${currentYear.year}` : ""}
          </p>
        </div>
        {isAdmin && currentYear && (
          <Modal title="เพิ่มโครงการใหม่" trigger="+ เพิ่มโครงการใหม่" triggerClassName="btn-primary" closeOnSubmit>
            <CreateProjectForm
              action={createProject}
              budgetYearId={currentYear.id}
              adminGroups={adminGroups ?? []}
              budgetSources={budgetSources ?? []}
              teachers={teachers ?? []}
            />
          </Modal>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card" style={{ "--accent": "#1b4177" } as React.CSSProperties}>
          <div className="flex items-start gap-3">
            <span className="stat-icon" style={{ background: "#1b4177" }}>
              <FolderIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="stat-label">จำนวนโครงการ</div>
              <div className="stat-value">
                {rows.length.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="stat-label">งบประมาณรวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(totalBudget)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายแล้ว</div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600">{formatBaht(totalSpent)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">คงเหลือ</div>
          <div className="mt-1.5 text-xl font-bold text-amber-600">{formatBaht(totalBudget - totalSpent)} บาท</div>
        </div>
      </div>

      <div className="table-shell mt-6">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>โครงการ</th>
              <th>กลุ่มบริหาร</th>
              <th>แหล่งเงินงบประมาณ</th>
              <th className="text-right">งบประมาณ</th>
              <th className="text-right">เบิกจ่ายแล้ว</th>
              <th className="text-right">คงเหลือ</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-slate-900">{r.name}</td>
                <td>{r.adminGroup}</td>
                <td>{r.budgetSource}</td>
                <td className="text-right tabular-nums">{formatBaht(r.budget)}</td>
                <td className="text-right tabular-nums text-emerald-700">{formatBaht(r.spent)}</td>
                <td className="text-right tabular-nums font-semibold text-amber-700">{formatBaht(r.remaining)}</td>
                {isAdmin && (
                  <td className="text-right">
                    <ProjectEditModal
                      projectId={r.id}
                      name={r.name}
                      budgetYearId={r.budgetYearId}
                      adminGroupId={r.adminGroupId}
                      budgetSourceId={r.budgetSourceId}
                      projectBudget={r.projectBudget}
                      activities={r.activities}
                      adminGroups={adminGroups ?? []}
                      budgetSources={budgetSources ?? []}
                      teachers={teachers ?? []}
                      updateProject={updateProject}
                      deleteProject={deleteProject}
                      createActivity={createActivity}
                      updateActivity={updateActivity}
                      deleteActivity={deleteActivity}
                    />
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="table-empty">
                  ยังไม่มีโครงการในปีงบประมาณนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
