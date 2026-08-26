import { createClient } from "@/lib/supabase/server";
import { uploadDocument, deleteDocument } from "./actions";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: documents, error } = await supabase
    .from("proc_documents")
    .select("id, file_name, file_url, created_at")
    .order("created_at", { ascending: false });

  const paths = (documents ?? []).map((d) => d.file_url);
  const signedUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("procurement-files").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) signedUrls.set(s.path ?? "", s.signedUrl);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">คลังเอกสารดาวน์โหลด</h1>
        </div>
      </div>

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
                  {new Date(d.created_at).toLocaleDateString("th-TH")}
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
