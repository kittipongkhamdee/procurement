"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type NavItem = { href: string; label: string };
type NavSection = { heading: string | null; items: NavItem[] };

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-gradient-to-b from-navy-950 to-navy-800 text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-gold-400 bg-white/5 text-lg font-bold text-gold-400">
            ตว
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">โรงเรียนตาเบาวิทยา</div>
            <div className="text-xs leading-tight text-navy-200">ระบบบริหารงบประมาณ</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="ปิดเมนู"
            className="ml-auto rounded-md p-1.5 text-navy-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
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
                    onClick={() => setMobileOpen(false)}
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
          <form action={logoutAction}>
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-800 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="truncate text-sm font-medium text-slate-500">
            ระบบบริหารงานงบประมาณ โรงเรียนตาเบาวิทยา
          </span>
          <span className="ml-auto shrink-0 text-xs text-slate-400">{dateLabel}</span>
        </header>
        <main className="flex-1 bg-slate-100 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
