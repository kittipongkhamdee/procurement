import { createClient } from "@/lib/supabase/server";
import { Modal } from "@/components/modal";
import {
  createActivity,
  createProject,
  deleteActivity,
  deleteProject,
  updateActivity,
  updateProject,
} from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type Activity = { id: string; name: string | null; budget: number; responsible: string | null };

export default async function ProjectsPage() {
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

  const { data: budgetYears } = await supabase
    .from("plan_budget_years")
    .select("id, year, name, is_open")
    .order("year", { ascending: false });

  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];

  const [{ data: adminGroups }, { data: budgetSources }] = await Promise.all([
    supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
  ]);

  const { data: projects, error } = currentYear
    ? await supabase
        .from("plan_projects")
        .select(
          "id, name, budget_year_id, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(id, name, budget, responsible)",
        )
        .eq("budget_year_id", currentYear.id)
        .order("sort_order")
    : { data: [], error: null };

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: disbursements } =
    projectIds.length > 0
      ? await supabase
          .from("proc_project_disbursements")
          .select("project_id, amount")
          .eq("status", "paid")
          .in("project_id", projectIds)
      : { data: [] };

  const spentByProject = new Map<string, number>();
  for (const d of disbursements ?? []) {
    if (!d.project_id) continue;
    spentByProject.set(d.project_id, (spentByProject.get(d.project_id) ?? 0) + Number(d.amount ?? 0));
  }

  const rows = (projects ?? []).map((p) => {
    const activities = p.plan_activities as unknown as Activity[];
    const budget = activities.reduce((sum, a) => sum + Number(a.budget ?? 0), 0);
    const spent = spentByProject.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      budgetYearId: p.budget_year_id,
      adminGroupId: p.admin_group_id,
      budgetSourceId: p.budget_source_id,
      adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
      budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
      activities,
      budget,
      spent,
      remaining: budget - spent,
    };
  });

  const totalBudget = rows.reduce((sum, r) => sum + r.budget, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">โครงการ</h1>
          <p className="page-subtitle">
            ตามแผนปฏิบัติการ{currentYear ? ` ปีงบประมาณ ${currentYear.year}` : ""}
          </p>
        </div>
        {isAdmin && currentYear && (
          <Modal title="เพิ่มโครงการใหม่" trigger="+ เพิ่มโครงการใหม่" triggerClassName="btn-primary" closeOnSubmit>
            <form action={createProject} className="grid grid-cols-1 gap-3">
              <input type="hidden" name="budget_year_id" value={currentYear.id} />
              <div>
                <label className="label">ชื่อโครงการ</label>
                <input name="name" required className="input" />
              </div>
              <div>
                <label className="label">กลุ่มบริหาร</label>
                <select name="admin_group_id" required defaultValue="" className="input">
                  <option value="" disabled>
                    เลือกกลุ่มบริหาร..
                  </option>
                  {adminGroups?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">แหล่งเงินงบประมาณ</label>
                <select name="budget_source_id" defaultValue="" className="input">
                  <option value="">ไม่ระบุ</option>
                  {budgetSources?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary mt-2">
                บันทึกโครงการ
              </button>
            </form>
          </Modal>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card" style={{ "--accent": "#1b4177" } as React.CSSProperties}>
          <div className="stat-label">จำนวนโครงการ</div>
          <div className="stat-value">
            {rows.length.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
          </div>
        </div>
        <div className="card">
          <div className="stat-label">งบประมาณรวม</div>
          <div className="mt-1.5 text-xl font-bold text-navy-800">{formatBaht(totalBudget)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">เบิกจ่ายแล้ว</div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600">{formatBaht(totalSpent)} บาท</div>
        </div>
        <div className="card">
          <div className="stat-label">คงเหลือ</div>
          <div className="mt-1.5 text-xl font-bold text-amber-600">{formatBaht(totalBudget - totalSpent)} บาท</div>
        </div>
      </div>

      <div className="table-shell mt-6">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>โครงการ</th>
              <th>กลุ่มบริหาร</th>
              <th>แหล่งเงินงบประมาณ</th>
              <th className="text-right">งบประมาณ</th>
              <th className="text-right">เบิกจ่ายแล้ว</th>
              <th className="text-right">คงเหลือ</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-slate-900">{r.name}</td>
                <td>{r.adminGroup}</td>
                <td>{r.budgetSource}</td>
                <td className="text-right tabular-nums">{formatBaht(r.budget)}</td>
                <td className="text-right tabular-nums text-emerald-700">{formatBaht(r.spent)}</td>
                <td className="text-right tabular-nums font-semibold text-amber-700">{formatBaht(r.remaining)}</td>
                {isAdmin && (
                  <td className="text-right">
                    <Modal
                      title={`แก้ไขโครงการ: ${r.name}`}
                      trigger="แก้ไข"
                      triggerClassName="text-xs font-medium text-navy-800 hover:underline"
                    >
                      <form action={updateProject.bind(null, r.id)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <input type="hidden" name="budget_year_id" value={r.budgetYearId} />
                        <div className="sm:col-span-2">
                          <label className="label">ชื่อโครงการ</label>
                          <input name="name" defaultValue={r.name} required className="input" />
                        </div>
                        <div>
                          <label className="label">กลุ่มบริหาร</label>
                          <select name="admin_group_id" defaultValue={r.adminGroupId} required className="input">
                            {adminGroups?.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">แหล่งเงินงบประมาณ</label>
                          <select
                            name="budget_source_id"
                            defaultValue={r.budgetSourceId ?? ""}
                            className="input"
                          >
                            <option value="">ไม่ระบุ</option>
                            {budgetSources?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="btn-primary sm:col-span-2">
                          บันทึกการแก้ไข
                        </button>
                      </form>

                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <div className="card-title">กิจกรรมย่อย</div>
                        <div className="table-shell mb-3">
                          <table className="table-base">
                            <thead>
                              <tr>
                                <th>ชื่อกิจกรรม</th>
                                <th className="text-right">งบประมาณ</th>
                                <th>ผู้รับผิดชอบ</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.activities.map((a) => (
                                <tr key={a.id}>
                                  <td colSpan={4} className="p-0">
                                    <form
                                      action={updateActivity.bind(null, a.id)}
                                      className="grid grid-cols-1 items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
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
                                          formAction={deleteActivity.bind(null, a.id)}
                                          className="text-xs font-medium text-red-600 hover:underline"
                                        >
                                          ลบ
                                        </button>
                                      </div>
                                    </form>
                                  </td>
                                </tr>
                              ))}
                              {r.activities.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="table-empty">
                                    ยังไม่มีกิจกรรมย่อย
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <form
                          action={createActivity.bind(null, r.id)}
                          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
                        >
                          <input name="name" placeholder="ชื่อกิจกรรมใหม่" required className="input" />
                          <input type="number" step="0.01" name="budget" placeholder="งบประมาณ" className="input text-right" />
                          <input name="responsible" placeholder="ผู้รับผิดชอบ" className="input" />
                          <button type="submit" className="btn-secondary">
                            เพิ่ม
                          </button>
                        </form>
                      </div>

                      <form action={deleteProject.bind(null, r.id)} className="mt-6 border-t border-slate-100 pt-4">
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          ลบโครงการนี้
                        </button>
                      </form>
                    </Modal>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="table-empty">
                  ยังไม่มีโครงการในปีงบประมาณนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
