"use client";

// Client Component — ดึงรายการเอกสาร/ไฟล์โครงการและ signed URL ผ่าน browser Supabase client
// แทนการรอ Server Component fetch ก่อนส่ง HTML กลับมา (ต่อจาก /, /vendors, /strategies,
// /standards — ดู /root/.claude/plans)
//
// สำคัญ: import เฉพาะจาก "@/lib/storage/ref" (pure function ไม่มี dependency ฝั่ง server) ห้าม
// import จาก "@/lib/storage" (บาร์เรลไฟล์) เด็ดขาด เพราะไฟล์นั้นดึง google-drive.ts เข้ามาด้วย ซึ่งใช้
// google-auth-library + service account secret ที่รันได้เฉพาะฝั่ง server เท่านั้น จะทำให้ build พังหรือ
// รั่ว secret ถ้าถูกดึงเข้า client bundle
//
// อัปโหลด/ลบไฟล์ยังคงเป็น server action เดิม (uploadDocument/deleteDocument) เพราะต้องเรียก Google
// Drive API ด้วย service account ซึ่งทำได้แค่ฝั่ง server เท่านั้น

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isDriveRef, driveFileId, driveViewUrl } from "@/lib/storage/ref";
import { formatThaiDate } from "@/lib/thai";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { WordFileIcon, PdfFileIcon } from "@/components/icons";
import { uploadDocument, deleteDocument } from "./actions";

const BUCKET = "procurement-files";

type DocumentRow = { id: string; file_name: string; file_url: string; created_at: string };
type ProjectFile = { id: string; name: string; file_url_word: string | null; file_url_pdf: string | null };

async function resolveUrls(
  supabase: ReturnType<typeof createClient>,
  refs: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const supabasePaths: string[] = [];
  for (const ref of refs) {
    if (!ref) continue;
    if (isDriveRef(ref)) result.set(ref, driveViewUrl(driveFileId(ref)));
    else supabasePaths.push(ref);
  }
  if (supabasePaths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(supabasePaths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) result.set(s.path ?? "", s.signedUrl);
    });
  }
  return result;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [signedProjectFileUrls, setSignedProjectFileUrls] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: docs, error }, { data: proposals }] = await Promise.all([
      supabase
        .from("proc_documents")
        .select("id, file_name, file_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("plan_project_proposals")
        .select("id, name, file_url_word, file_url_pdf, approved_at")
        .eq("status", "อนุมัติแล้ว")
        .order("approved_at", { ascending: false }),
    ]);
    if (error) setError(error.message);
    setDocuments(docs ?? []);

    const files = (proposals ?? []).filter((p) => p.file_url_word || p.file_url_pdf);
    setProjectFiles(files);

    const [docUrls, projectFileUrls] = await Promise.all([
      resolveUrls(
        supabase,
        (docs ?? []).map((d) => d.file_url),
      ),
      resolveUrls(
        supabase,
        files.flatMap((p) => [p.file_url_word, p.file_url_pdf]),
      ),
    ]);
    setSignedUrls(docUrls);
    setSignedProjectFileUrls(projectFileUrls);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await uploadDocument(formData);
      await toastSuccess("อัปโหลดไฟล์เรียบร้อยแล้ว");
      form.reset();
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, ref: string) {
    try {
      await deleteDocument(id, ref);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

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
              {documents !== null && projectFiles.length === 0 && (
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
        <form onSubmit={handleUpload} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="file_name" placeholder="ชื่อไฟล์เอกสาร (ไม่ระบุ = ใช้ชื่อไฟล์เดิม)" className="input sm:col-span-2" />
          <input type="file" name="file" required className="input" />
          <button type="submit" className="btn-primary sm:col-span-3">
            อัปโหลด
          </button>
        </form>
      </div>

      {documents === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
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
              {documents.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium text-slate-900">{d.file_name}</td>
                  <td>{formatThaiDate(d.created_at)}</td>
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
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id, d.file_url)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {documents.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
