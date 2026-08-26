import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { DashboardShell } from "@/components/dashboard-shell";

const NAV_SECTIONS = [
  {
    heading: null,
    items: [{ href: "/", label: "แดชบอร์ด" }],
  },
  {
    heading: "งานแผนงาน",
    items: [
      { href: "/projects", label: "โครงการ" },
      { href: "/project-reports", label: "รายงานโครงการ" },
      { href: "/approvals", label: "บันทึกขออนุมัติ" },
    ],
  },
  {
    heading: "งานพัสดุ",
    items: [
      { href: "/purchase-requests", label: "รายการขอซื้อ-ขอจ้าง" },
      { href: "/vendors", label: "ข้อมูลผู้ขาย/ผู้รับจ้าง" },
      { href: "/contracts", label: "งานสัญญาจ้าง" },
      { href: "/deliveries", label: "บันทึกส่งมอบงาน" },
    ],
  },
  {
    heading: "งานการเงิน",
    items: [
      { href: "/project-disbursements", label: "เบิกจ่ายงบประมาณโครงการ" },
      { href: "/allowance", label: "เบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค" },
    ],
  },
  {
    heading: "คลังเอกสาร",
    items: [{ href: "/documents", label: "คลังเอกสารดาวน์โหลด" }],
  },
];

const ADMIN_SECTION = {
  heading: "ผู้ดูแลระบบ",
  items: [
    { href: "/admin/users", label: "จัดการผู้ใช้และสิทธิ์" },
    { href: "/settings", label: "ตั้งค่าระบบ" },
  ],
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = user?.email ?? "";
  let roleLabel = "";
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("proc_profiles")
      .select("full_name, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile) {
      displayName = profile.full_name;
      roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
      isAdmin = profile.role === "admin";
    }
  }

  const navSections = isAdmin ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;
  const initial = displayName ? displayName.trim().charAt(0) : "?";
  const dateLabel = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <DashboardShell
      navSections={navSections}
      displayName={displayName}
      roleLabel={roleLabel}
      initial={initial}
      dateLabel={dateLabel}
      logoutAction={logout}
    >
      {children}
    </DashboardShell>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};
