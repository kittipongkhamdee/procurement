import { createClient } from "@/lib/supabase/server";
import { createAllowanceDisbursement, deleteAllowanceDisbursement } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function AllowancePage() {
  const supabase = await createClient();
  const [{ data: rows, error }, { data: projects }] = await Promise.all([
    supabase
      .from("proc_allowance_disbursements")
      .select("id, doc_no, expense_type, fund_source, amount, created_at, plan_projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plan_projects").select("id, name").order("sort_order"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        บันทึกเบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค
      </h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form action={createAllowanceDisbursement} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="doc_no" placeholder="เลขที่เอกสาร" required className="input" />
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
          <select name="expense_type" required defaultValue="" className="input">
            <option value="" disabled>
              เลือกประเภท..
            </option>
            <option value="เบี้ยเลี้ยง/เดินทาง">เบี้ยเลี้ยง/เดินทาง</option>
            <option value="ค่าสาธารณูปโภค">ค่าสาธารณูปโภค</option>
          </select>
          <select name="fund_source" required defaultValue="" className="input">
            <option value="" disabled>
              เลือกแหล่งเงิน..
            </option>
            <option value="จัดการเรียนการสอน">จัดการเรียนการสอน</option>
            <option value="กิจกรรมพัฒนาผู้เรียน">กิจกรรมพัฒนาผู้เรียน</option>
            <option value="รายได้สถานศึกษา">รายได้สถานศึกษา</option>
          </select>
          <input
            type="number"
            step="0.01"
            name="amount"
            placeholder="จำนวนเงิน"
            required
            className="input text-right font-semibold text-emerald-700"
          />
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
              <th className="px-4 py-3">เลขที่เอกสาร</th>
              <th className="px-4 py-3">โครงการ</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">แหล่งเงิน</th>
              <th className="px-4 py-3 text-right">จำนวนเงิน</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{r.doc_no}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(r.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.expense_type}</td>
                <td className="px-4 py-3 text-slate-600">{r.fund_source}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatBaht(Number(r.amount))}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteAllowanceDisbursement.bind(null, r.id)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
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
