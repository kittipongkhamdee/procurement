"use client";

// Client Component — หน้าสุดท้ายในการแปลงเฟส 2 (ดู /root/.claude/plans) ดึงรายงานโครงการผ่าน
// browser Supabase client แทนการรอ Server Component fetch — mutation ทั้งหมดยังคงเป็น server
// action เดิม ไม่แตะ
//
// หน้าเสนอ/แก้ไขรายงานย้ายไปเป็นเต็มหน้า (/project-reports/new, /project-reports/[id]/edit)
// แทน popup เดิม เพราะฟอร์มยาวหลายส่วนทำให้ popup อึดอัด — หน้านี้เหลือแค่รายการ+ลิงก์ไปหน้าเหล่านั้น

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { DeleteReportButton } from "./delete-report-button";
import { deleteProjectReport } from "./actions";

type Report = {
  id: string;
  project_id: string | null;
  uploaded_by: string | null;
  file_url: string | null;
  photo_refs: string[] | null;
  created_at: string;
  not_implemented: boolean;
  plan_projects: { name: string } | null;
};

export default function ProjectReportsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const supabase = createClient();

    const { data: reportsData, error } = await supabase
      .from("proc_project_reports")
      .select("id, project_id, uploaded_by, file_url, photo_refs, created_at, not_implemented, plan_projects(name)")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);

    const rows = (reportsData as unknown as Report[]) ?? [];
    setReports(rows);

    const paths = rows.map((r) => r.file_url).filter((p): p is string => !!p);
    const { data: fileUrlsMap } =
      paths.length > 0
        ? await supabase.storage.from("procurement-files").createSignedUrls(paths, 3600)
        : { data: [] };
    const fileMap = new Map<string, string>();
    fileUrlsMap?.forEach((s) => {
      if (s.signedUrl && !s.error) fileMap.set(s.path ?? "", s.signedUrl);
    });
    setSignedUrls(fileMap);
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
        <Link href="/project-reports/new" className="btn-primary">
          + รายงานโครงการใหม่
        </Link>
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
                        <Link href={`/project-reports/${r.id}/edit`} className="text-xs font-medium text-navy-800 hover:underline">
                          แก้ไข
                        </Link>
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
