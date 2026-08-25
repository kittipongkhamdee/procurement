import { createClient } from "@/lib/supabase/server";
import { deleteApproval } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data: approvals, error } = await supabase
    .from("proc_approvals")
    .select("id, doc_date, subject, requested_amount, requested_by_name, approval_pdf_url, plan_projects(name)")
    .order("created_at", { ascending: false });

  const signedPdfUrls = new Map<string, string>();
  const paths = (approvals ?? []).map((a) => a.approval_pdf_url).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("procurement-documents").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) signedPdfUrls.set(s.path ?? "", s.signedUrl);
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">ประวัติการบันทึกขออนุมัติ</h1>
        <a
          href="/approvals/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + สร้างบันทึกขออนุมัติ
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">วันที่</th>
              <th className="px-4 py-3">เรื่อง</th>
              <th className="px-4 py-3">โครงการ</th>
              <th className="px-4 py-3">ผู้ขออนุมัติ</th>
              <th className="px-4 py-3 text-right">ขออนุมัติครั้งนี้</th>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {approvals?.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-slate-600">{a.doc_date}</td>
                <td className="px-4 py-3 text-slate-600">{a.subject}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(a.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{a.requested_by_name ?? "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">
                  {formatBaht(Number(a.requested_amount))}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={(a.approval_pdf_url && signedPdfUrls.get(a.approval_pdf_url)) || `/approvals/${a.id}/pdf`}
                    target="_blank"
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    PDF
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteApproval.bind(null, a.id)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {approvals?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
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
