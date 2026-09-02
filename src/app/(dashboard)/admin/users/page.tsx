"use client";

// Client Component — admin gate เช็คฝั่ง client ผ่าน useAuth().isAdmin เหมือน /settings
// (ดู /root/.claude/plans) ดึงรายชื่อผู้ใช้ผ่าน RPC proc_admin_list_users (SECURITY DEFINER ที่
// เช็ค proc_current_role() = 'admin' เองภายใน — ปลอดภัยเรียกจาก browser client)

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { approveUser, setUserRole, updateUserFullName } from "./actions";
import { UserNameField } from "./user-name-field";

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};

const ROLES = ["admin", "supply_officer", "finance_officer", "teacher", "director"] as const;

type AppUser = { user_id: string; email: string; full_name: string; position: string | null; role: string; status: string };

export default function AdminUsersPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("proc_admin_list_users");
    if (error) setError(error.message);
    setUsers((data as unknown as AppUser[]) ?? []);
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [authLoading, isAdmin, reload]);

  async function handleSetRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await setUserRole(formData);
      await toastSuccess("บันทึกสิทธิ์เรียบร้อยแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleApprove(userId: string) {
    try {
      await approveUser(userId);
      await toastSuccess("อนุมัติผู้ใช้เรียบร้อยแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  if (authLoading) return <PageLoadingSkeleton />;

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">จัดการผู้ใช้และสิทธิ์</h1>
          <p className="page-subtitle">กำหนดสิทธิ์การใช้งานของบุคลากรในระบบ</p>
        </div>
      </div>

      {users === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="table-shell">
          {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
          <table className="table-base">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>อีเมล</th>
                <th>ตำแหน่ง</th>
                <th>สถานะ</th>
                <th>สิทธิ์การใช้งาน</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td className="min-w-[10rem]">
                    <UserNameField userId={u.user_id} fullName={u.full_name} updateUserFullName={updateUserFullName} />
                  </td>
                  <td>{u.email}</td>
                  <td>{u.position ?? "-"}</td>
                  <td>
                    {u.status === "pending" ? (
                      <div className="flex items-center gap-2">
                        <span className="badge-navy">รออนุมัติ</span>
                        <button type="button" onClick={() => handleApprove(u.user_id)} className="btn-primary btn-sm">
                          อนุมัติ
                        </button>
                      </div>
                    ) : (
                      <span className="badge-emerald">อนุมัติแล้ว</span>
                    )}
                  </td>
                  <td>
                    <form onSubmit={handleSetRole} className="flex items-center gap-2">
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    ยังไม่มีผู้ใช้
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
