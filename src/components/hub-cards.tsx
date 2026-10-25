// การ์ดหน้ารวมเมนู (แบบเดียวกับหน้ารวมงานสัญญา/การจัดซื้อจัดจ้าง) — ไอคอน + ชื่อ + คำอธิบาย + ตัวเลขสรุป กดไปหน้าย่อย

import Link from "next/link";
import type { ReactNode } from "react";

export type HubCard = {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  /** ตัวเลขหลักของการ์ด (ไม่ใส่ = ไม่แสดงแถบตัวเลข) */
  value?: string;
  /** ข้อความใต้ตัวเลข */
  sub?: string;
  /** เนื้อหาการ์ดแบบกำหนดเอง (เช่นมีช่องเลือก/ปุ่มในการ์ด) — ถ้าใส่ จะไม่เป็นลิงก์ทั้งใบ ต้องมีลิงก์/ปุ่มเองข้างใน */
  custom?: ReactNode;
};

export function HubCardGrid({ cards }: { cards: HubCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) =>
        card.custom ? (
          <div key={card.key} className="card">
            {card.custom}
          </div>
        ) : (
        <Link key={card.key} href={card.href} className="card block transition hover:border-navy-800/40 hover:shadow-md">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-navy-800/10 p-2.5 text-navy-800">{card.icon}</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{card.description}</p>
            </div>
          </div>
          {card.value !== undefined && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
              {card.sub && <p className="text-xs text-slate-500">{card.sub}</p>}
            </div>
          )}
        </Link>
        ),
      )}
    </div>
  );
}

/** ปีงบที่เปิดใช้งาน (plan_budget_years.is_open) — ไม่มีก็ใช้ปีล่าสุด */
export function pickBudgetYear<T extends { year: number; is_open: boolean }>(years: T[] | null): T | null {
  return years?.find((y) => y.is_open) ?? years?.[0] ?? null;
}
