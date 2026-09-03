"use client";

// หน้าแก้ไขรายงานโครงการแบบเต็มหน้า (แปลงจาก popup เดิม) ดึงรายงานตาม id + รายชื่อโครงการ +
// URL รูปภาพเดิม (เซ็นใหม่) มาแสดงในฟอร์มเดียวกับหน้าเสนอรายงานใหม่
//
// สำคัญ: import เฉพาะจาก "@/lib/storage/ref" (pure function ไม่มี dependency ฝั่ง server) ห้าม
// import จาก "@/lib/storage" (บาร์เรลไฟล์) เด็ดขาด เพราะไฟล์นั้นดึง google-drive.ts เข้ามาด้วย ซึ่งใช้
// google-auth-library + service account secret ที่รันได้เฉพาะฝั่ง server เท่านั้น (ดูแพทเทิร์นเดียวกัน
// ที่ /documents/page.tsx) — รูปเก่าบางส่วนอัปโหลดไว้ตอนระบบตั้งค่าเป็น Google Drive (ref ขึ้นต้นด้วย
// "gdrive:") ถ้าเอา ref พวกนี้ไปยิง supabase.storage.createSignedUrls() ตรงๆ จะหา path ไม่เจอ (error)
// แล้วถูก .filter((p) => p.url) กรองทิ้งเงียบๆ ทำให้รูปเดิมหายไปจากฟอร์มแก้ไข (และหายจริงถ้ากดบันทึก)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { isDriveRef, driveFileId, driveThumbnailUrl } from "@/lib/storage/ref";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ChevronLeftIcon } from "@/components/icons";
import { ProjectReportForm, type Project, type ProjectReportInitial } from "../../project-report-form";
import { updateProjectReport, extractBackgroundFromProposalFile } from "../../actions";

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

type IndicatorResult = { indicator: string; target: string; actual: string };
type Report = {
  id: string;
  project_id: string | null;
  uploaded_by: string | null;
  photo_refs: string[] | null;
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
};

export default function EditProjectReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [aiExtractionEnabled, setAiExtractionEnabled] = useState(true);
  const [report, setReport] = useState<Report | null | undefined>(undefined);
  const [initial, setInitial] = useState<ProjectReportInitial | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: reportRow }, { data: projectRows }, { data: proposals }, { data: aiSetting }, { data: approvals }] =
      await Promise.all([
        supabase
          .from("proc_project_reports")
          .select(
            "id, project_id, uploaded_by, photo_refs, not_implemented, not_implemented_reason, responsible_name, period_start, period_end, location, background, objectives, activities_done, indicator_results_quantity, indicator_results_quality, satisfaction_percent, budget_approved, budget_used, highlights, problems, recommendations",
          )
          .eq("id", id)
          .maybeSingle(),
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

    if (!reportRow) {
      setReport(null);
      return;
    }
    const r = reportRow as unknown as Report;
    setReport(r);

    const photoRefs = r.photo_refs ?? [];
    const photoUrlByRef = new Map<string, string>();
    const supabasePhotoRefs = photoRefs.filter((ref) => !isDriveRef(ref));
    for (const ref of photoRefs) {
      if (isDriveRef(ref)) photoUrlByRef.set(ref, driveThumbnailUrl(driveFileId(ref)));
    }
    const { data: signedPhotos } =
      supabasePhotoRefs.length > 0
        ? await supabase.storage.from("procurement-files").createSignedUrls(supabasePhotoRefs, 3600)
        : { data: [] };
    signedPhotos?.forEach((s) => {
      if (s.signedUrl && !s.error) photoUrlByRef.set(s.path ?? "", s.signedUrl);
    });

    setInitial({
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
      photos: photoRefs.map((ref) => ({ ref, url: photoUrlByRef.get(ref) ?? "" })).filter((p) => p.url),
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (report === undefined || projects === null || authLoading) return <PageLoadingSkeleton />;
  if (report === null) return <p className="p-4 text-sm text-red-600">ไม่พบรายงานนี้</p>;

  const canManage = isAdmin || (user && report.uploaded_by === user.userId);
  if (!canManage) {
    return (
      <p className="p-4 text-sm text-red-600">
        คุณไม่มีสิทธิ์แก้ไขรายงานนี้ ผู้ที่แก้ไขได้คือเจ้าของรายงานหรือผู้ดูแลระบบเท่านั้น
      </p>
    );
  }

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
          <h1 className="page-title">แก้ไขรายงานโครงการ</h1>
        </div>
      </div>

      <div className="card">
        {initial && (
          <ProjectReportForm
            projects={projects}
            action={updateProjectReport.bind(null, id)}
            aiExtractionEnabled={aiExtractionEnabled}
            extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
            initial={initial}
            submitLabel="บันทึกการแก้ไข"
            onSuccess={() => router.push("/project-reports")}
          />
        )}
      </div>
    </div>
  );
}
