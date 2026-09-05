"use client";

// Client Component — ดึงข้อมูลตั้งค่าทั้งหมดผ่าน browser Supabase client (ต่อจาก /projects,
// /strategies ฯลฯ — ดู /root/.claude/plans) admin gate เช็คฝั่ง client ผ่าน useAuth().isAdmin
// เหมือน /strategies, /standards ทุกจุดที่มี component ลูกดึงข้อมูลเอง (AdminGroupManager,
// UserGroupManager, BudgetSourceToggle) เพิ่ม onChanged callback ให้เรียก
// หลัง mutation สำเร็จ เพื่อ refetch รายการใหม่ (แทนที่ revalidatePath เดิม)

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { AdminGroupManager } from "./admin-group-manager";
import { TeacherManager } from "./teacher-manager";
import { UserGroupManager } from "./user-group-manager";
import { UserGroupSelect } from "./user-group-select";
import { BudgetSourceToggle } from "./budget-source-toggle";
import { GeminiKeyForm } from "./gemini-key-form";
import { AiExtractionToggle } from "./ai-extraction-toggle";
import { StorageProviderToggle } from "./storage-provider-toggle";
import { SchoolBrandingForm } from "./school-branding-form";
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
  removeSchoolLogo,
  setAiExtractionEnabled,
  setCurrentBudgetYear,
  setGeminiApiKey,
  setGeminiModel,
  setSchoolName,
  setStorageProvider,
  setUserGroups,
  toggleAdminGroupActive,
  toggleBudgetSourceActive,
  toggleTeacherActive,
  toggleUserGroupActive,
  updateAdminGroupName,
  updateTeacherName,
  updateUserGroupName,
  uploadSchoolLogo,
} from "./actions";

type Item = { id: string; name: string; is_active: boolean };
type BudgetYear = { id: string; year: number; name: string; is_open: boolean };
type AppUser = { user_id: string; email: string; full_name: string; position: string | null; role: string };

type SettingsData = {
  budgetYears: BudgetYear[];
  budgetSources: Item[];
  adminGroups: Item[];
  teachers: Item[];
  userGroups: Item[];
  users: AppUser[];
  groupIdsByUser: Map<string, string[]>;
  geminiKey: string | null;
  geminiModel: string | null;
  aiExtractionEnabled: boolean;
  storageProvider: "supabase" | "google_drive";
  schoolName: string;
  schoolLogoUrl: string | null;
};

export default function SettingsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<SettingsData | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [
      { data: budgetYears },
      { data: budgetSources },
      { data: adminGroups },
      { data: teachers },
      { data: userGroups },
      { data: users },
      { data: groupMembers },
      { data: geminiKeySetting },
      { data: geminiModelSetting },
      { data: aiExtractionEnabledSetting },
      { data: storageProviderSetting },
      { data: schoolSettings },
    ] = await Promise.all([
      supabase.from("plan_budget_years").select("id, year, name, is_open").order("year", { ascending: false }),
      supabase.from("plan_budget_sources").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("plan_admin_groups").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("proc_user_groups").select("id, name, is_active").order("sort_order").order("name"),
      supabase.rpc("proc_admin_list_users"),
      supabase.from("proc_user_group_members").select("user_id, group_id"),
      supabase.from("proc_app_settings").select("value").eq("key", "gemini_api_key").maybeSingle(),
      supabase.from("proc_app_settings").select("value").eq("key", "gemini_model").maybeSingle(),
      supabase.from("proc_app_settings").select("value").eq("key", "ai_extraction_enabled").maybeSingle(),
      supabase.from("proc_app_settings").select("value").eq("key", "storage_provider").maybeSingle(),
      supabase.from("proc_school_settings").select("school_name, logo_url").eq("id", true).maybeSingle(),
    ]);

    const groupIdsByUser = new Map<string, string[]>();
    for (const m of groupMembers ?? []) {
      const list = groupIdsByUser.get(m.user_id) ?? [];
      list.push(m.group_id);
      groupIdsByUser.set(m.user_id, list);
    }

    setData({
      budgetYears: budgetYears ?? [],
      budgetSources: budgetSources ?? [],
      adminGroups: adminGroups ?? [],
      teachers: teachers ?? [],
      userGroups: userGroups ?? [],
      users: (users as unknown as AppUser[]) ?? [],
      groupIdsByUser,
      geminiKey: geminiKeySetting?.value ?? null,
      geminiModel: geminiModelSetting?.value ?? null,
      aiExtractionEnabled: aiExtractionEnabledSetting?.value !== "false",
      storageProvider: storageProviderSetting?.value === "google_drive" ? "google_drive" : "supabase",
      schoolName: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
      schoolLogoUrl: schoolSettings?.logo_url ?? null,
    });
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reload();
    }
  }, [authLoading, isAdmin, reload]);

  async function handleSetCurrentYear(id: string) {
    try {
      await setCurrentBudgetYear(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreateYear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createBudgetYear(formData);
      await toastSuccess("เพิ่มปีงบประมาณเรียบร้อยแล้ว");
      form.reset();
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDeleteBudgetSource(id: string) {
    try {
      await deleteBudgetSource(id);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreateBudgetSource(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createBudgetSource(formData);
      await toastSuccess("เพิ่มแหล่งเงินงบประมาณเรียบร้อยแล้ว");
      form.reset();
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

  if (data === null) return <PageLoadingSkeleton />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">กำหนดปีงบประมาณปัจจุบันและแหล่งเงินงบประมาณ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">ข้อมูลโรงเรียน</div>
            <p className="mb-4 text-sm text-slate-500">
              ชื่อโรงเรียนและโลโก้นี้จะแสดงแทนที่ค่าเดิมทั่วทั้งระบบ ทั้งแถบเมนู หน้าเข้าสู่ระบบ
              และหน้าทำแบบประเมินสาธารณะที่ไม่ต้องล็อกอิน
            </p>
            <SchoolBrandingForm
              schoolName={data.schoolName}
              logoUrl={data.schoolLogoUrl}
              setSchoolName={setSchoolName}
              uploadSchoolLogo={uploadSchoolLogo}
              removeSchoolLogo={removeSchoolLogo}
              onChanged={reload}
            />
          </div>
        </div>

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
                {data.budgetYears.map((y) => (
                  <tr key={y.id}>
                    <td className="font-medium text-slate-900">{y.year}</td>
                    <td>{y.name}</td>
                    <td className="text-center">
                      {y.is_open ? <span className="badge-emerald">ปีปัจจุบัน</span> : <span className="badge-slate">ปิด</span>}
                    </td>
                    <td className="text-right">
                      {!y.is_open && (
                        <button
                          type="button"
                          onClick={() => handleSetCurrentYear(y.id)}
                          className="text-xs font-medium text-navy-800 hover:underline"
                        >
                          ตั้งเป็นปีปัจจุบัน
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.budgetYears.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty">
                      ยังไม่มีปีงบประมาณ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={handleCreateYear} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                {data.budgetSources.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium text-slate-900">{s.name}</td>
                    <td className="text-center">
                      <BudgetSourceToggle
                        id={s.id}
                        isActive={s.is_active}
                        toggleBudgetSourceActive={toggleBudgetSourceActive}
                        onChanged={reload}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteBudgetSource(s.id)}
                        className="icon-btn-danger"
                        aria-label="ลบ"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {data.budgetSources.length === 0 && (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      ยังไม่มีแหล่งเงินงบประมาณ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <form onSubmit={handleCreateBudgetSource} className="flex gap-3">
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
              currentKey={data.geminiKey}
              currentModel={data.geminiModel}
              setGeminiApiKey={setGeminiApiKey}
              setGeminiModel={setGeminiModel}
            />
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <div className="text-sm font-medium text-slate-700">
                  ปุ่ม &quot;ให้ AI อ่านไฟล์และกรอกข้อมูลอัตโนมัติ&quot; ในฟอร์มเสนอโครงการ
                </div>
                <p className="text-xs text-slate-500">เปิดแล้วผู้เสนอโครงการจะเห็นปุ่มนี้หลังอัปโหลดไฟล์ Word/PDF</p>
              </div>
              <AiExtractionToggle enabled={data.aiExtractionEnabled} setAiExtractionEnabled={setAiExtractionEnabled} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">พื้นที่จัดเก็บไฟล์</div>
            <p className="mb-3 text-sm text-slate-500">
              เลือกปลายทางสำหรับไฟล์ที่อัปโหลดใหม่ (ไฟล์โครงการ Word/PDF และเอกสารทั่วไปในคลังเอกสาร)
              ไฟล์ที่อัปโหลดไว้ก่อนหน้านี้จะยังเปิดดูได้ตามปกติไม่ว่าจะเปลี่ยนมาใช้ปลายทางใด
            </p>
            <StorageProviderToggle currentProvider={data.storageProvider} setStorageProvider={setStorageProvider} />
          </div>
        </div>

        <AdminGroupManager
          adminGroups={data.adminGroups}
          createAdminGroup={createAdminGroup}
          updateAdminGroupName={updateAdminGroupName}
          toggleAdminGroupActive={toggleAdminGroupActive}
          deleteAdminGroup={deleteAdminGroup}
          onChanged={reload}
        />

        <TeacherManager
          teachers={data.teachers}
          registeredUsers={data.users}
          createTeacher={createTeacher}
          updateTeacherName={updateTeacherName}
          toggleTeacherActive={toggleTeacherActive}
          deleteTeacher={deleteTeacher}
          onChanged={reload}
        />

        <UserGroupManager
          userGroups={data.userGroups}
          createUserGroup={createUserGroup}
          updateUserGroupName={updateUserGroupName}
          toggleUserGroupActive={toggleUserGroupActive}
          deleteUserGroup={deleteUserGroup}
          onChanged={reload}
        />

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">กำหนดสถานะผู้ใช้งาน</div>
            <p className="mb-3 text-sm text-slate-500">เลือกได้หลายสถานะต่อคน ใช้เพื่อระบุบทบาทของแต่ละคนในโรงเรียน</p>
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
                  {data.users.map((u) => (
                    <tr key={u.user_id}>
                      <td className="font-medium text-slate-900">{u.full_name}</td>
                      <td>{u.email}</td>
                      <td>
                        <UserGroupSelect
                          userId={u.user_id}
                          groups={data.userGroups}
                          initialGroupIds={data.groupIdsByUser.get(u.user_id) ?? []}
                          setUserGroups={setUserGroups}
                        />
                      </td>
                    </tr>
                  ))}
                  {data.users.length === 0 && (
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
