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
import { loadActivitySourcePlans } from "@/lib/activity-source-plan";
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

type Activity = {
  id: string;
  name: string | null;
  budget: number;
  responsible: string[] | null;
  /** แบ่งงบหลายแหล่งเงิน (ว่าง = ใช้แหล่งงบของโครงการแหล่งเดียว) */
  sources?: { sourceId: string; name: string; amount: number; used?: number }[];
};
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
            "id, name, budget, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name, sort_order), plan_budget_sources(name), plan_activities(id, name, budget, responsible, sort_order, plan_activity_sources(amount, sort_order, budget_source_id, plan_budget_sources(name))), plan_project_sources(amount, sort_order, budget_source_id, plan_budget_sources(name))",
          )
          .eq("budget_year_id", year.id)
          .order("sort_order")
      : { data: [], error: null };
    if (error) setError(error.message);

    const projectIds = (projects ?? []).map((p) => p.id);
    // อนุมัติแล้ว/จ่ายจริง — นิยามเดียวกับบัญชีรับ-จ่ายเงินและแดชบอร์ด (src/lib/project-spending.ts)
    const { byProject: spending } = await loadProjectSpending(supabase, projectIds);

    // ยอดที่ตัดแล้วแยกแหล่งเงินของกิจกรรมที่แบ่งหลายแหล่ง (จากบันทึกขออนุมัติที่อนุมัติแล้ว)
    const flatActivities = (projects ?? []).flatMap((p) =>
      ((p.plan_activities as unknown as { id: string; name: string | null }[]) ?? []).map((a) => ({ id: a.id, project_id: p.id, name: a.name })),
    );
    const sourcePlans = await loadActivitySourcePlans(supabase, flatActivities);

    // เรียงตามลำดับกลุ่มบริหาร (sort_order ของกลุ่ม) คงลำดับโครงการเดิมภายในกลุ่ม (Array.sort เสถียร)
    setRows(
      (projects ?? []).map((p) => {
        const activities = ((p.plan_activities as unknown as (Activity & {
          sort_order?: number;
          plan_activity_sources?: { amount: number; sort_order: number; budget_source_id: string; plan_budget_sources: { name: string } | null }[];
        })[]) ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          budget: a.budget,
          responsible: a.responsible,
          sources: [...(a.plan_activity_sources ?? [])]
            .sort((x, y) => x.sort_order - y.sort_order)
            .map((x) => ({
              sourceId: x.budget_source_id,
              name: x.plan_budget_sources?.name ?? "แหล่งเงิน",
              amount: Number(x.amount ?? 0),
              used: sourcePlans.get(a.id)?.find((sp) => sp.sourceId === x.budget_source_id)?.used ?? 0,
            })),
        })) as Activity[];
        const budget = projectBudget(p.budget, activities);
        // แหล่งเงินของโครงการ: ใช้มากกว่า 1 แหล่ง (จากการแบ่งรายกิจกรรม หรือแบ่งระดับโครงการ) ให้แสดงครบทุกแหล่ง
        const ownSource = (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? null;
        const projSources = [...((p as unknown as { plan_project_sources?: { amount: number; sort_order: number; budget_source_id: string; plan_budget_sources: { name: string } | null }[] }).plan_project_sources ?? [])]
          .sort((x, y) => x.sort_order - y.sort_order)
          .map((x) => ({ sourceId: x.budget_source_id, name: x.plan_budget_sources?.name ?? "แหล่งเงิน", amount: Number(x.amount ?? 0) }));
        const usedSources: string[] = [];
        const addSource = (n: string | null) => {
          if (n && !usedSources.includes(n)) usedSources.push(n);
        };
        if (activities.length > 0) {
          for (const a of activities) {
            if (a.sources && a.sources.length > 0) a.sources.forEach((x) => addSource(x.name));
            else addSource(ownSource);
          }
        } else projSources.forEach((x) => addSource(x.name));
        const sourceLabel = usedSources.length > 1 ? usedSources.join(", ") : ownSource ?? "-";
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
          budgetSource: sourceLabel,
          activities,
          projectSources: projSources,
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
