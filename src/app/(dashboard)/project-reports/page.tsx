import { createClient } from "@/lib/supabase/server";
import { resolveStorageUrls } from "@/lib/storage";
import { Modal } from "@/components/modal";
import { ProjectReportForm } from "./project-report-form";
import { createProjectReport, deleteProjectReport } from "./actions";

export default async function ProjectReportsPage() {
  const supabase = await createClient();
  const [{ data: reports, error }, { data: projects }] = await Promise.all([
    supabase
      .from("proc_project_reports")
      .select("id, file_url, photo_refs, created_at, plan_projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plan_projects").select("id, name, budget").order("sort_order"),
  ]);

  const paths = (reports ?? []).map((r) => r.file_url);
  const signedUrls = await resolveStorageUrls(supabase, paths, "procurement-files");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ระบบรายงานโครงการ</h1>
        </div>
        <Modal title="รายงานสรุปโครงการ" trigger="+ รายงานโครงการใหม่" triggerClassName="btn-primary" closeOnSubmit>
          <ProjectReportForm
            projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, budget: p.budget }))}
            action={createProjectReport}
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
                <td>{new Date(r.created_at).toLocaleDateString("th-TH")}</td>
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
