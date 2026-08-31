import { createClient } from "@/lib/supabase/server";
import { WordFileIcon, PdfFileIcon } from "@/components/icons";
import { resolveStorageUrls } from "@/lib/storage";
import { formatThaiDate } from "@/lib/thai";
import { uploadDocument, deleteDocument } from "./actions";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const [{ data: documents, error }, { data: proposals }] = await Promise.all([
    supabase.from("proc_documents").select("id, file_name, file_url, created_at").order("created_at", { ascending: false }),
    supabase
      .from("plan_project_proposals")
      .select("id, name, file_url_word, file_url_pdf, approved_at")
      .eq("status", "อนุมัติแล้ว")
      .order("approved_at", { ascending: false }),
  ]);

  const paths = (documents ?? []).map((d) => d.file_url);
  const signedUrls = await resolveStorageUrls(supabase, paths, "procurement-files");

  const projectFiles = (proposals ?? []).filter((p) => p.file_url_word || p.file_url_pdf);
  const projectFilePaths = projectFiles.flatMap((p) => [p.file_url_word, p.file_url_pdf]).filter((p): p is string => !!p);
  const signedProjectFileUrls = await resolveStorageUrls(supabase, projectFilePaths, "procurement-files");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">คลังเอกสารดาวน์โหลด</h1>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="card-title mb-2">ไฟล์โครงการ</h2>
        <div className="table-shell">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-14 text-center">ลำดับที่</th>
                <th>โครงการ</th>
                <th className="whitespace-nowrap">ไฟล์</th>
              </tr>
            </thead>
            <tbody>
              {projectFiles.map((p, i) => (
                <tr key={p.id}>
                  <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                  <td className="font-medium text-slate-900">{p.name}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {p.file_url_word && signedProjectFileUrls.get(p.file_url_word) && (
                        <a
                          href={signedProjectFileUrls.get(p.file_url_word)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="เปิดไฟล์ Word"
                          title="ไฟล์ Word"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 py-1 pl-1.5 pr-2.5 text-sm font-semibold text-blue-800"
                        >
                          <WordFileIcon className="h-6 w-6 shrink-0" />
                          Word
                        </a>
                      )}
                      {p.file_url_pdf && signedProjectFileUrls.get(p.file_url_pdf) && (
                        <a
                          href={signedProjectFileUrls.get(p.file_url_pdf)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="เปิดไฟล์ PDF"
                          title="ไฟล์ PDF"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-1 pl-1.5 pr-2.5 text-sm font-semibold text-red-800"
                        >
                          <PdfFileIcon className="h-6 w-6 shrink-0" />
                          PDF
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {projectFiles.length === 0 && (
                <tr>
                  <td colSpan={3} className="table-empty">
                    ยังไม่มีไฟล์โครงการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="card-title mb-2">เอกสารทั่วไป</h2>

      <div className="card mb-6">
        <h2 className="card-title">เพิ่มไฟล์ใหม่</h2>
        <form action={uploadDocument} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="file_name" placeholder="ชื่อไฟล์เอกสาร (ไม่ระบุ = ใช้ชื่อไฟล์เดิม)" className="input sm:col-span-2" />
          <input type="file" name="file" required className="input" />
          <button type="submit" className="btn-primary sm:col-span-3">
            อัปโหลด
          </button>
        </form>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อไฟล์เอกสาร</th>
              <th>วันที่เพิ่ม</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents?.map((d) => (
              <tr key={d.id}>
                <td className="font-medium text-slate-900">{d.file_name}</td>
                <td>
                  {formatThaiDate(d.created_at)}
                </td>
                <td className="text-right">
                  {signedUrls.get(d.file_url) ? (
                    <a
                      href={signedUrls.get(d.file_url)}
                      target="_blank"
                      className="text-xs font-medium text-navy-800 hover:underline"
                    >
                      ดาวน์โหลด
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">ไม่พบไฟล์</span>
                  )}
                </td>
                <td className="text-right">
                  <form action={deleteDocument.bind(null, d.id, d.file_url)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {documents?.length === 0 && (
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
