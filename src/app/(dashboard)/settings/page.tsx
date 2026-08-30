import { createClient } from "@/lib/supabase/server";
import { TeacherManager } from "./teacher-manager";
import { AdminGroupManager } from "./admin-group-manager";
import { UserGroupManager } from "./user-group-manager";
import { UserGroupSelect } from "./user-group-select";
import { BudgetSourceToggle } from "./budget-source-toggle";
import { GeminiKeyForm } from "./gemini-key-form";
import { CloseIcon } from "@/components/icons";
import {
  createAdminGroup,
  createBudgetSource,
  createBudgetYear,
  createTeacher,
  createUserGroup,
  deleteAdminGroup,
  deleteBudgetSource,
  deleteTeacher,
  deleteUserGroup,
  setCurrentBudgetYear,
  setGeminiApiKey,
  setGeminiModel,
  setUserGroups,
  toggleAdminGroupActive,
  toggleBudgetSourceActive,
  toggleTeacherActive,
  toggleUserGroupActive,
  updateAdminGroupName,
  updateTeacherName,
  updateUserGroupName,
} from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (myProfile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น
      </div>
    );
  }

  const [
    { data: budgetYears },
    { data: budgetSources },
    { data: teachers },
    { data: adminGroups },
    { data: userGroups },
    { data: users },
    { data: groupMembers },
    { data: geminiKeySetting },
    { data: geminiModelSetting },
  ] = await Promise.all([
    supabase.from("plan_budget_years").select("id, year, name, is_open").order("year", { ascending: false }),
    supabase.from("plan_budget_sources").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("plan_admin_groups").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("proc_user_groups").select("id, name, is_active").order("sort_order").order("name"),
    supabase.rpc("proc_admin_list_users"),
    supabase.from("proc_user_group_members").select("user_id, group_id"),
    supabase.from("proc_app_settings").select("value").eq("key", "gemini_api_key").maybeSingle(),
    supabase.from("proc_app_settings").select("value").eq("key", "gemini_model").maybeSingle(),
  ]);

  const groupIdsByUser = new Map<string, string[]>();
  for (const m of groupMembers ?? []) {
    const list = groupIdsByUser.get(m.user_id) ?? [];
    list.push(m.group_id);
    groupIdsByUser.set(m.user_id, list);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">กำหนดปีงบประมาณปัจจุบันและแหล่งเงินงบประมาณ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">ปีงบประมาณ</div>
          <div className="table-shell mb-4">
            <table className="table-base">
              <thead>
                <tr>
                  <th>ปี พ.ศ.</th>
                  <th>ชื่อแผน</th>
                  <th className="text-center">สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {budgetYears?.map((y) => (
                  <tr key={y.id}>
                    <td className="font-medium text-slate-900">{y.year}</td>
                    <td>{y.name}</td>
                    <td className="text-center">
                      {y.is_open ? (
                        <span className="badge-emerald">ปีปัจจุบัน</span>
                      ) : (
                        <span className="badge-slate">ปิด</span>
                      )}
                    </td>
                    <td className="text-right">
                      {!y.is_open && (
                        <form action={setCurrentBudgetYear.bind(null, y.id)} className="inline">
                          <button type="submit" className="text-xs font-medium text-navy-800 hover:underline">
                            ตั้งเป็นปีปัจจุบัน
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {budgetYears?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      ยังไม่มีปีงบประมาณ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <form action={createBudgetYear} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input type="number" name="year" placeholder="ปี พ.ศ. เช่น 2570" required className="input" />
            <input name="name" placeholder="ชื่อแผน (ไม่บังคับ)" className="input sm:col-span-2" />
            <button type="submit" className="btn-primary sm:col-span-3">
              เพิ่มปีงบประมาณ
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-title">แหล่งเงินงบประมาณ</div>
          <div className="table-shell mb-4">
            <table className="table-base">
              <thead>
                <tr>
                  <th>ชื่อแหล่งเงิน</th>
                  <th className="text-center">สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {budgetSources?.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-900">{s.name}</td>
                    <td className="text-center">
                      <BudgetSourceToggle
                        id={s.id}
                        isActive={s.is_active}
                        toggleBudgetSourceActive={toggleBudgetSourceActive}
                      />
                    </td>
                    <td className="text-right">
                      <form action={deleteBudgetSource.bind(null, s.id)} className="inline">
                        <button type="submit" className="icon-btn-danger" aria-label="ลบ">
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {budgetSources?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      ยังไม่มีแหล่งเงินงบประมาณ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <form action={createBudgetSource} className="flex gap-3">
            <input name="name" placeholder="ชื่อแหล่งเงิน เช่น เงินอุดหนุนรายหัว" required className="input" />
            <button type="submit" className="btn-primary shrink-0">
              เพิ่ม
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">Gemini API Key (สำหรับอ่านไฟล์โครงการด้วย AI)</div>
            <p className="mb-3 text-sm text-slate-500">
              ใช้ให้ AI อ่านไฟล์โครงการ (Word/PDF) แล้วกรอกข้อมูลในฟอร์มเสนอโครงการให้อัตโนมัติ
              รับฟรีได้ที่ aistudio.google.com → Get API Key
            </p>
            <GeminiKeyForm
              currentKey={geminiKeySetting?.value ?? null}
              currentModel={geminiModelSetting?.value ?? null}
              setGeminiApiKey={setGeminiApiKey}
              setGeminiModel={setGeminiModel}
            />
          </div>
        </div>

        <AdminGroupManager
          adminGroups={adminGroups ?? []}
          createAdminGroup={createAdminGroup}
          updateAdminGroupName={updateAdminGroupName}
          toggleAdminGroupActive={toggleAdminGroupActive}
          deleteAdminGroup={deleteAdminGroup}
        />

        <div className="lg:col-span-2">
          <TeacherManager
            teachers={teachers ?? []}
            createTeacher={createTeacher}
            updateTeacherName={updateTeacherName}
            toggleTeacherActive={toggleTeacherActive}
            deleteTeacher={deleteTeacher}
          />
        </div>

        <UserGroupManager
          userGroups={userGroups ?? []}
          createUserGroup={createUserGroup}
          updateUserGroupName={updateUserGroupName}
          toggleUserGroupActive={toggleUserGroupActive}
          deleteUserGroup={deleteUserGroup}
        />

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">กำหนดสถานะผู้ใช้งาน</div>
            <p className="mb-3 text-sm text-slate-500">
              เลือกได้หลายสถานะต่อคน ใช้เพื่อระบุบทบาทของแต่ละคนในโรงเรียน
            </p>
            <div className="table-shell">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>ชื่อ-นามสกุล</th>
                    <th>อีเมล</th>
                    <th>สถานะที่กำหนด</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u) => (
                    <tr key={u.user_id}>
                      <td className="font-medium text-slate-900">{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <UserGroupSelect
                          userId={u.user_id}
                          groups={userGroups ?? []}
                          initialGroupIds={groupIdsByUser.get(u.user_id) ?? []}
                          setUserGroups={setUserGroups}
                        />
                      </td>
                    </tr>
                  ))}
                  {users?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="table-empty">
                        ยังไม่มีผู้ใช้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
