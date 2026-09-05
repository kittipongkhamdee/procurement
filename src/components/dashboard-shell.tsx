"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useSchoolSettings } from "@/lib/school-settings";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  CloseIcon,
  FolderIcon,
  GridIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShoppingCartIcon,
  UserIcon,
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

// เมนูที่กำลังตรวจ/แก้ไขอยู่ ยังไม่พร้อมให้ใช้งานจริง — ปิดลิงก์ไว้ก่อนชั่วคราว (ยังเข้าหน้าตรงๆ
// ผ่าน URL ได้ปกติสำหรับคนที่กำลังพัฒนา/ตรวจสอบอยู่) เอาออกจาก Set นี้เมื่อพร้อมเปิดใช้งานจริง
const DISABLED_HREFS = new Set([
  "/purchase-requests",
  "/vendors",
  "/contracts",
  "/deliveries",
  "/project-disbursements",
  "/allowance",
]);

export function DashboardShell({
  baseNavSections,
  adminSection,
  dateLabel,
  logoutAction,
  children,
}: {
  baseNavSections: NavSection[];
  adminSection: NavSection;
  dateLabel: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin, roleLabel, displayName, avatarUrl, loading, pendingApproval } = useAuth();
  const { schoolName, logoUrl } = useSchoolSettings();
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

  // เมนู "ผู้ดูแลระบบ" โผล่เฉพาะแอดมิน — กรองฝั่ง client จาก context (หน้า /admin/users และ
  // /settings ยังเช็คสิทธิ์ฝั่ง server ของตัวเองอยู่แล้ว การซ่อนเมนูเป็นแค่เรื่องการแสดงผล)
  const navSections = useMemo(
    () => (isAdmin ? [...baseNavSections, adminSection] : baseNavSections),
    [baseNavSections, adminSection, isAdmin],
  );
  const initial = displayName ? displayName.trim().charAt(0) : "?";

  const allItems = useMemo(
    () => navSections.flatMap((s) => s.items).filter((i) => !DISABLED_HREFS.has(i.href)),
    [navSections],
  );
  const matches = query.trim() ? allItems.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase())) : [];

  // บัญชีที่สมัครเองแล้วยังไม่ผ่านการอนุมัติจากแอดมิน — กันไว้ทั้งชั้น UI (ไม่โชว์เมนู/ข้อมูลใดๆ
  // เลย) ส่วนการบังคับจริงอยู่ที่ proc_current_role() ในฐานข้อมูล (คืนค่า role เฉพาะบัญชีที่
  // status='approved') ทำให้ RLS ทุกจุดบล็อกบัญชี pending อยู่แล้วไม่ว่าจะผ่านหน้านี้หรือไม่
  if (!loading && pendingApproval) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ClipboardCheckIcon className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">รอการอนุมัติ</h1>
          <p className="mt-2 text-sm text-slate-500">
            บัญชีของคุณสมัครสำเร็จแล้ว แต่ยังใช้งานไม่ได้จนกว่าผู้ดูแลระบบจะอนุมัติ กรุณาติดต่อผู้ดูแลระบบ
            หรือรอการอนุมัติแล้วลองเข้าสู่ระบบใหม่อีกครั้ง
          </p>
          <form action={logoutAction} className="mt-6">
            <button type="submit" className="btn-secondary w-full">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-800 text-white transition-all duration-200 print:hidden lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div
            className={
              logoUrl
                ? "flex h-11 w-11 shrink-0 items-center justify-center"
                : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-white/5 text-lg font-bold text-gold-400"
            }
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={schoolName} width={44} height={44} unoptimized className="h-full w-full object-contain" />
            ) : (
              schoolName.charAt(0) || "ร"
            )}
          </div>
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <div className="truncate text-sm font-semibold leading-tight">{schoolName}</div>
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
                  if (DISABLED_HREFS.has(item.href)) {
                    return (
                      <div
                        key={item.href}
                        title={collapsed ? item.label : "อยู่ระหว่างปรับปรุง ยังไม่เปิดใช้งาน"}
                        className={`flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-navy-400/60 ${
                          collapsed ? "lg:justify-center" : ""
                        }`}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className={`flex-1 ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                        <span
                          className={`shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-100 ${collapsed ? "lg:hidden" : ""}`}
                        >
                          ปรับปรุง
                        </span>
                      </div>
                    );
                  }
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
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden lg:px-6">
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

          {/* ห่อกลุ่มวันที่/กระดิ่ง/โปรไฟล์ไว้ในคอนเทนเนอร์เดียวแล้วใส่ ml-auto ที่นี่แทน (ไม่ใช่ที่
              วันที่ตรงๆ) เพราะวันที่ถูกซ่อนไว้ก่อน lg — ถ้าไม่มี ml-auto ที่ระดับกลุ่ม ตอนจอกว้าง
              ระหว่าง sm–lg (วันที่ยังซ่อนอยู่) จะไม่มีตัวไหนดันกลุ่มนี้ไปชิดขวา เหลือช่องว่างค้างไว้ */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-slate-400 lg:inline">{dateLabel}</span>

            {!DISABLED_HREFS.has("/project-disbursements") && (
              <Link
                href="/project-disbursements"
                aria-label="รายการเบิกจ่ายงบประมาณโครงการ"
                className="relative rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-800"
              >
                <BellIcon className="h-5 w-5" />
              </Link>
            )}

            <div className="relative">
              <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md py-1 pl-1.5 pr-2 hover:bg-slate-100"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-navy-950 ${
                  loading ? "animate-pulse bg-slate-200" : "bg-gold-500"
                }`}
              >
                {loading ? (
                  ""
                ) : avatarUrl ? (
                  <Image src={avatarUrl} alt={displayName} width={32} height={32} unoptimized className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              <span className="hidden text-left sm:block">
                {loading ? (
                  <span className="block h-3 w-20 animate-pulse rounded bg-slate-200" />
                ) : (
                  <>
                    <span className="block truncate text-xs font-medium text-slate-800">{displayName}</span>
                    {roleLabel && <span className="block truncate text-[11px] text-slate-400">{roleLabel}</span>}
                  </>
                )}
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
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserIcon className="h-4 w-4" />
                    โปรไฟล์ของฉัน
                  </Link>
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
          </div>
        </header>

        <main className="flex-1 bg-slate-100 p-4 pb-24 print:bg-white print:p-0 lg:p-6 lg:pb-6">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden"
        aria-label="เมนูหลัก (มือถือ)"
      >
        {BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon;
          if (DISABLED_HREFS.has(tab.href)) {
            return (
              <div
                key={tab.href}
                title="อยู่ระหว่างปรับปรุง ยังไม่เปิดใช้งาน"
                className="flex cursor-not-allowed flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium text-slate-300"
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </div>
            );
          }
          const active = pathname === tab.href;
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
