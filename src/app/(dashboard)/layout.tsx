import { logout } from "@/app/login/actions";
import { AuthProvider } from "@/lib/AuthContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { MaintenanceGate } from "@/components/maintenance-gate";
import {
  ArchiveIcon,
  BoxIcon,
  CoinsIcon,
  ClipboardCheckIcon,
  FileSignatureIcon,
  FileTextIcon,
  FolderIcon,
  GridIcon,
  HomeIcon,
  PieChartIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TruckIcon,
  UploadIcon,
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
      // หน้ารวมการ์ด: การจัดสรรเงิน / เสนอโครงการ
      { href: "/planning", label: "จัดทำแผน", icon: <PieChartIcon className={ICON_CLASS} /> },
      { href: "/projects", label: "โครงการ", icon: <FolderIcon className={ICON_CLASS} /> },
      // หน้ารวมการ์ด: รายงานโครงการ / ประเมินความพึงพอใจ
      { href: "/reports", label: "รายงานโครงการ", icon: <FileTextIcon className={ICON_CLASS} /> },
      { href: "/approvals", label: "บันทึกขออนุมัติ", icon: <ClipboardCheckIcon className={ICON_CLASS} /> },
    ],
  },
  // งานพัสดุ — แบ่งกลุ่มตามขั้นตอนงาน; เมนูที่ขึ้นต้น /supplies/ ยังเป็นหน้า "อยู่ระหว่างพัฒนา"
  {
    heading: "งานจัดซื้อจัดจ้าง",
    items: [
      // หน้ารวมการ์ด: งานซื้อ/งานจ้าง (ปกติ), ว 804, ว 119, กรณีเร่งด่วน, เบิกค่าใช้จ่ายโครงการ (ตาราง 2)
      { href: "/supplies/procurement", label: "การจัดซื้อจัดจ้าง", icon: <ShoppingCartIcon className={ICON_CLASS} /> },
      { href: "/supplies/procurement-register", label: "ทะเบียนคุมจัดซื้อจัดจ้าง", icon: <FileTextIcon className={ICON_CLASS} /> },
      { href: "/supplies/textbooks", label: "หนังสือเรียน (เรียนฟรี 15 ปี)", icon: <FileTextIcon className={ICON_CLASS} /> },
      { href: "/supplies/quarterly-announcements", label: "ประกาศผลรายไตรมาส", icon: <FileSignatureIcon className={ICON_CLASS} /> },
      { href: "/contracts", label: "งานสัญญา", icon: <FileSignatureIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "คลังและการเบิก",
    items: [
      { href: "/supplies/stock", label: "บัญชีวัสดุ", icon: <ArchiveIcon className={ICON_CLASS} /> },
      { href: "/supplies/requisitions", label: "ใบเบิกพัสดุ", icon: <UploadIcon className={ICON_CLASS} /> },
      { href: "/supplies/loans", label: "ยืม-คืนพัสดุ", icon: <TruckIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "การเงินและบัญชี",
    items: [
      { href: "/finance/loans", label: "สัญญายืมเงิน", icon: <WalletIcon className={ICON_CLASS} /> },
      { href: "/supplies/withholding-tax", label: "ภาษีหัก ณ ที่จ่าย", icon: <CoinsIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "ทรัพย์สิน",
    items: [
      { href: "/asset-register", label: "ทะเบียนคุมทรัพย์สิน", icon: <BoxIcon className={ICON_CLASS} /> },
      { href: "/asset-audits", label: "ตรวจสอบพัสดุประจำปี", icon: <ClipboardCheckIcon className={ICON_CLASS} /> },
    ],
  },
  {
    heading: "ข้อมูลตั้งต้น",
    items: [
      { href: "/vendors", label: "ร้านค้า / ผู้ขาย", icon: <StoreIcon className={ICON_CLASS} /> },
      { href: "/expense-rates", label: "อัตราค่าใช้จ่ายตามระเบียบ", icon: <CoinsIcon className={ICON_CLASS} /> },
      { href: "/standards-strategies", label: "มาตรฐานและกลยุทธ์", icon: <GridIcon className={ICON_CLASS} /> },
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

// ไม่มี await ใดๆ ในเลย์เอาต์นี้แล้ว — ชื่อ/สิทธิ์ผู้ใช้ย้ายไปโหลดครั้งเดียวที่ AuthProvider
// (ซึ่ง mount ตอนเข้าโซน dashboard) แทนการยิง Supabase ใหม่ทุกครั้งที่เปลี่ยนเมนู

// ให้เวลาเพียงพอสำหรับ server action ที่เรียก Gemini อ่านไฟล์ข้อเสนอโครงการ (ค่าเริ่มต้นของ Vercel
// อาจตัดก่อน AI ตอบกลับ) — ย้ายมาจาก project-reports/page.tsx เดิม เพราะ route segment config
// อย่าง maxDuration ประกาศได้เฉพาะใน Server Component เท่านั้น (page.tsx ของ project-reports
// กลายเป็น Client Component แล้วหลังแปลงเป็น client-side fetch) เลย์เอาต์นี้ยังเป็น Server
// Component และครอบทุกหน้า จึงเป็นจุดที่ใกล้เคียงที่สุดที่ยังประกาศได้ — มีผลกับทุกหน้าใน dashboard
// ซึ่งไม่เป็นปัญหา (แค่ขยายเวลาสูงสุดที่อนุญาต ไม่ได้บังคับให้ทุกอย่างช้าลง)
export const maxDuration = 60;

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
      <MaintenanceGate logoutAction={logout}>
        <DashboardShell
          baseNavSections={NAV_SECTIONS}
          adminSection={ADMIN_SECTION}
          dateLabel={dateLabel}
          logoutAction={logout}
        >
          {children}
        </DashboardShell>
      </MaintenanceGate>
    </AuthProvider>
  );
}
