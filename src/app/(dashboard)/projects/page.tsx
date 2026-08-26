import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

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
          "id, name, admin_group_id, budget_source_id, plan_admin_groups(name), plan_budget_sources(name), plan_activities(budget)",
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
    const budget = (p.plan_activities as unknown as { budget: number }[]).reduce(
      (sum, a) => sum + Number(a.budget ?? 0),
      0,
    );
    const spent = spentByProject.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
      budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
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

      {isAdmin && currentYear && (
        <div className="card mt-6">
          <div className="card-title">เพิ่มโครงการใหม่</div>
          <form action={createProject} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input type="hidden" name="budget_year_id" value={currentYear.id} />
            <input name="name" placeholder="ชื่อโครงการ" required className="input sm:col-span-2" />
            <select name="admin_group_id" required defaultValue="" className="input">
              <option value="" disabled>
                กลุ่มบริหาร..
              </option>
              {adminGroups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select name="budget_source_id" defaultValue="" className="input">
              <option value="">แหล่งเงินงบประมาณ (ไม่ระบุ)</option>
              {budgetSources?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary sm:col-span-4">
              เพิ่มโครงการ
            </button>
          </form>
        </div>
      )}

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
              <th></th>
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
                <td className="text-right">
                  <Link href={`/projects/${r.id}`} className="text-xs font-medium text-navy-800 hover:underline">
                    รายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
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
