import { createClient } from "@/lib/supabase/server";
import {
  createProjectDisbursement,
  deleteProjectDisbursement,
  markProjectDisbursementPaid,
} from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function ProjectDisbursementsPage() {
  const supabase = await createClient();
  const [{ data: rows, error }, { data: projects }] = await Promise.all([
    supabase
      .from("proc_project_disbursements")
      .select("id, doc_no, activity_name, amount, status, paid_at, plan_projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plan_projects").select("id, name").order("sort_order"),
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">แบบบันทึกการเบิกจ่ายงบประมาณโครงการ</h1>
        </div>
      </div>

      <div className="card mb-6">
        <form action={createProjectDisbursement} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="doc_no" placeholder="เลขที่เอกสาร" className="input" />
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
          <input
            type="number"
            step="0.01"
            name="amount"
            placeholder="จำนวนเงิน"
            required
            className="input text-right font-semibold text-emerald-700"
          />
          <input name="activity_name" placeholder="กิจกรรม/รายละเอียด" className="input sm:col-span-3" />
          <button type="submit" className="btn-primary">
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>โครงการ</th>
              <th>กิจกรรม</th>
              <th className="text-right">จำนวนเงิน</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => {
              const paid = r.status === "paid";
              return (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                  <td>
                    {(r.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                  </td>
                  <td>{r.activity_name ?? "-"}</td>
                  <td className="text-right font-semibold text-slate-900">
                    {formatBaht(Number(r.amount))}
                  </td>
                  <td className="text-center">
                    {paid ? (
                      <span className="badge-emerald">จ่ายแล้ว</span>
                    ) : (
                      <span className="badge-amber">รอเบิกจ่าย</span>
                    )}
                  </td>
                  <td className="text-right space-x-2">
                    {!paid && (
                      <form action={markProjectDisbursementPaid.bind(null, r.id)} className="inline">
                        <button type="submit" className="text-xs font-medium text-navy-800 hover:underline">
                          จ่ายเงิน
                        </button>
                      </form>
                    )}
                    <form action={deleteProjectDisbursement.bind(null, r.id)} className="inline">
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        ลบ
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
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
