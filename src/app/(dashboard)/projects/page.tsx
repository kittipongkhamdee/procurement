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
import { loadProjectSpending, projectBudget } from "@/lib/project-spending";
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
  adminGroupOrder: number;
  budgetSource: string;
  activities: Activity[];
  budget: number;
  /** อนุมัติแล้ว (บันทึกขออนุมัติ) */
  spent: number;
  /** จ่ายจริง (บัญชีรับ-จ่ายเงิน) */
  paid: number;
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
            "id, name, budget, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name, sort_order), plan_budget_sources(name), plan_activities(id, name, budget, responsible)",
          )
          .eq("budget_year_id", year.id)
          .order("sort_order")
      : { data: [], error: null };
    if (error) setError(error.message);

    const projectIds = (projects ?? []).map((p) => p.id);
    // อนุมัติแล้ว/จ่ายจริง — นิยามเดียวกับบัญชีรับ-จ่ายเงินและแดชบอร์ด (src/lib/project-spending.ts)
    const { byProject: spending } = await loadProjectSpending(supabase, projectIds);

    // เรียงตามลำดับกลุ่มบริหาร (sort_order ของกลุ่ม) คงลำดับโครงการเดิมภายในกลุ่ม (Array.sort เสถียร)
    setRows(
      (projects ?? []).map((p) => {
        const activities = p.plan_activities as unknown as Activity[];
        const budget = projectBudget(p.budget, activities);
        const spent = spending.get(p.id)?.approved ?? 0;
        return {
          id: p.id,
          name: p.name,
          projectBudget: Number(p.budget ?? 0),
          budgetYearId: p.budget_year_id,
          adminGroupId: p.admin_group_id,
          budgetSourceId: p.budget_source_id,
          adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
          adminGroupOrder:
            (p.plan_admin_groups as unknown as { sort_order: number | null } | null)?.sort_order ?? Number.MAX_SAFE_INTEGER,
          budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
          activities,
          budget,
          spent,
          paid: spending.get(p.id)?.paid ?? 0,
          remaining: budget - spent,
        };
      }).sort((a, b) => a.adminGroupOrder - b.adminGroupOrder),
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
