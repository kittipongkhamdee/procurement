import { createClient } from "@/lib/supabase/server";
import { resolveStorageUrls } from "@/lib/storage";
import { formatThaiDate } from "@/lib/thai";
import { Modal } from "@/components/modal";
import { ProjectReportForm } from "./project-report-form";
import { createProjectReport, deleteProjectReport, extractBackgroundFromProposalFile } from "./actions";

// ให้เวลาเพียงพอสำหรับ server action ที่เรียก Gemini อ่านไฟล์ข้อเสนอโครงการ (ค่าเริ่มต้นของ Vercel อาจตัดก่อน AI ตอบกลับ)
export const maxDuration = 60;

export default async function ProjectReportsPage() {
  const supabase = await createClient();
  const [{ data: reports, error }, { data: projects }, { data: proposals }, { data: aiExtractionEnabledSetting }] =
    await Promise.all([
      supabase
        .from("proc_project_reports")
        .select("id, file_url, photo_refs, created_at, plan_projects(name)")
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

  const paths = (reports ?? []).map((r) => r.file_url);
  const signedUrls = await resolveStorageUrls(supabase, paths, "procurement-files");

  const proposalByProjectId = new Map((proposals ?? []).map((p) => [p.project_id as string, p]));
  const aiExtractionEnabled = aiExtractionEnabledSetting?.value !== "false";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ระบบรายงานโครงการ</h1>
        </div>
        <Modal title="รายงานสรุปโครงการ" trigger="+ รายงานโครงการใหม่" triggerClassName="btn-primary" closeOnSubmit>
          <ProjectReportForm
            projects={(projects ?? []).map((p) => {
              const proposal = proposalByProjectId.get(p.id);
              return {
                id: p.id,
                name: p.name,
                budget: p.budget,
                strategyAlignment: proposal?.strategy_alignment ?? null,
                standard: proposal?.standard ?? null,
                responsible: (proposal?.responsible as unknown as string[]) ?? [],
                objectives: (proposal?.objectives as unknown as string[]) ?? [],
                indicatorsQuantity:
                  (proposal?.indicators_quantity as unknown as { indicator: string; target: string }[]) ?? [],
                indicatorsQuality:
                  (proposal?.indicators_quality as unknown as { indicator: string; target: string }[]) ?? [],
                proposalPdfPath: proposal?.file_url_pdf ?? null,
              };
            })}
            action={createProjectReport}
            aiExtractionEnabled={aiExtractionEnabled}
            extractBackgroundFromProposalFile={extractBackgroundFromProposalFile}
          />
        </Modal>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
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
            {reports?.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-slate-900">
                  {(r.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
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
                  <form action={deleteProjectReport.bind(null, r.id, r.file_url, (r.photo_refs as unknown as string[]) ?? [])}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {reports?.length === 0 && (
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
