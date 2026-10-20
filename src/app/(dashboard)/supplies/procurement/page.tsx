"use client";

// หน้ารวม "การจัดซื้อจัดจ้าง" — การ์ดแต่ละหมวด (แบบเดียวกับหน้ารวมงานสัญญา) แสดงจำนวนรายการและยอดเงินรวม
// ของปีงบประมาณปัจจุบัน (ปีที่เปิดใช้งาน; ไม่มีก็ใช้ปีงบตามวันที่วันนี้) กดการ์ดไปหน้ารายการของหมวดนั้น

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { CoinsIcon, FileTextIcon, HomeIcon, ShoppingCartIcon } from "@/components/icons";

type Stat = { count: number; total: number };
type CardKey = "purchase" | "hire" | "w804" | "w119" | "urgent" | "claims";

const ICON = "h-6 w-6";
const CARDS: { key: CardKey; title: string; description: string; href: string; icon: ReactNode; unit: string }[] = [
  { key: "purchase", title: "งานซื้อ (ปกติ)", description: "รายงานขอซื้อ วิธีเฉพาะเจาะจง และชุดเอกสารจัดซื้อ", href: "/supplies/purchase", icon: <FileTextIcon className={ICON} />, unit: "รายการ" },
  { key: "hire", title: "งานจ้าง (ปกติ)", description: "รายงานขอจ้าง วิธีเฉพาะเจาะจง และชุดเอกสารจัดจ้าง", href: "/supplies/hire", icon: <HomeIcon className={ICON} />, unit: "รายการ" },
  { key: "w804", title: "ว 804 ซื้อไม่เกิน 50,000", description: "จัดซื้อวงเงินไม่เกิน 50,000 บาท ตามแนวทาง ว 804", href: "/supplies/w804", icon: <ShoppingCartIcon className={ICON} />, unit: "รายการ" },
  { key: "w119", title: "ว 119 ค่าใช้จ่ายบริหารงาน", description: "ค่าใช้จ่ายบริหารงาน/ฝึกอบรม/จัดงาน/ประชุม ครั้งละไม่เกิน 10,000 บาท ซื้อก่อนแล้วรายงานภายใน 5 วันทำการ", href: "/supplies/w119", icon: <FileTextIcon className={ICON} />, unit: "รายการ" },
  { key: "urgent", title: "จัดซื้อ/จัดจ้าง (กรณีมีความจำเป็นเร่งด่วน)", description: "ซื้อ/จ้างไปก่อนเพราะเหตุจำเป็นเร่งด่วน แล้วรายงานขอความเห็นชอบ (ข้อ 79 วรรคสอง)", href: "/supplies/urgent", icon: <ShoppingCartIcon className={ICON} />, unit: "รายการ" },
  { key: "claims", title: "เบิกค่าใช้จ่ายโครงการ (ตาราง 2)", description: "ค่าอาหาร ค่าวิทยากร ค่าเบี้ยเลี้ยง ค่าที่พัก ค่าพาหนะ — เบิกผ่านงานการเงิน", href: "/supplies/expense-claims", icon: <CoinsIcon className={ICON} />, unit: "รายการ" },
];

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sum(rows: { amount: number | null }[] | null): Stat {
  const list = rows ?? [];
  return { count: list.length, total: list.reduce((s, r) => s + Number(r.amount ?? 0), 0) };
}

/** ปีงบประมาณ พ.ศ. ของวันนี้ (ต.ค. ขึ้นปีใหม่) */
function fiscalYearToday() {
  const d = new Date();
  return d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0);
}

export default function ProcurementHubPage() {
  const [stats, setStats] = useState<Record<CardKey, Stat> | null>(null);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: years } = await supabase.from("plan_budget_years").select("year, is_open").order("year", { ascending: false });
      const fy = years?.find((y) => y.is_open)?.year ?? fiscalYearToday();
      const from = `${fy - 544}-10-01`;
      const to = `${fy - 543}-09-30`;
      const pr = (docType: "ซื้อ" | "จ้าง", method: string) =>
        supabase.from("proc_purchase_requests").select("amount").eq("doc_type", docType).eq("method", method).gte("record_date", from).lte("record_date", to);
      const inYear = (table: "proc_w119_reports" | "proc_urgent_reports" | "proc_expense_claims") =>
        supabase.from(table).select("amount").gte("record_date", from).lte("record_date", to);
      const [purchase, hire, w804, w119, urgent, claims] = await Promise.all([
        pr("ซื้อ", "specific"),
        pr("จ้าง", "specific"),
        pr("ซื้อ", "w804"),
        inYear("proc_w119_reports"),
        inYear("proc_urgent_reports"),
        inYear("proc_expense_claims"),
      ]);
      setYear(fy);
      setStats({
        purchase: sum(purchase.data),
        hire: sum(hire.data),
        w804: sum(w804.data),
        w119: sum(w119.data),
        urgent: sum(urgent.data),
        claims: sum(claims.data),
      });
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">การจัดซื้อจัดจ้าง</h1>
          <p className="page-subtitle">
            งานซื้อ งานจ้าง ว 804 ว 119 กรณีเร่งด่วน และเบิกค่าใช้จ่ายโครงการ{year ? ` · ตัวเลขของปีงบประมาณ ${year}` : ""}
          </p>
        </div>
      </div>

      {stats === null ? (
        <PageLoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => {
            const stat = stats[card.key];
            return (
              <Link key={card.key} href={card.href} className="card block transition hover:border-navy-800/40 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-navy-800/10 p-2.5 text-navy-800">{card.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-900">{card.title}</h2>
                    <p className="mt-0.5 text-sm text-slate-500">{card.description}</p>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-2xl font-bold text-slate-900">{stat.count.toLocaleString("th-TH")}</p>
                  <p className="text-xs text-slate-500">
                    {card.unit} · รวม {formatBaht(stat.total)} บาท
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
