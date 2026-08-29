import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ArchiveIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

const ICON_CLASS = "h-[18px] w-[18px]";

const NAV_SECTIONS = [
  {
    heading: null,
    items: [{ href: "/", label: "แดชบอร์ด", icon: <HomeIcon className={ICON_CLASS} /> }],
  },
  {
    heading: "งานแผนงาน",
    items: [
      { href: "/projects", label: "โครงการ", icon: <FolderIcon className={ICON_CLASS} /> },
      { href: "/project-reports", label: "รายงานโครงการ", icon: <FileTextIcon className={ICON_CLASS} /> },
      { href: "/approvals", label: "บันทึกขออนุมัติ", icon: <ClipboardCheckIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "งานพัสดุ",
    items: [
      { href: "/purchase-requests", label: "รายการขอซื้อ-ขอจ้าง", icon: <ShoppingCartIcon className={ICON_CLASS} /> },
      { href: "/vendors", label: "ข้อมูลผู้ขาย/ผู้รับจ้าง", icon: <StoreIcon className={ICON_CLASS} /> },
      { href: "/contracts", label: "งานสัญญาจ้าง", icon: <FileSignatureIcon className={ICON_CLASS} /> },
      { href: "/deliveries", label: "บันทึกส่งมอบงาน", icon: <TruckIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "งานการเงิน",
    items: [
      { href: "/project-disbursements", label: "เบิกจ่ายงบประมาณโครงการ", icon: <WalletIcon className={ICON_CLASS} /> },
      { href: "/allowance", label: "เบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค", icon: <CoinsIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "คลังเอกสาร",
    items: [{ href: "/documents", label: "คลังเอกสารดาวน์โหลด", icon: <ArchiveIcon className={ICON_CLASS} /> }],
  },
];

const ADMIN_SECTION = {
  heading: "ผู้ดูแลระบบ",
  items: [
    { href: "/admin/users", label: "จัดการผู้ใช้และสิทธิ์", icon: <UsersIcon className={ICON_CLASS} /> },
    { href: "/settings", label: "ตั้งค่าระบบ", icon: <SettingsIcon className={ICON_CLASS} /> },
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

  const { count: pendingCount } = await supabase
    .from("proc_project_disbursements")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

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
      pendingCount={pendingCount ?? 0}
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
