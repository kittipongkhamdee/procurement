"use client";

// หน้ารวม "งานสัญญา" — การ์ดแต่ละหมวด แสดงจำนวนสัญญา ยอดเงินรวม และจำนวนที่ใกล้/เลยกำหนด
// หมวดที่ยังไม่พร้อม (href = null) แสดงเป็นการ์ดจาง "เร็วๆ นี้"

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ArchiveIcon, FileSignatureIcon, ShoppingCartIcon, StoreIcon, TruckIcon } from "@/components/icons";

type Row = { contract_type: string; amount: number; end_date: string | null };
type Stat = { count: number; total: number; dueSoon: number; overdue: number };

const ICON = "h-6 w-6";
const CARDS: { key: string; title: string; description: string; href: string | null; icon: ReactNode; type?: string }[] = [
  { key: "hire", title: "สัญญาจ้าง", description: "สัญญาจ้างทำของ/จ้างเหมาบริการ", href: "/contracts/hire", icon: <FileSignatureIcon className={ICON} />, type: "จ้าง" },
  { key: "purchase", title: "สัญญาซื้อ", description: "สัญญาซื้อขายพัสดุ/ครุภัณฑ์", href: "/contracts/purchase", icon: <ShoppingCartIcon className={ICON} />, type: "ซื้อ" },
  { key: "delivery", title: "ส่งมอบตามสัญญา", description: "บันทึกการส่งมอบและตรวจรับตามสัญญา", href: "/contracts/delivery", icon: <TruckIcon className={ICON} /> },
  { key: "rental", title: "สัญญาเช่าที่ขายของ", description: "สัญญาเช่าพื้นที่ขายของในโรงเรียน", href: "/contracts/rental", icon: <StoreIcon className={ICON} />, type: "เช่า" },
  { key: "register", title: "ทะเบียนสัญญา", description: "รวมสัญญาทุกประเภทในที่เดียว", href: "/contracts/register", icon: <ArchiveIcon className={ICON} /> },
];

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function summarize(rows: Row[]): Stat {
  const today = new Date().toISOString().slice(0, 10);
  const stat: Stat = { count: rows.length, total: 0, dueSoon: 0, overdue: 0 };
  for (const r of rows) {
    stat.total += Number(r.amount);
    if (!r.end_date) continue;
    const days = Math.round((Date.parse(r.end_date) - Date.parse(today)) / 86_400_000);
    if (days < 0) stat.overdue++;
    else if (days <= 7) stat.dueSoon++;
  }
  return stat;
}

export default function ContractsHubPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    createClient()
      .from("proc_contracts")
      .select("contract_type, amount, end_date")
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">งานสัญญา</h1>
          <p className="page-subtitle">สัญญาจ้าง สัญญาซื้อ การส่งมอบ สัญญาเช่า และทะเบียนสัญญา</p>
        </div>
      </div>

      {rows === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const stat = card.type ? summarize(rows.filter((r) => r.contract_type === card.type)) : card.key === "register" ? summarize(rows) : null;
            const body = (
              <>
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-navy-800/10 p-2.5 text-navy-800">{card.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
                      {!card.href && <span className="badge-slate">เร็วๆ นี้</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{card.description}</p>
                  </div>
                </div>
                {stat && (
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stat.count}</p>
                      <p className="text-xs text-slate-500">สัญญา · รวม {formatBaht(stat.total)} บาท</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {stat.dueSoon > 0 && <span className="badge-amber">ใกล้ครบ {stat.dueSoon}</span>}
                      {stat.overdue > 0 && <span className="badge-red">เลยกำหนด {stat.overdue}</span>}
                    </div>
                  </div>
                )}
              </>
            );
            return card.href ? (
              <Link key={card.key} href={card.href} className="card block transition hover:border-navy-800/40 hover:shadow-md">
                {body}
              </Link>
            ) : (
              <div key={card.key} className="card cursor-not-allowed opacity-60" aria-disabled>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
