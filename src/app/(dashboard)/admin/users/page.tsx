import { createClient } from "@/lib/supabase/server";
import { setUserRole, updateUserFullName } from "./actions";
import { UserNameField } from "./user-name-field";

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};

const ROLES = ["admin", "supply_officer", "finance_officer", "teacher", "director"] as const;

export default async function AdminUsersPage() {
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

  const { data: users, error } = await supabase.rpc("proc_admin_list_users");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">จัดการผู้ใช้และสิทธิ์</h1>
          <p className="page-subtitle">กำหนดสิทธิ์การใช้งานของบุคลากรในระบบ</p>
        </div>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th>อีเมล</th>
              <th>ตำแหน่ง</th>
              <th>สิทธิ์การใช้งาน</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.user_id}>
                <td className="min-w-[10rem]">
                  <UserNameField userId={u.user_id} fullName={u.full_name} updateUserFullName={updateUserFullName} />
                </td>
                <td>{u.email}</td>
                <td>{u.position ?? "-"}</td>
                <td>
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.user_id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-primary btn-sm">
                      บันทึก
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">
                  ยังไม่มีผู้ใช้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
