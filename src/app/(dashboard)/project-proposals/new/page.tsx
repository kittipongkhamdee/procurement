"use client";

// หน้าเสนอโครงการใหม่แบบเต็มหน้า (แปลงจาก popup เดิมเพราะฟอร์มยาว/มีหลายส่วนย่อยทำให้ popup
// อึดอัด) ดึงรายการอ้างอิง (กลุ่มบริหาร/แหล่งงบ/ครู/กลยุทธ์/มาตรฐาน) + ปีงบประมาณปัจจุบันเอง
// เพราะเป็น route แยก ไม่ได้รับ props มาจากหน้ารายการเหมือนตอนเป็น modal

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ChevronLeftIcon } from "@/components/icons";
import { ProposalForm } from "../proposal-form";
import { createProposal } from "../actions";

type Option = { id: string; name: string };
type Teacher = { id: string; name: string; is_active: boolean };
type DraftProject = { id: string; name: string; adminGroupId: string | null; budgetSourceId: string | null; budget: number };

export default function NewProjectProposalPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [currentYear, setCurrentYear] = useState<{ id: string } | null | undefined>(undefined);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [strategies, setStrategies] = useState<Option[]>([]);
  const [standards, setStandards] = useState<Option[]>([]);
  const [draftProjects, setDraftProjects] = useState<DraftProject[]>([]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: budgetYears }, { data: adminGroupsData }, { data: budgetSourcesData }, { data: teachersData }, { data: strategiesData }, { data: standardsData }] =
      await Promise.all([
        supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false }),
        supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
        supabase.from("plan_strategies").select("id, name").eq("is_active", true).order("sort_order").order("name"),
        supabase.from("plan_standards").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      ]);
    const year = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;
    setCurrentYear(year);
    setAdminGroups(adminGroupsData ?? []);
    setBudgetSources(budgetSourcesData ?? []);
    setTeachers(teachersData ?? []);
    setStrategies(strategiesData ?? []);
    setStandards(standardsData ?? []);

    if (year) {
      const { data: draftsData } = await supabase
        .from("plan_draft_projects")
        .select("id, name, admin_group_id, budget_source_id, budget")
        .eq("budget_year_id", year.id)
        .order("sort_order")
        .order("created_at");
      setDraftProjects(
        (draftsData ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          adminGroupId: d.admin_group_id,
          budgetSourceId: d.budget_source_id,
          budget: Number(d.budget ?? 0),
        })),
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (currentYear === undefined || authLoading) return <PageLoadingSkeleton />;

  return (
    <div>
      <Link
        href="/project-proposals"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปรายการเสนอโครงการ
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">เสนอโครงการใหม่</h1>
        </div>
      </div>

      {currentYear === null ? (
        <p className="p-4 text-sm text-red-600">ยังไม่มีปีงบประมาณในระบบ กรุณาตั้งค่าปีงบประมาณก่อน</p>
      ) : (
        <div className="card">
          <ProposalForm
            action={createProposal}
            budgetYearId={currentYear.id}
            adminGroups={adminGroups}
            budgetSources={budgetSources}
            teachers={teachers}
            strategies={strategies}
            standards={standards}
            draftProjects={draftProjects}
            onSuccess={() => router.push("/project-proposals")}
          />
        </div>
      )}
    </div>
  );
}
