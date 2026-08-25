import { createClient } from "@/lib/supabase/server";
import { setUserRole } from "./actions";

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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">จัดการผู้ใช้และสิทธิ์</h1>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">ตำแหน่ง</th>
              <th className="px-4 py-3">สิทธิ์การใช้งาน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users?.map((u) => (
              <tr key={u.user_id}>
                <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3 text-slate-600">{u.position ?? "-"}</td>
                <td className="px-4 py-3">
                  <form action={setUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="user_id" value={u.user_id} />
                    <select
                      name="role"
                      defaultValue={u.role}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      บันทึก
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
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
