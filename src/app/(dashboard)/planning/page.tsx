"use client";

// หน้ารวม "จัดทำแผน" — การ์ด การจัดสรรเงิน / เสนอโครงการ พร้อมตัวเลขของปีงบประมาณที่เปิดใช้งาน

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { LightbulbIcon, PieChartIcon } from "@/components/icons";
import { HubCardGrid, pickBudgetYear } from "@/components/hub-cards";

const ICON = "h-6 w-6";
const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Stats = { year: number | null; drafts: number; draftBudget: number; proposals: number; approved: number; pending: number };

export default function PlanningHubPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: years } = await supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false });
      const year = pickBudgetYear(years);
      const yid = year?.id ?? "";
      const [{ data: drafts }, { data: proposals }] = await Promise.all([
        supabase.from("plan_draft_projects").select("budget").eq("budget_year_id", yid),
        supabase.from("plan_project_proposals").select("status").eq("budget_year_id", yid),
      ]);
      const p = proposals ?? [];
      setStats({
        year: year?.year ?? null,
        drafts: drafts?.length ?? 0,
        draftBudget: (drafts ?? []).reduce((s, d) => s + Number(d.budget ?? 0), 0),
        proposals: p.length,
        approved: p.filter((x) => x.status === "อนุมัติแล้ว").length,
        pending: p.filter((x) => x.status === "รอเห็นชอบ" || x.status === "รออนุมัติ").length,
      });
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">จัดทำแผน</h1>
          <p className="page-subtitle">การจัดสรรเงินและเสนอโครงการ{stats?.year ? ` · ตัวเลขของปีงบประมาณ ${stats.year}` : ""}</p>
        </div>
      </div>
      {stats === null ? (
        <PageLoadingSkeleton />
      ) : (
        <HubCardGrid
          cards={[
            {
              key: "fund",
              title: "การจัดสรรเงิน",
              description: "ประมาณการรายรับ จัดสรรงบประมาณ และร่างโครงการของปีงบประมาณ",
              href: "/fund-allocation",
              icon: <PieChartIcon className={ICON} />,
              value: stats.drafts.toLocaleString("th-TH"),
              sub: `ร่างโครงการ · รวม ${baht(stats.draftBudget)} บาท`,
            },
            {
              key: "proposals",
              title: "เสนอโครงการ",
              description: "เขียนข้อเสนอโครงการ เสนอเห็นชอบและอนุมัติ",
              href: "/project-proposals",
              icon: <LightbulbIcon className={ICON} />,
              value: stats.proposals.toLocaleString("th-TH"),
              sub: `ข้อเสนอโครงการ · อนุมัติแล้ว ${stats.approved} · รอพิจารณา ${stats.pending}`,
            },
          ]}
        />
      )}
    </div>
  );
}
