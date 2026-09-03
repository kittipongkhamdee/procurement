"use client";

// หน้าเสนอรายงานโครงการใหม่แบบเต็มหน้า (แปลงจาก popup เดิมเพราะฟอร์มยาว/มีหลายส่วนย่อย
// ทำให้ popup อึดอัด) ดึงข้อมูลโครงการ + ตั้งค่า AI ที่จำเป็นสำหรับฟอร์มเอง เพราะเป็น route แยก
// ไม่ได้รับ props มาจากหน้ารายการเหมือนตอนเป็น modal

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ChevronLeftIcon } from "@/components/icons";
import { ProjectReportForm, type Project } from "../project-report-form";
import { createProjectReport, extractBackgroundFromProposalFile } from "../actions";

type Proposal = {
  project_id: string;
  strategy_alignment: string | null;
  standard: string | null;
  responsible: string[] | null;
  objectives: string[] | null;
  indicators_quantity: { indicator: string; target: string }[] | null;
  indicators_quality: { indicator: string; target: string }[] | null;
  file_url_pdf: string | null;
};

export default function NewProjectReportPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [aiExtractionEnabled, setAiExtractionEnabled] = useState(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: projectRows }, { data: proposals }, { data: aiSetting }, { data: approvals }] = await Promise.all([
      supabase
        .from("plan_projects")
        .select("id, name, budget, plan_activities(budget)")
        .order("sort_order"),
      supabase
        .from("plan_project_proposals")
        .select(
          "project_id, strategy_alignment, standard, responsible, objectives, indicators_quantity, indicators_quality, file_url_pdf",
        )
        .not("project_id", "is", null),
      supabase.from("proc_app_settings").select("value").eq("key", "ai_extraction_enabled").maybeSingle(),
      supabase.from("proc_approvals").select("project_id, requested_amount").eq("status", "อนุมัติ"),
    ]);
    setAiExtractionEnabled(aiSetting?.value !== "false");
    const proposalByProjectId = new Map((proposals as unknown as Proposal[] ?? []).map((p) => [p.project_id, p]));
    // ผลรวมงบที่อนุมัติจริงจากบันทึกขออนุมัติ (สถานะ "อนุมัติ") ต่อโครงการ — ใช้เติมช่อง
    // "งบประมาณที่ใช้ไปจริง" ในฟอร์มรายงานให้อัตโนมัติตอนเลือกโครงการ
    const approvedUsedByProjectId = new Map<string, number>();
    for (const a of approvals ?? []) {
      if (!a.project_id) continue;
      approvedUsedByProjectId.set(
        a.project_id,
        (approvedUsedByProjectId.get(a.project_id) ?? 0) + Number(a.requested_amount ?? 0),
      );
    }
    setProjects(
      (projectRows ?? []).map((p) => {
        const proposal = proposalByProjectId.get(p.id);
        // งบประมาณจริงของโครงการอาจมาจากผลรวมกิจกรรม (plan_activities) แทนคอลัมน์ budget ตรงๆ
        // ของ plan_projects ถ้ามีการแตกกิจกรรมย่อยไว้ (เหมือนที่หน้า /projects คำนวณ) —
        // ไม่งั้นช่อง "งบประมาณที่ได้รับอนุมัติ" ในฟอร์มรายงานจะไม่ดึงค่ามาให้อัตโนมัติ
        const activities = (p.plan_activities as unknown as { budget: number }[]) ?? [];
        const budget =
          activities.length > 0
            ? activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0)
            : Number(p.budget ?? 0);
        return {
          id: p.id,
          name: p.name,
          budget,
          budgetUsedApproved: approvedUsedByProjectId.get(p.id) ?? null,
          strategyAlignment: proposal?.strategy_alignment ?? null,
          standard: proposal?.standard ?? null,
          responsible: proposal?.responsible ?? [],
          objectives: proposal?.objectives ?? [],
          indicatorsQuantity: proposal?.indicators_quantity ?? [],
          indicatorsQuality: proposal?.indicators_quality ?? [],
          proposalPdfPath: proposal?.file_url_pdf ?? null,
        };
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (projects === null) return <PageLoadingSkeleton />;

  return (
    <div>
      <Link
        href="/project-reports"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปรายการรายงานโครงการ
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">รายงานสรุปโครงการ</h1>
        </div>
      </div>

      <div className="card">
        <ProjectReportForm
          projects={projects}
          action={createProjectReport}
          aiExtractionEnabled={aiExtractionEnabled}
          extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
          onSuccess={() => router.push("/project-reports")}
        />
      </div>
    </div>
  );
}
