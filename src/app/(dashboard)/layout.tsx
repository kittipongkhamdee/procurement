import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

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
  items: [{ href: "/admin/users", label: "จัดการผู้ใช้และสิทธิ์" }],
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-800 text-white">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-white/5 text-lg font-bold text-gold-400">
            ตว
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">โรงเรียนตาเบาวิทยา</div>
            <div className="text-xs leading-tight text-navy-200">ระบบบริหารงบประมาณ</div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.heading ?? "root"}>
              {section.heading && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-400/90">
                  {section.heading}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-100 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400 transition group-hover:bg-gold-400" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-3 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{displayName}</p>
              {roleLabel && <p className="truncate text-[11px] text-navy-200">{roleLabel}</p>}
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md bg-white/10 px-3 py-2 text-left text-sm text-white transition hover:bg-white/20"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <span className="text-sm font-medium text-slate-500">
            ระบบบริหารงานงบประมาณ โรงเรียนตาเบาวิทยา
          </span>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </header>
        <main className="flex-1 bg-slate-100 p-6">{children}</main>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  supply_officer: "เจ้าหน้าที่พัสดุ",
  finance_officer: "เจ้าหน้าที่การเงิน",
  teacher: "ครู",
  director: "ผู้อำนวยการ",
};
