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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">คลังเอกสารดาวน์โหลด</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">เพิ่มไฟล์ใหม่</h2>
        <form action={uploadDocument} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="file_name" placeholder="ชื่อไฟล์เอกสาร (ไม่ระบุ = ใช้ชื่อไฟล์เดิม)" className="input sm:col-span-2" />
          <input type="file" name="file" required className="input" />
          <button
            type="submit"
            className="sm:col-span-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            อัปโหลด
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อไฟล์เอกสาร</th>
              <th className="px-4 py-3">วันที่เพิ่ม</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{d.file_name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(d.created_at).toLocaleDateString("th-TH")}
                </td>
                <td className="px-4 py-3 text-right">
                  {signedUrls.get(d.file_url) ? (
                    <a
                      href={signedUrls.get(d.file_url)}
                      target="_blank"
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      ดาวน์โหลด
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">ไม่พบไฟล์</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
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
