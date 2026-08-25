import { createClient } from "@/lib/supabase/server";
import { uploadProjectReport, deleteProjectReport } from "./actions";

export default async function ProjectReportsPage() {
  const supabase = await createClient();
  const [{ data: reports, error }, { data: projects }] = await Promise.all([
    supabase
      .from("proc_project_reports")
      .select("id, file_url, created_at, plan_projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plan_projects").select("id, name").order("sort_order"),
  ]);

  const paths = (reports ?? []).map((r) => r.file_url);
  const signedUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("procurement-files").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) signedUrls.set(s.path ?? "", s.signedUrl);
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">ระบบรายงานโครงการ</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">ส่งรายงานโครงการ</h2>
        <form action={uploadProjectReport} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select name="project_id" required defaultValue="" className="input sm:col-span-2">
            <option value="" disabled>
              เลือกโครงการ..
            </option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="file" name="file" required className="input" />
          <button
            type="submit"
            className="sm:col-span-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ส่งรายงาน
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อโครงการ</th>
              <th className="px-4 py-3">วันที่อัปโหลด</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {(r.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(r.created_at).toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 text-right">
                  {signedUrls.get(r.file_url) ? (
                    <a
                      href={signedUrls.get(r.file_url)}
                      target="_blank"
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      เปิดไฟล์
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">ไม่พบไฟล์</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteProjectReport.bind(null, r.id, r.file_url)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {reports?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
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
