import { logout } from "@/app/login/actions";
import { AuthProvider } from "@/lib/AuthContext";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ArchiveIcon,
  ClipboardCheckIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderIcon,
  GridIcon,
  HomeIcon,
  LightbulbIcon,
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
      { href: "/project-proposals", label: "เสนอโครงการ", icon: <LightbulbIcon className={ICON_CLASS} /> },
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
  {
    heading: "กำหนดรายการ",
    items: [
      { href: "/strategies", label: "กลยุทธ์โรงเรียน", icon: <GridIcon className={ICON_CLASS} /> },
      { href: "/standards", label: "มาตรฐานการศึกษา", icon: <ClipboardCheckIcon className={ICON_CLASS} /> },
    ],
  },
];

const ADMIN_SECTION = {
  heading: "ผู้ดูแลระบบ",
  items: [
    { href: "/admin/users", label: "จัดการผู้ใช้และสิทธิ์", icon: <UsersIcon className={ICON_CLASS} /> },
    { href: "/settings", label: "ตั้งค่าระบบ", icon: <SettingsIcon className={ICON_CLASS} /> },
  ],
};

// ไม่มี await ใดๆ ในเลย์เอาต์นี้แล้ว — ชื่อ/สิทธิ์ผู้ใช้ย้ายไปโหลดครั้งเดียวที่ AuthProvider
// (ซึ่ง mount ตอนเข้าโซน dashboard) แทนการยิง Supabase ใหม่ทุกครั้งที่เปลี่ยนเมนู
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dateLabel = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AuthProvider>
      <DashboardShell
        baseNavSections={NAV_SECTIONS}
        adminSection={ADMIN_SECTION}
        dateLabel={dateLabel}
        logoutAction={logout}
      >
        {children}
      </DashboardShell>
    </AuthProvider>
  );
}
