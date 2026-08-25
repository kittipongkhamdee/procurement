import { createClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("plan_projects")
    .select("id, name, sort_order, plan_admin_groups(name), plan_budget_years(year)")
    .order("sort_order");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">โครงการ (จากแผนงบประมาณ)</h1>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">โครงการ</th>
              <th className="px-4 py-3">กลุ่มบริหาร</th>
              <th className="px-4 py-3">ปีงบประมาณ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-"}
                </td>
                <td className="px-4 py-3 text-slate-600">
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
