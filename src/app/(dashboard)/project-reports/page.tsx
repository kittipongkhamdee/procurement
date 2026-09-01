"use client";

// Client Component — หน้าสุดท้ายในการแปลงเฟส 2 (ดู /root/.claude/plans) ดึงรายงานโครงการผ่าน
// browser Supabase client แทนการรอ Server Component fetch — extractBackgroundFromProposalFile
// (เรียก Gemini AI) และ mutation ทั้งหมดยังคงเป็น server action เดิม ไม่แตะ
//
// สำคัญ: ใช้ resolveUrls แบบ client เอง (เหมือน /documents, /project-proposals) ไม่ import จาก
// บาร์เรล @/lib/storage เพราะดึง google-drive.ts (service account secret) เข้ามาด้วย

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ProjectReportModal } from "./project-report-modal";
import { DeleteReportButton } from "./delete-report-button";
import {
  createProjectReport,
  deleteProjectReport,
  extractBackgroundFromProposalFile,
  updateProjectReport,
} from "./actions";

type IndicatorResult = { indicator: string; target: string; actual: string };
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
type Report = {
  id: string;
  project_id: string | null;
  uploaded_by: string | null;
  file_url: string | null;
  photo_refs: string[] | null;
  created_at: string;
  not_implemented: boolean;
  not_implemented_reason: string | null;
  responsible_name: string | null;
  period_start: string | null;
  period_end: string | null;
  location: string | null;
  background: string | null;
  objectives: string[] | null;
  activities_done: string[] | null;
  indicator_results_quantity: IndicatorResult[] | null;
  indicator_results_quality: IndicatorResult[] | null;
  satisfaction_percent: number | null;
  budget_approved: number | null;
  budget_used: number | null;
  highlights: string[] | null;
  problems: string[] | null;
  recommendations: string[] | null;
  plan_projects: { name: string } | null;
};

export default function ProjectReportsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectOptions, setProjectOptions] = useState<
    {
      id: string;
      name: string;
      budget: number;
      strategyAlignment: string | null;
      standard: string | null;
      responsible: string[];
      objectives: string[];
      indicatorsQuantity: { indicator: string; target: string }[];
      indicatorsQuality: { indicator: string; target: string }[];
      proposalPdfPath: string | null;
    }[]
  >([]);
  const [aiExtractionEnabled, setAiExtractionEnabled] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const supabase = createClient();

    const [
      { data: reportsData, error },
      { data: projects },
      { data: proposals },
      { data: aiExtractionEnabledSetting },
    ] = await Promise.all([
      supabase
        .from("proc_project_reports")
        .select(
          "id, project_id, uploaded_by, file_url, photo_refs, created_at, not_implemented, not_implemented_reason, responsible_name, period_start, period_end, location, background, objectives, activities_done, indicator_results_quantity, indicator_results_quality, satisfaction_percent, budget_approved, budget_used, highlights, problems, recommendations, plan_projects(name)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("plan_projects").select("id, name, budget").order("sort_order"),
      supabase
        .from("plan_project_proposals")
        .select(
          "project_id, strategy_alignment, standard, responsible, objectives, indicators_quantity, indicators_quality, file_url_pdf",
        )
        .not("project_id", "is", null),
      supabase.from("proc_app_settings").select("value").eq("key", "ai_extraction_enabled").maybeSingle(),
    ]);
    if (error) setError(error.message);

    const rows = (reportsData as unknown as Report[]) ?? [];
    setReports(rows);
    setAiExtractionEnabled(aiExtractionEnabledSetting?.value !== "false");

    const proposalByProjectId = new Map((proposals as unknown as Proposal[] ?? []).map((p) => [p.project_id, p]));
    setProjectOptions(
      (projects ?? []).map((p) => {
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

    const paths = rows.map((r) => r.file_url).filter((p): p is string => !!p);
    const allPhotoRefs = rows.flatMap((r) => r.photo_refs ?? []);
    const [fileUrlsMap, photoUrlsMap] = await Promise.all([
      paths.length > 0
        ? supabase.storage.from("procurement-files").createSignedUrls(paths, 3600)
        : Promise.resolve({ data: [] }),
      allPhotoRefs.length > 0
        ? supabase.storage.from("procurement-files").createSignedUrls(allPhotoRefs, 3600)
        : Promise.resolve({ data: [] }),
    ]);
    const fileMap = new Map<string, string>();
    fileUrlsMap.data?.forEach((s) => {
      if (s.signedUrl && !s.error) fileMap.set(s.path ?? "", s.signedUrl);
    });
    setSignedUrls(fileMap);
    const photoMap = new Map<string, string>();
    photoUrlsMap.data?.forEach((s) => {
      if (s.signedUrl && !s.error) photoMap.set(s.path ?? "", s.signedUrl);
    });
    setSignedPhotoUrls(photoMap);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (reports === null || authLoading) return <PageLoadingSkeleton />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ระบบรายงานโครงการ</h1>
        </div>
        <ProjectReportModal
          projects={projectOptions}
          action={createProjectReport}
          aiExtractionEnabled={aiExtractionEnabled}
          extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
          onChanged={reload}
        />
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อโครงการ</th>
              <th>วันที่รายงาน</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const canManage = isAdmin || (user && r.uploaded_by === user.userId);
              const photoRefs = r.photo_refs ?? [];
              return (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">
                    {r.plan_projects?.name ?? "-"}
                    {r.not_implemented && <span className="badge-red ml-2">ไม่ได้ดำเนินการ</span>}
                  </td>
                  <td>{formatThaiDate(r.created_at)}</td>
                  <td className="text-right">
                    {r.file_url ? (
                      signedUrls.get(r.file_url) ? (
                        <a
                          href={signedUrls.get(r.file_url)}
                          target="_blank"
                          className="text-xs font-medium text-navy-800 hover:underline"
                        >
                          เปิดไฟล์
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">ไม่พบไฟล์</span>
                      )
                    ) : (
                      <a
                        href={`/project-reports/${r.id}/pdf`}
                        target="_blank"
                        className="text-xs font-medium text-navy-800 hover:underline"
                      >
                        ดู/พิมพ์ PDF
                      </a>
                    )}
                  </td>
                  <td className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-3">
                        <ProjectReportModal
                          projects={projectOptions}
                          action={updateProjectReport.bind(null, r.id)}
                          aiExtractionEnabled={aiExtractionEnabled}
                          extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
                          title="แก้ไขรายงานโครงการ"
                          trigger="แก้ไข"
                          triggerClassName="text-xs font-medium text-navy-800 hover:underline"
                          submitLabel="บันทึกการแก้ไข"
                          onChanged={reload}
                          initial={{
                            projectId: r.project_id ?? "",
                            notImplemented: r.not_implemented,
                            notImplementedReason: r.not_implemented_reason ?? "",
                            responsibleName: r.responsible_name ?? "",
                            periodStart: r.period_start,
                            periodEnd: r.period_end,
                            location: r.location,
                            background: r.background ?? "",
                            objectives: r.objectives ?? [],
                            activitiesDone: r.activities_done ?? [],
                            indicatorResultsQuantity: r.indicator_results_quantity ?? [],
                            indicatorResultsQuality: r.indicator_results_quality ?? [],
                            satisfactionPercent: r.satisfaction_percent,
                            budgetApproved: r.budget_approved,
                            budgetUsed: r.budget_used,
                            highlights: r.highlights ?? [],
                            problems: r.problems ?? [],
                            recommendations: r.recommendations ?? [],
                            photos: photoRefs
                              .map((ref) => ({ ref, url: signedPhotoUrls.get(ref) ?? "" }))
                              .filter((p) => p.url),
                          }}
                        />
                        <DeleteReportButton
                          id={r.id}
                          fileUrl={r.file_url}
                          photoRefs={photoRefs}
                          projectName={r.plan_projects?.name ?? "โครงการนี้"}
                          action={deleteProjectReport}
                          onChanged={reload}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
