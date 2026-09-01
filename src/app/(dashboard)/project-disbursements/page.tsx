"use client";

// Client Component — ดึงรายการเบิกจ่ายงบประมาณโครงการผ่าน browser Supabase client
// (ต่อจาก /allowance, /contracts, /deliveries — ดู /root/.claude/plans)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { createProjectDisbursement, deleteProjectDisbursement, markProjectDisbursementPaid } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Row = {
  id: string;
  doc_no: string | null;
  activity_name: string | null;
  amount: number;
  status: string;
  paid_at: string | null;
  plan_projects: { name: string } | null;
};
type Project = { id: string; name: string };

export default function ProjectDisbursementsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rowsData, error }, { data: projectsData }] = await Promise.all([
      supabase
        .from("proc_project_disbursements")
        .select("id, doc_no, activity_name, amount, status, paid_at, plan_projects(name)")
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
      await createProjectDisbursement(formData);
      await toastSuccess("บันทึกข้อมูลเรียบร้อยแล้ว");
      form.reset();
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleMarkPaid(id: string) {
    try {
      await markProjectDisbursementPaid(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProjectDisbursement(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">แบบบันทึกการเบิกจ่ายงบประมาณโครงการ</h1>
        </div>
      </div>

      <div className="card mb-6">
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input name="doc_no" placeholder="เลขที่เอกสาร" className="input" />
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

      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
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
              {rows.map((r) => {
                const paid = r.status === "paid";
                return (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.doc_no ?? "-"}</td>
                    <td>{r.plan_projects?.name ?? "-"}</td>
                    <td>{r.activity_name ?? "-"}</td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(Number(r.amount))}</td>
                    <td className="text-center">
                      {paid ? <span className="badge-emerald">จ่ายแล้ว</span> : <span className="badge-amber">รอเบิกจ่าย</span>}
                    </td>
                    <td className="text-right space-x-2">
                      {!paid && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(r.id)}
                          className="text-xs font-medium text-navy-800 hover:underline"
                        >
                          จ่ายเงิน
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
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
