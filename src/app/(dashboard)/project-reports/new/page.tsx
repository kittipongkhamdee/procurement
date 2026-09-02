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
    const [{ data: projectRows }, { data: proposals }, { data: aiSetting }] = await Promise.all([
      supabase.from("plan_projects").select("id, name, budget").order("sort_order"),
      supabase
        .from("plan_project_proposals")
        .select(
          "project_id, strategy_alignment, standard, responsible, objectives, indicators_quantity, indicators_quality, file_url_pdf",
        )
        .not("project_id", "is", null),
      supabase.from("proc_app_settings").select("value").eq("key", "ai_extraction_enabled").maybeSingle(),
    ]);
    setAiExtractionEnabled(aiSetting?.value !== "false");
    const proposalByProjectId = new Map((proposals as unknown as Proposal[] ?? []).map((p) => [p.project_id, p]));
    setProjects(
      (projectRows ?? []).map((p) => {
        const proposal = proposalByProjectId.get(p.id);
        return {
          id: p.id,
          name: p.name,
          budget: p.budget,
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
