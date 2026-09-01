"use client";

// Client Component — ดึงรายการโครงการผ่าน browser Supabase client แทนการรอ Server Component
// fetch ก่อนส่ง HTML กลับมา (ต่อจาก /, /documents, /vendors, /strategies, /standards — ดู
// /root/.claude/plans) มี admin gate เหมือน /strategies (ใช้ useAuth().isAdmin แทนการเช็คฝั่ง
// server) และ mutation (createProject/updateProject/...) ยังคงเป็น server action เดิมทั้งหมด
// ผ่าน onChanged callback ที่เพิ่มเข้าไปใน CreateProjectForm/ProjectEditModal/ProjectsTable เพื่อ
// สั่ง refetch รายการใหม่หลัง mutation สำเร็จ (แทนที่กลไก revalidatePath เดิมซึ่งใช้ไม่ได้กับ state
// ฝั่ง client)

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/modal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
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

type Activity = { id: string; name: string | null; budget: number; responsible: string[] | null };
type Option = { id: string; name: string };
type Teacher = { id: string; name: string; is_active: boolean };
type ProjectRow = {
  id: string;
  name: string;
  projectBudget: number;
  budgetYearId: string;
  adminGroupId: string;
  budgetSourceId: string | null;
  adminGroup: string;
  budgetSource: string;
  activities: Activity[];
  budget: number;
  spent: number;
  remaining: number;
};

export default function ProjectsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [currentYear, setCurrentYear] = useState<{ id: string; year: number } | null | undefined>(undefined);
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const reload = useCallback(async () => {
    const supabase = createClient();

    const [{ data: budgetYears }, { data: adminGroupsData }, { data: budgetSourcesData }, { data: teachersData }] =
      await Promise.all([
        supabase.from("plan_budget_years").select("id, year, name, is_open").order("year", { ascending: false }),
        supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
      ]);
    setAdminGroups(adminGroupsData ?? []);
    setBudgetSources(budgetSourcesData ?? []);
    setTeachers(teachersData ?? []);

    const year = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;
    setCurrentYear(year);

    const { data: projects, error } = year
      ? await supabase
          .from("plan_projects")
          .select(
            "id, name, budget, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(id, name, budget, responsible)",
          )
          .eq("budget_year_id", year.id)
          .order("sort_order")
      : { data: [], error: null };
    if (error) setError(error.message);

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

    setRows(
      (projects ?? []).map((p) => {
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
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (rows === null || currentYear === undefined) return <PageLoadingSkeleton />;

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
        {!authLoading && isAdmin && currentYear && (
          <Modal title="เพิ่มโครงการใหม่" trigger="+ เพิ่มโครงการใหม่" triggerClassName="btn-primary" closeOnSubmit>
            <CreateProjectForm
              action={createProject}
              budgetYearId={currentYear.id}
              adminGroups={adminGroups}
              budgetSources={budgetSources}
              teachers={teachers}
              onSuccess={reload}
            />
          </Modal>
        )}
      </div>

      <div className="table-shell mt-6">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
        <ProjectsTable
          rows={rows}
          isAdmin={!authLoading && isAdmin}
          adminGroups={adminGroups}
          budgetSources={budgetSources}
          teachers={teachers}
          updateProject={updateProject}
          deleteProject={deleteProject}
          createActivity={createActivity}
          updateActivity={updateActivity}
          deleteActivity={deleteActivity}
          onChanged={reload}
        />
      </div>
    </div>
  );
}
