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
    items: [{ href: "/projects", label: "โครงการ" }],
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
];

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
  if (user) {
    const { data: profile } = await supabase
      .from("proc_profiles")
      .select("full_name, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile) displayName = `${profile.full_name} (${profile.role})`;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-blue-600 to-blue-800 text-white">
        <div className="px-5 py-6 text-center">
          <div className="text-sm font-semibold">ตาเบาวิทยา</div>
          <div className="text-xs text-blue-100">ระบบบริหารงบประมาณ</div>
        </div>
        <nav className="flex-1 space-y-4 px-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading ?? "root"}>
              {section.heading && (
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-blue-200">
                  {section.heading}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-md px-3 py-2 text-sm text-blue-50 transition hover:bg-white/10"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <p className="mb-2 truncate px-3 text-xs text-blue-100">{displayName}</p>
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
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  );
}
