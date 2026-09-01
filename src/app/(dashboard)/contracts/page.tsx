"use client";

// Client Component — ต่อจาก /projects (ดู /root/.claude/plans) ดึงรายการสัญญาผ่าน browser
// Supabase client แทนการรอ Server Component fetch ก่อนส่ง HTML กลับมา

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { createContract, deleteContract } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Contract = {
  id: string;
  contract_no: string;
  contract_date: string;
  vendor_name: string;
  amount: number;
  plan_projects: { name: string } | null;
};
type Project = { id: string; name: string };

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: contractsData, error }, { data: projectsData }] = await Promise.all([
      supabase
        .from("proc_contracts")
        .select("id, contract_no, contract_date, vendor_name, amount, plan_projects(name)")
        .order("created_at", { ascending: false }),
      supabase.from("plan_projects").select("id, name").order("sort_order"),
    ]);
    if (error) setError(error.message);
    setContracts((contractsData as unknown as Contract[]) ?? []);
    setProjects(projectsData ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createContract(formData);
      await toastSuccess("บันทึกสัญญาเรียบร้อยแล้ว");
      form.reset();
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContract(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

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
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="contract_no" placeholder="เลขที่สัญญา" required className="input" />
          <select name="project_id" required className="input" defaultValue="">
            <option value="" disabled>
              เลือกโครงการ..
            </option>
            {projects.map((p) => (
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

      {contracts === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
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
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-900">{c.contract_no}</td>
                  <td>{formatThaiDate(c.contract_date)}</td>
                  <td>{c.plan_projects?.name ?? "-"}</td>
                  <td>{c.vendor_name}</td>
                  <td className="text-right font-semibold text-slate-900">{formatBaht(Number(c.amount))}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-empty">
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
