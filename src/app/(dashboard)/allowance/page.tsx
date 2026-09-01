"use client";

// Client Component — ดึงรายการเบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภคผ่าน browser Supabase client
// (ต่อจาก /contracts, /deliveries — ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { createAllowanceDisbursement, deleteAllowanceDisbursement } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Row = {
  id: string;
  doc_no: string;
  expense_type: string;
  fund_source: string;
  amount: number;
  created_at: string;
  plan_projects: { name: string } | null;
};
type Project = { id: string; name: string };

export default function AllowancePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rowsData, error }, { data: projectsData }] = await Promise.all([
      supabase
        .from("proc_allowance_disbursements")
        .select("id, doc_no, expense_type, fund_source, amount, created_at, plan_projects(name)")
        .order("created_at", { ascending: false }),
      supabase.from("plan_projects").select("id, name").order("sort_order"),
    ]);
    if (error) setError(error.message);
    setRows((rowsData as unknown as Row[]) ?? []);
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
      await createAllowanceDisbursement(formData);
      await toastSuccess("บันทึกข้อมูลเรียบร้อยแล้ว");
      form.reset();
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAllowanceDisbursement(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">บันทึกเบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค</h1>
        </div>
      </div>

      <div className="card mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="doc_no" placeholder="เลขที่เอกสาร" required className="input" />
          <select name="project_id" required defaultValue="" className="input sm:col-span-2">
            <option value="" disabled>
              เลือกโครงการ..
            </option>
            {projects.map((p) => (
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
          <button type="submit" className="btn-primary">
            บันทึกข้อมูล
          </button>
        </form>
      </div>

      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <table className="table-base">
            <thead>
              <tr>
                <th>เลขที่เอกสาร</th>
                <th>โครงการ</th>
                <th>ประเภท</th>
                <th>แหล่งเงิน</th>
                <th className="text-right">จำนวนเงิน</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-slate-900">{r.doc_no}</td>
                  <td>{r.plan_projects?.name ?? "-"}</td>
                  <td>{r.expense_type}</td>
                  <td>{r.fund_source}</td>
                  <td className="text-right font-semibold text-slate-900">{formatBaht(Number(r.amount))}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
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
