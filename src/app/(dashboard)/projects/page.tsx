import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("plan_projects")
    .select("id, name, sort_order, plan_admin_groups(name), plan_budget_years(year)")
    .order("sort_order");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ (จากแผนงบประมาณ)</h1>
        </div>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>โครงการ</th>
              <th>กลุ่มบริหาร</th>
              <th>ปีงบประมาณ</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((p) => (
              <tr key={p.id}>
                <td className="font-medium text-slate-900">{p.name}</td>
                <td>
                  {(p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td>
                  {(p.plan_budget_years as unknown as { year: number } | null)?.year ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        ข้อมูลนี้อ่านจากตาราง plan_projects ซึ่งใช้ร่วมกับระบบสำรวจครุภัณฑ์ — จัดการรายการ/งบประมาณโครงการที่นั่น
      </p>
    </div>
  );
}
