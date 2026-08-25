import { createClient } from "@/lib/supabase/server";
import { createContract, deleteContract } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function ContractsPage() {
  const supabase = await createClient();
  const [{ data: contracts, error }, { data: projects }] = await Promise.all([
    supabase
      .from("proc_contracts")
      .select("id, contract_no, contract_date, vendor_name, amount, plan_projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("plan_projects").select("id, name").order("sort_order"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">งานสัญญาจ้าง</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">บันทึกสัญญาใหม่</h2>
        <form action={createContract} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="contract_no" placeholder="เลขที่สัญญา" required className="input" />
          <select name="project_id" required className="input" defaultValue="">
            <option value="" disabled>
              เลือกโครงการ..
            </option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="date" name="contract_date" required className="input" />
          <input name="vendor_name" placeholder="ชื่อผู้รับจ้าง" required className="input sm:col-span-2" />
          <input name="id_card" placeholder="เลขประจำตัวผู้เสียภาษี/บัตร ปชช." className="input" />
          <input name="house_no" placeholder="บ้านเลขที่" className="input" />
          <input name="moo" placeholder="หมู่ที่" className="input" />
          <input name="tambon" placeholder="ตำบล" className="input" />
          <input name="amphoe" placeholder="อำเภอ" className="input" />
          <input name="province" placeholder="จังหวัด" className="input" />
          <input name="zipcode" placeholder="รหัสไปรษณีย์" className="input" />
          <input name="phone" placeholder="โทรศัพท์" className="input" />
          <input type="number" step="0.01" name="budget" placeholder="งบประมาณโครงการ" className="input" />
          <input
            type="number"
            step="0.01"
            name="amount"
            placeholder="จำนวนเงินตามสัญญา"
            required
            className="input font-semibold text-emerald-700"
          />
          <textarea name="detail" placeholder="รายละเอียดงานจ้าง" rows={2} className="input sm:col-span-3" />
          <input name="inspector_name" placeholder="ผู้ตรวจรับ" className="input" />
          <button
            type="submit"
            className="sm:col-span-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            บันทึกสัญญา
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขที่สัญญา</th>
              <th className="px-4 py-3">วันที่ทำสัญญา</th>
              <th className="px-4 py-3">โครงการ</th>
              <th className="px-4 py-3">ผู้รับจ้าง</th>
              <th className="px-4 py-3 text-right">จำนวนเงิน</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts?.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.contract_no}</td>
                <td className="px-4 py-3 text-slate-600">{c.contract_date}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(c.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">{c.vendor_name}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                  {formatBaht(Number(c.amount))}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteContract.bind(null, c.id)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {contracts?.length === 0 && (
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
