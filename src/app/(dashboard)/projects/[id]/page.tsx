import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createActivity, deleteActivity, deleteProject, updateActivity, updateProject } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const isAdmin = myProfile?.role === "admin";

  const [{ data: project }, { data: activities }, { data: adminGroups }, { data: budgetSources }] = await Promise.all([
    supabase
      .from("plan_projects")
      .select("id, name, budget_year_id, admin_group_id, budget_source_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("plan_activities").select("id, name, budget, responsible").eq("project_id", id).order("sort_order"),
    supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
  ]);

  if (!project) notFound();

  const { data: disbursements } = await supabase
    .from("proc_project_disbursements")
    .select("amount")
    .eq("project_id", id)
    .eq("status", "paid");

  const budget = (activities ?? []).reduce((sum, a) => sum + Number(a.budget ?? 0), 0);
  const spent = (disbursements ?? []).reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
  const remaining = budget - spent;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">รายละเอียดโครงการและกิจกรรมย่อย</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="stat-label">งบประมาณ</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(budget)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายแล้ว</div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600">{formatBaht(spent)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">คงเหลือ</div>
          <div className="mt-1.5 text-xl font-bold text-amber-600">{formatBaht(remaining)} บาท</div>
        </div>
      </div>

      {isAdmin && (
        <div className="card mt-6">
          <div className="card-title">แก้ไขข้อมูลโครงการ</div>
          <form action={updateProject.bind(null, id)} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="hidden" name="budget_year_id" value={project.budget_year_id} />
            <input name="name" defaultValue={project.name} required className="input sm:col-span-2" />
            <select name="admin_group_id" defaultValue={project.admin_group_id} required className="input">
              {adminGroups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              name="budget_source_id"
              defaultValue={project.budget_source_id ?? ""}
              className="input sm:col-span-2"
            >
              <option value="">แหล่งเงินงบประมาณ (ไม่ระบุ)</option>
              {budgetSources?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary sm:col-span-2">
              บันทึกการแก้ไข
            </button>
          </form>
          <form action={deleteProject.bind(null, id)} className="mt-3 border-t border-slate-100 pt-3">
            <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
              ลบโครงการนี้
            </button>
          </form>
        </div>
      )}

      <div className="table-shell mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>กิจกรรมย่อย</th>
              <th className="text-right">งบประมาณ</th>
              <th>ผู้รับผิดชอบ</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {activities?.map((a) =>
              isAdmin ? (
                <tr key={a.id}>
                  <td colSpan={4} className="p-0">
                    <form
                      action={updateActivity.bind(null, id, a.id)}
                      className="grid grid-cols-1 items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_10rem_10rem_auto]"
                    >
                      <input name="name" defaultValue={a.name ?? ""} className="input" />
                      <input
                        type="number"
                        step="0.01"
                        name="budget"
                        defaultValue={a.budget}
                        className="input text-right"
                      />
                      <input name="responsible" defaultValue={a.responsible ?? ""} className="input" />
                      <div className="flex justify-end gap-2">
                        <button type="submit" className="text-xs font-medium text-navy-800 hover:underline">
                          บันทึก
                        </button>
                        <button
                          type="submit"
                          formAction={deleteActivity.bind(null, id, a.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          ลบ
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={a.id}>
                  <td className="font-medium text-slate-900">{a.name}</td>
                  <td className="text-right tabular-nums">{formatBaht(Number(a.budget))}</td>
                  <td>{a.responsible ?? "-"}</td>
                </tr>
              ),
            )}
            {activities?.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 4 : 3} className="table-empty">
                  ยังไม่มีกิจกรรมย่อย
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <div className="card mt-6">
          <div className="card-title">เพิ่มกิจกรรมย่อย</div>
          <form
            action={createActivity.bind(null, id)}
            className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]"
          >
            <input name="name" placeholder="ชื่อกิจกรรม" required className="input" />
            <input type="number" step="0.01" name="budget" placeholder="งบประมาณ" className="input text-right" />
            <input name="responsible" placeholder="ผู้รับผิดชอบ" className="input" />
            <button type="submit" className="btn-primary">
              เพิ่ม
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
