"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  GridIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShoppingCartIcon,
  WalletIcon,
} from "@/components/icons";

type NavItem = { href: string; label: string; icon: ReactNode };
type NavSection = { heading: string | null; items: NavItem[] };

const BOTTOM_TABS = [
  { href: "/", label: "หน้าแรก", icon: HomeIcon },
  { href: "/projects", label: "โครงการ", icon: FolderIcon },
  { href: "/purchase-requests", label: "ขอซื้อ-จ้าง", icon: ShoppingCartIcon },
  { href: "/project-disbursements", label: "การเงิน", icon: WalletIcon },
];

export function DashboardShell({
  navSections,
  displayName,
  roleLabel,
  initial,
  dateLabel,
  logoutAction,
  children,
}: {
  navSections: NavSection[];
  displayName: string;
  roleLabel: string;
  initial: string;
  dateLabel: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem("sidebar-collapsed") === "1") {
      // One-time sync from localStorage on mount (SSR has no localStorage to read upfront).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const allItems = useMemo(() => navSections.flatMap((s) => s.items), [navSections]);
  const matches = query.trim() ? allItems.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase())) : [];

  return (
    <div className="flex min-h-screen">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-800 text-white transition-all duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-white/5 text-lg font-bold text-gold-400">
            ตว
          </div>
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="text-sm font-semibold leading-tight">โรงเรียนตาเบาวิทยา</div>
            <div className="text-xs leading-tight text-navy-200">ระบบบริหารงบประมาณ</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="ปิดเมนู"
            className="ml-auto rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-4">
          {navSections.map((section) => (
            <div key={section.heading ?? "root"}>
              {section.heading && (
                <div
                  className={`px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold-400/90 ${
                    collapsed ? "lg:hidden" : ""
                  }`}
                >
                  {section.heading}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                        collapsed ? "lg:justify-center" : ""
                      } ${active ? "bg-white/10 text-white" : "text-navy-100 hover:bg-white/10 hover:text-white"}`}
                    >
                      <span className={`shrink-0 ${active ? "text-gold-400" : "text-navy-300 group-hover:text-gold-400"}`}>
                        {item.icon}
                      </span>
                      <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden items-center justify-center gap-2 border-t border-white/10 py-3 text-xs text-navy-200 hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
          <span className={collapsed ? "lg:hidden" : ""}>ย่อเมนู</span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-800 lg:hidden"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <div ref={searchRef} className="relative hidden flex-1 max-w-md sm:block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setTimeout(() => setQuery(""), 150)}
              placeholder="ค้นหาเมนู..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-navy-600 focus:bg-white focus:ring-2 focus:ring-navy-600/15"
            />
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                {matches.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    onMouseDown={() => setQuery("")}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-navy-950/[0.04]"
                  >
                    <span className="text-navy-700">{m.icon}</span>
                    {m.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <span className="truncate text-sm font-medium text-slate-500 sm:hidden">
            ระบบบริหารงานงบประมาณ
          </span>

          <span className="ml-auto hidden shrink-0 text-xs text-slate-400 lg:inline">{dateLabel}</span>

          <Link
            href="/project-disbursements"
            aria-label="รายการเบิกจ่ายงบประมาณโครงการ"
            className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-800"
          >
            <BellIcon className="h-5 w-5" />
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md py-1 pl-1.5 pr-2 hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-navy-950">
                {initial}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block truncate text-xs font-medium text-slate-800">{displayName}</span>
                {roleLabel && <span className="block truncate text-[11px] text-slate-400">{roleLabel}</span>}
              </span>
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setProfileOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-sm font-medium text-slate-800">{displayName}</p>
                    {roleLabel && <p className="truncate text-xs text-slate-400">{roleLabel}</p>}
                  </div>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      ออกจากระบบ
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 bg-slate-100 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="เมนูหลัก (มือถือ)"
      >
        {BOTTOM_TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium ${
                active ? "text-navy-800" : "text-slate-400"
              }`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium text-slate-400"
        >
          <GridIcon className="h-5 w-5" />
          เมนู
        </button>
      </nav>
    </div>
  );
}
