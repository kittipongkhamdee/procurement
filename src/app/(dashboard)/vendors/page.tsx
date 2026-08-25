import { createClient } from "@/lib/supabase/server";
import { createVendor, deleteVendor } from "./actions";

export default async function VendorsPage() {
  const supabase = await createClient();
  const { data: vendors, error } = await supabase
    .from("proc_vendors")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        ข้อมูลผู้ขาย/ผู้รับจ้าง
      </h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">เพิ่มข้อมูลร้านค้า</h2>
        <form action={createVendor} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="name" placeholder="ชื่อผู้ขาย/ร้านค้า" required className="input" />
          <input name="tax_id" placeholder="เลขประจำตัวผู้เสียภาษี" className="input" />
          <input name="phone" placeholder="โทรศัพท์" className="input" />
          <input name="house_no" placeholder="เลขที่" className="input" />
          <input name="moo" placeholder="หมู่ที่" className="input" />
          <input name="tambon" placeholder="ตำบล" className="input" />
          <input name="amphoe" placeholder="อำเภอ" className="input" />
          <input name="province" placeholder="จังหวัด" className="input" />
          <input name="zipcode" placeholder="รหัสไปรษณีย์" className="input" />
          <button
            type="submit"
            className="sm:col-span-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
              <th className="px-4 py-3">ชื่อผู้ขาย/ร้านค้า</th>
              <th className="px-4 py-3">เลขประจำตัวผู้เสียภาษี</th>
              <th className="px-4 py-3">ที่อยู่</th>
              <th className="px-4 py-3">โทรศัพท์</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vendors?.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{v.name}</td>
                <td className="px-4 py-3 text-slate-600">{v.tax_id ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[v.house_no, v.moo && `หมู่ ${v.moo}`, v.tambon, v.amphoe, v.province, v.zipcode]
                    .filter(Boolean)
                    .join(" ")}
                </td>
                <td className="px-4 py-3 text-slate-600">{v.phone ?? "-"}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteVendor.bind(null, v.id)}>
                    <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                      ลบ
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {vendors?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
