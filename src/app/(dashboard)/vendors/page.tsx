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
      <div className="page-header">
        <div>
          <h1 className="page-title">ข้อมูลผู้ขาย/ผู้รับจ้าง</h1>
          <p className="page-subtitle">รายชื่อผู้ขายและผู้รับจ้างในระบบ</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="card-title">เพิ่มข้อมูลร้านค้า</h2>
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
          <button type="submit" className="btn-primary sm:col-span-3">
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อผู้ขาย/ร้านค้า</th>
              <th>เลขประจำตัวผู้เสียภาษี</th>
              <th>ที่อยู่</th>
              <th>โทรศัพท์</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vendors?.map((v) => (
              <tr key={v.id}>
                <td className="font-medium text-slate-900">{v.name}</td>
                <td>{v.tax_id ?? "-"}</td>
                <td>
                  {[v.house_no, v.moo && `หมู่ ${v.moo}`, v.tambon, v.amphoe, v.province, v.zipcode]
                    .filter(Boolean)
                    .join(" ")}
                </td>
                <td>{v.phone ?? "-"}</td>
                <td className="text-right">
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
                <td colSpan={5} className="table-empty">
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
