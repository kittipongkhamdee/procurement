"use client";

// หน้ารวม "รายงานโครงการ" — การ์ด รายงานโครงการ / ประเมินความพึงพอใจ พร้อมตัวเลขของปีงบประมาณที่เปิดใช้งาน

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ClipboardCheckIcon, FileTextIcon } from "@/components/icons";
import { HubCardGrid, pickBudgetYear } from "@/components/hub-cards";

const ICON = "h-6 w-6";

type Stats = { year: number | null; projects: number; reported: number; forms: number; published: number };

export default function ReportsHubPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: years } = await supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false });
      const year = pickBudgetYear(years);
      const { data: projects } = await supabase.from("plan_projects").select("id").eq("budget_year_id", year?.id ?? "");
      const ids = (projects ?? []).map((p) => p.id);
      const [{ data: reports }, { data: forms }] = ids.length
        ? await Promise.all([
            supabase.from("proc_project_reports").select("project_id").in("project_id", ids),
            supabase.from("eval_forms").select("status").eq("is_template", false).in("project_id", ids),
          ])
        : [{ data: [] }, { data: [] }];
      setStats({
        year: year?.year ?? null,
        projects: ids.length,
        reported: new Set((reports ?? []).map((r) => r.project_id)).size,
        forms: forms?.length ?? 0,
        published: (forms ?? []).filter((f) => f.status === "published").length,
      });
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">รายงานโครงการ</h1>
          <p className="page-subtitle">รายงานผลการดำเนินโครงการและประเมินความพึงพอใจ{stats?.year ? ` · ตัวเลขของปีงบประมาณ ${stats.year}` : ""}</p>
        </div>
      </div>
      {stats === null ? (
        <PageLoadingSkeleton />
      ) : (
        <HubCardGrid
          cards={[
            {
              key: "reports",
              title: "รายงานโครงการ",
              description: "ส่งรายงานผลการดำเนินโครงการ/กิจกรรม",
              href: "/project-reports",
              icon: <FileTextIcon className={ICON} />,
              value: `${stats.reported.toLocaleString("th-TH")} / ${stats.projects.toLocaleString("th-TH")}`,
              sub: `โครงการที่รายงานแล้ว · ค้างรายงาน ${Math.max(stats.projects - stats.reported, 0)}`,
            },
            {
              key: "evaluations",
              title: "ประเมินความพึงพอใจ",
              description: "สร้างแบบประเมินความพึงพอใจ เปิดรับคำตอบ และดูผล",
              href: "/evaluations",
              icon: <ClipboardCheckIcon className={ICON} />,
              value: stats.forms.toLocaleString("th-TH"),
              sub: `แบบประเมินของโครงการปีนี้ · เปิดรับคำตอบอยู่ ${stats.published}`,
            },
          ]}
        />
      )}
    </div>
  );
}
