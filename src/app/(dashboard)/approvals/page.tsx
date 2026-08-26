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
      <div className="page-header">
        <div>
          <h1 className="page-title">ประวัติการบันทึกขออนุมัติ</h1>
        </div>
        <a href="/approvals/new" className="btn-primary">
          + สร้างบันทึกขออนุมัติ
        </a>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>เรื่อง</th>
              <th>โครงการ</th>
              <th>ผู้ขออนุมัติ</th>
              <th className="text-right">ขออนุมัติครั้งนี้</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {approvals?.map((a) => (
              <tr key={a.id}>
                <td>{a.doc_date}</td>
                <td>{a.subject}</td>
                <td>
                  {(a.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="font-medium text-slate-900">{a.requested_by_name ?? "-"}</td>
                <td className="text-right font-semibold text-red-600">
                  {formatBaht(Number(a.requested_amount))}
                </td>
                <td className="text-right">
                  <a
                    href={(a.approval_pdf_url && signedPdfUrls.get(a.approval_pdf_url)) || `/approvals/${a.id}/pdf`}
                    target="_blank"
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    PDF
                  </a>
                </td>
                <td className="text-right">
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
                <td colSpan={7} className="table-empty">
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
