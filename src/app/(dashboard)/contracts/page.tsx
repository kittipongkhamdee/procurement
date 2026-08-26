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
      <div className="page-header">
        <div>
          <h1 className="page-title">งานสัญญาจ้าง</h1>
          <p className="page-subtitle">บันทึกและติดตามสัญญาจ้างของโรงเรียน</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="card-title">บันทึกสัญญาใหม่</h2>
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
          <button type="submit" className="btn-primary sm:col-span-3">
            บันทึกสัญญา
          </button>
        </form>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>เลขที่สัญญา</th>
              <th>วันที่ทำสัญญา</th>
              <th>โครงการ</th>
              <th>ผู้รับจ้าง</th>
              <th className="text-right">จำนวนเงิน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contracts?.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-slate-900">{c.contract_no}</td>
                <td>{c.contract_date}</td>
                <td>
                  {(c.plan_projects as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td>{c.vendor_name}</td>
                <td className="text-right font-semibold text-slate-900">
                  {formatBaht(Number(c.amount))}
                </td>
                <td className="text-right">
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
