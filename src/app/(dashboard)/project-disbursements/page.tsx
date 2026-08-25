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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">แบบบันทึกการเบิกจ่ายงบประมาณโครงการ</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขที่</th>
              <th className="px-4 py-3">โครงการ</th>
              <th className="px-4 py-3">กิจกรรม</th>
              <th className="px-4 py-3 text-right">จำนวนเงิน</th>
              <th className="px-4 py-3 text-center">สถานะ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((r) => {
              const paid = r.status === "paid";
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(r.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.activity_name ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatBaht(Number(r.amount))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {paid ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        จ่ายแล้ว
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        รอเบิกจ่าย
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {!paid && (
                      <form action={markProjectDisbursementPaid.bind(null, r.id)} className="inline">
                        <button type="submit" className="text-xs font-medium text-blue-600 hover:underline">
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
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
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
