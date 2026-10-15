"use client";

// Client Component — ดึงรายการผู้ขาย/ผู้รับจ้างผ่าน browser Supabase client แทนการรอ
// Server Component fetch ก่อนส่ง HTML กลับมา (RLS proc_vendors_select เป็น public สำหรับผู้ที่
// ล็อกอิน) ส่วนการเพิ่ม/ลบยังคงเป็น server action เดิม (createVendor/deleteVendor) บังคับสิทธิ์ผ่าน
// RLS ที่ฐานข้อมูลเหมือนเดิมทุกประการ

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ThaiAddressInput } from "@/components/thai-address-input";
import type { Tables } from "@/lib/supabase/database.types";
import { createVendor, deleteVendor } from "./actions";

type Vendor = Tables<"proc_vendors">;

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("proc_vendors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    setVendors(data ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const [addressKey, setAddressKey] = useState(0);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createVendor(formData);
      await toastSuccess("บันทึกข้อมูลเรียบร้อยแล้ว");
      form.reset();
      setAddressKey((k) => k + 1); // ช่องที่อยู่เก็บค่าใน state ของตัวเอง form.reset() ล้างไม่ถึง — remount ใหม่
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVendor(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

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
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="name" placeholder="ชื่อผู้ขาย/ร้านค้า" required className="input" />
          <input name="tax_id" placeholder="เลขประจำตัวผู้เสียภาษี" className="input" />
          <input name="phone" placeholder="โทรศัพท์" className="input" />
          <input name="house_no" placeholder="เลขที่" className="input" />
          <input name="moo" placeholder="หมู่ที่" className="input" />
          <div className="sm:col-span-3">
            <p className="mb-1 text-xs text-slate-500">พิมพ์ตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์ แล้วเลือกจากรายการ ช่องที่เหลือจะเติมให้อัตโนมัติ</p>
            <ThaiAddressInput key={addressKey} />
          </div>
          <button type="submit" className="btn-primary sm:col-span-3">
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      {vendors === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
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
              {vendors.map((v) => (
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
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
