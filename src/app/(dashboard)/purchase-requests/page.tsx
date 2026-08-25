import { createClient } from "@/lib/supabase/server";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function PurchaseRequestsPage() {
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("proc_purchase_requests")
    .select("id, doc_type, doc_no, record_date, item_name, amount, pdf_url, proc_vendors(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  // pdf_url stores a private storage path, not a public URL — sign it fresh on every
  // render (1hr expiry) instead of exposing a permanent public link to procurement docs.
  const signedPdfUrls = new Map<string, string>();
  const paths = (requests ?? []).map((r) => r.pdf_url).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("procurement-documents")
      .createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) signedPdfUrls.set(s.path ?? "", s.signedUrl);
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">รายการขอซื้อ-ขอจ้าง</h1>
        <a
          href="/purchase-requests/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + เพิ่มบันทึกข้อความ
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">เลขที่</th>
              <th className="px-4 py-3">วันที่บันทึก</th>
              <th className="px-4 py-3">รายการ</th>
              <th className="px-4 py-3">ผู้ขาย</th>
              <th className="px-4 py-3 text-right">จำนวนเงิน</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.doc_type === "ซื้อ"
                        ? "font-medium text-emerald-600"
                        : "font-medium text-blue-600"
                    }
                  >
                    {r.doc_type === "ซื้อ" ? "จัดซื้อ" : "จัดจ้าง"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.doc_no}</td>
                <td className="px-4 py-3 text-slate-600">{r.record_date}</td>
                <td className="px-4 py-3 text-slate-600">{r.item_name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(r.proc_vendors as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatBaht(Number(r.amount))}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={(r.pdf_url && signedPdfUrls.get(r.pdf_url)) || `/purchase-requests/${r.id}/pdf`}
                    target="_blank"
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
            {requests?.length === 0 && (
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
