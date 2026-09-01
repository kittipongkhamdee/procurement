import { createClient } from "@/lib/supabase/server";
import { Modal } from "@/components/modal";
import { CreateProjectForm } from "./create-project-form";
import { ProjectsTable } from "./projects-table";
import {
  createActivity,
  createProject,
  deleteActivity,
  deleteProject,
  updateActivity,
  updateProject,
} from "./actions";

type Activity = {
  id: string;
  name: string | null;
  budget: number;
  responsible: string[] | null;
};

export default async function ProjectsPage() {
  const supabase = await createClient();

  // ยิงทุกอย่างที่ไม่ได้ขึ้นต่อกันพร้อมกัน — เดิมรอกันเป็นทอดๆ 6 รอบ ทั้งที่รายการตั้งค่าพวกนี้
  // ไม่ได้ขึ้นกับผู้ใช้หรือปีงบประมาณเลย (เวลา query จริงในฐานข้อมูลไม่ถึง 1 ms
  // ที่ช้าคือค่าใช้จ่ายของการยิงแต่ละรอบ จึงต้องลดจำนวน "รอบที่ต้องรอต่อกัน" ให้น้อยที่สุด)
  const [
    {
      data: { user },
    },
    { data: budgetYears },
    { data: adminGroups },
    { data: budgetSources },
    { data: teachers },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("plan_budget_years")
      .select("id, year, name, is_open")
      .order("year", { ascending: false }),
    supabase
      .from("plan_admin_groups")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("plan_budget_sources")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("plan_teachers")
      .select("id, name, is_active")
      .order("sort_order")
      .order("name"),
  ]);

  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];

  const projectsPromise = currentYear
    ? supabase
        .from("plan_projects")
        .select(
          "id, name, budget, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(id, name, budget, responsible)",
        )
        .eq("budget_year_id", currentYear.id)
        .order("sort_order")
    : Promise.resolve({ data: [], error: null });

  const [{ data: myProfile }, { data: projects, error }] = await Promise.all([
    supabase
      .from("proc_profiles")
      .select("role")
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
    projectsPromise,
  ]);
  const isAdmin = myProfile?.role === "admin";

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
    spentByProject.set(
      d.project_id,
      (spentByProject.get(d.project_id) ?? 0) + Number(d.amount ?? 0),
    );
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
      adminGroup:
        (p.plan_admin_groups as unknown as { name: string } | null)?.name ??
        "-",
      budgetSource:
        (p.plan_budget_sources as unknown as { name: string } | null)?.name ??
        "-",
      activities,
      budget,
      spent,
      remaining: budget - spent,
    };
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ</h1>
          <p className="page-subtitle">
            ตามแผนปฏิบัติการ
            {currentYear ? ` ปีงบประมาณ ${currentYear.year}` : ""}
          </p>
        </div>
        {isAdmin && currentYear && (
          <Modal
            title="เพิ่มโครงการใหม่"
            trigger="+ เพิ่มโครงการใหม่"
            triggerClassName="btn-primary"
            closeOnSubmit
          >
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

      <div className="table-shell mt-6">
        {error && (
          <p className="p-4 text-sm text-red-600">
            โหลดข้อมูลไม่สำเร็จ: {error.message}
          </p>
        )}
        <ProjectsTable
          rows={rows}
          isAdmin={isAdmin}
          adminGroups={adminGroups ?? []}
          budgetSources={budgetSources ?? []}
          teachers={teachers ?? []}
          updateProject={updateProject}
          deleteProject={deleteProject}
          createActivity={createActivity}
          updateActivity={updateActivity}
          deleteActivity={deleteActivity}
        />
      </div>
    </div>
  );
}
