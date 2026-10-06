"use client";

// Client Component — หน้าสุดท้ายในการแปลงเฟส 2 (ดู /root/.claude/plans) ดึงรายงานโครงการผ่าน
// browser Supabase client แทนการรอ Server Component fetch — mutation ทั้งหมดยังคงเป็น server
// action เดิม ไม่แตะ
//
// หน้าเสนอ/แก้ไขรายงานย้ายไปเป็นเต็มหน้า (/project-reports/new, /project-reports/[id]/edit)
// แทน popup เดิม เพราะฟอร์มยาวหลายส่วนทำให้ popup อึดอัด — หน้านี้เหลือแค่รายการ+ลิงก์ไปหน้าเหล่านั้น

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { FileTextIcon, PencilIcon, PrinterIcon, WordFileIcon } from "@/components/icons";
import { DeleteReportButton } from "./delete-report-button";
import { sortProjectsByGroup } from "./project-select";
import { deleteProjectReport } from "./actions";

type YearProject = { id: string; name: string; adminGroup: string | null; adminGroupOrder: number };

type Report = {
  id: string;
  project_id: string | null;
  uploaded_by: string | null;
  file_url: string | null;
  photo_refs: string[] | null;
  created_at: string;
  not_implemented: boolean;
  responsible_name: string | null;
  plan_projects: { name: string; plan_admin_groups: { name: string; sort_order: number | null } | null } | null;
};

const BRAND = "#123361";
const GOOD = "#059669";
const WARN = "#d97706";

export default function ProjectReportsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  // โครงการทั้งหมดของปีงบประมาณปัจจุบัน (ปีที่เปิดใช้งาน ไม่มีก็ใช้ปีล่าสุด เหมือนหน้าแดชบอร์ด) ไว้นับ
  // "รายงานแล้ว/ยังไม่รายงาน" และแสดงรายชื่อที่ยังไม่รายงาน — null = ยังโหลดไม่เสร็จหรือยังไม่มีปีงบประมาณ
  const [yearProjects, setYearProjects] = useState<YearProject[] | null>(null);
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();

    const { data: reportsData, error } = await supabase
      .from("proc_project_reports")
      .select(
        "id, project_id, uploaded_by, file_url, photo_refs, created_at, not_implemented, responsible_name, plan_projects(name, plan_admin_groups(name, sort_order))",
      )
      .order("created_at", { ascending: false });
    if (error) setError(error.message);

    // เรียงตามลำดับกลุ่มบริหารงานของโครงการ (เหมือนหน้า "โครงการ") คงลำดับเดิม (ใหม่สุดก่อน) ภายในกลุ่ม
    // — Array.sort เสถียร; รายงานที่ไม่มีกลุ่มอยู่ท้ายสุด
    const rows = ((reportsData as unknown as Report[]) ?? []).sort(
      (a, b) =>
        (a.plan_projects?.plan_admin_groups?.sort_order ?? Number.MAX_SAFE_INTEGER) -
        (b.plan_projects?.plan_admin_groups?.sort_order ?? Number.MAX_SAFE_INTEGER),
    );
    setReports(rows);

    const { data: budgetYears } = await supabase
      .from("plan_budget_years")
      .select("id, is_open")
      .order("year", { ascending: false });
    const year = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;
    if (year) {
      const { data: projectRows } = await supabase
        .from("plan_projects")
        .select("id, name, plan_admin_groups(name, sort_order)")
        .eq("budget_year_id", year.id)
        .order("sort_order");
      setYearProjects(
        sortProjectsByGroup(
          (projectRows ?? []).map((p) => {
            const group = p.plan_admin_groups as unknown as { name: string; sort_order: number | null } | null;
            return { id: p.id, name: p.name, adminGroup: group?.name ?? null, adminGroupOrder: group?.sort_order ?? 0 };
          }),
        ),
      );
    } else {
      setYearProjects(null);
    }

    const paths = rows.map((r) => r.file_url).filter((p): p is string => !!p);
    const { data: fileUrlsMap } =
      paths.length > 0
        ? await supabase.storage.from("procurement-files").createSignedUrls(paths, 3600)
        : { data: [] };
    const fileMap = new Map<string, string>();
    fileUrlsMap?.forEach((s) => {
      if (s.signedUrl && !s.error) fileMap.set(s.path ?? "", s.signedUrl);
    });
    setSignedUrls(fileMap);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (reports === null || authLoading) return <PageLoadingSkeleton />;

  // การ์ดมือถือใช้ลิงก์ตัวหนังสือธรรมดา (asButton=false) ส่วนตารางจอกว้างแสดงเป็นปุ่มแทน
  // (asButton=true) ให้กดง่ายและแยกจากข้อความอื่นในแถวชัดเจนขึ้น
  function fileLink(r: Report, asButton = false) {
    const cls = asButton
      ? "btn-secondary btn-sm whitespace-nowrap"
      : "inline-flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline";
    if (r.file_url) {
      return signedUrls.get(r.file_url) ? (
        <a href={signedUrls.get(r.file_url)} target="_blank" className={cls}>
          <FileTextIcon className="h-3.5 w-3.5" />
          เปิดไฟล์
        </a>
      ) : (
        <span className="text-xs text-slate-400">ไม่พบไฟล์</span>
      );
    }
    return (
      <a href={`/project-reports/${r.id}/pdf`} target="_blank" className={cls}>
        <PrinterIcon className="h-3.5 w-3.5" />
        {asButton ? "PDF" : "ดู/พิมพ์ PDF"}
      </a>
    );
  }

  // ปุ่มดาวน์โหลด Word ใช้ได้เฉพาะรายงานที่กรอกผ่านฟอร์ม (สร้างเอกสารจากข้อมูลในระบบ) — รายงานที่
  // อัปโหลดไฟล์ของตัวเองมา (r.file_url) ไม่มีข้อมูลให้สร้างเอกสาร Word ใหม่
  function wordLink(r: Report, asButton = false) {
    if (r.file_url) return null;
    const cls = asButton
      ? "btn-secondary btn-sm whitespace-nowrap"
      : "inline-flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline";
    return (
      <a href={`/project-reports/${r.id}/word`} className={cls}>
        <WordFileIcon className="h-3.5 w-3.5" />
        {asButton ? "Word" : "ดาวน์โหลด Word"}
      </a>
    );
  }

  // โครงการที่ส่งรายงานแล้วนับรวมรายงานแบบ "ไม่ได้ดำเนินการ" ด้วย (ถือว่าได้รายงานสถานะแล้ว)
  const reportedProjectIds = new Set(reports.map((r) => r.project_id).filter((id): id is string => !!id));
  const totalProjects = yearProjects?.length ?? 0;
  const unreportedProjects = (yearProjects ?? []).filter((p) => !reportedProjectIds.has(p.id));
  const unreportedCount = unreportedProjects.length;

  const searchTerm = search.trim().toLowerCase();
  const filteredReports = searchTerm
    ? reports.filter((r) =>
        [r.plan_projects?.name, r.responsible_name, r.plan_projects?.plan_admin_groups?.name].some((v) => v?.toLowerCase().includes(searchTerm)),
      )
    : reports;
  const groupOf = (r: Report) => r.plan_projects?.plan_admin_groups?.name ?? "ไม่ระบุกลุ่ม";
  const groupCounts = new Map<string, number>();
  for (const r of filteredReports) groupCounts.set(groupOf(r), (groupCounts.get(groupOf(r)) ?? 0) + 1);
  // จำนวนโครงการที่ยังไม่รายงานต่อกลุ่ม (ปีงบประมาณปัจจุบัน) ไว้แสดง "เหลือ X" ที่หัวกลุ่ม — ไม่ขึ้นกับคำค้นหา
  const remainingByGroup = new Map<string, number>();
  for (const p of unreportedProjects) {
    const g = p.adminGroup ?? "ไม่ระบุกลุ่ม";
    remainingByGroup.set(g, (remainingByGroup.get(g) ?? 0) + 1);
  }
  const renderGroupHeader = (name: string) => {
    const remaining = remainingByGroup.get(name) ?? 0;
    return (
      <>
        {name}{" "}
        <span className="font-normal text-slate-500">
          ({(groupCounts.get(name) ?? 0).toLocaleString("th-TH")} รายงาน)
        </span>{" "}
        {remaining > 0 ? (
          <span className="ml-1 text-amber-700">เหลือ {remaining.toLocaleString("th-TH")}</span>
        ) : (
          <span className="ml-1 text-emerald-700">ครบแล้ว</span>
        )}
      </>
    );
  };
  const emptyMessage = reports.length === 0 ? "ยังไม่มีข้อมูล" : "ไม่พบรายการที่ค้นหา";
  const reportedCount = totalProjects - unreportedCount;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ระบบรายงานโครงการ</h1>
          <p className="page-subtitle">สรุปผลการดำเนินงานหลังปิดโครงการ พร้อมออกรายงาน PDF และ Word</p>
        </div>
        <Link href="/project-reports/new" className="btn-primary">
          + รายงานโครงการใหม่
        </Link>
      </div>

      {yearProjects !== null && (
        <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="stat-card" style={{ "--accent": BRAND } as React.CSSProperties}>
            <div className="stat-label">จำนวนโครงการ</div>
            <div className="stat-value">
              {totalProjects.toLocaleString("th-TH")} <span className="stat-suffix hidden sm:inline">โครงการ</span>
            </div>
          </div>
          <div className="stat-card" style={{ "--accent": GOOD } as React.CSSProperties}>
            <div className="stat-label">รายงานแล้ว</div>
            <div className="stat-value text-emerald-600">
              {reportedCount.toLocaleString("th-TH")} <span className="stat-suffix hidden sm:inline">โครงการ</span>
            </div>
          </div>
          {/* วางเมาส์ (คอม) หรือแตะการ์ด (มือถือ/แท็บเล็ต — tabIndex ทำให้แตะแล้วได้ focus) เพื่อดูรายชื่อ */}
          <div className="group relative">
            <div
              tabIndex={unreportedCount > 0 ? 0 : undefined}
              className={`stat-card h-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                unreportedCount > 0 ? "cursor-pointer transition group-hover:border-amber-300 group-hover:shadow-md" : ""
              }`}
              style={{ "--accent": WARN } as React.CSSProperties}
            >
              <div className="stat-label">ยังไม่รายงาน</div>
              <div className="stat-value text-amber-600">
                {unreportedCount.toLocaleString("th-TH")} <span className="stat-suffix hidden sm:inline">โครงการ</span>
              </div>
              {unreportedCount > 0 && (
                <p className="mt-1 text-xs font-medium text-amber-700">
                  ดูรายชื่อ <span aria-hidden>▾</span>
                </p>
              )}
            </div>
            {unreportedCount > 0 && (
              <div className="absolute right-0 top-full z-20 hidden pt-2 group-focus-within:block group-hover:block">
                <div className="max-h-72 w-80 max-w-[85vw] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                    โครงการที่ยังไม่รายงาน ({unreportedCount.toLocaleString("th-TH")})
                  </p>
                  <ol>
                    {unreportedProjects.map((p, i) => (
                      <li key={p.id} className="flex gap-2 px-3 py-1.5 text-sm">
                        <span className="w-5 shrink-0 text-right text-xs tabular-nums leading-5 text-slate-400">
                          {i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-slate-900">{p.name}</span>
                          {p.adminGroup && <span className="block text-xs text-slate-500">{p.adminGroup}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อโครงการ / ผู้รับผิดชอบ / กลุ่มบริหาร..."
          aria-label="ค้นหารายงานโครงการ"
          className="input w-full sm:max-w-sm"
        />
        {searchTerm && (
          <span className="text-sm text-slate-500">
            พบ {filteredReports.length.toLocaleString("th-TH")} จาก {reports.length.toLocaleString("th-TH")} รายการ
          </span>
        )}
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

        {/* มือถือ/จอแคบกว่า md: การ์ดแสดงรายการ (ชื่อโครงการขึ้นบรรทัดเต็มความกว้าง ไม่บีบเป็นคอลัมน์แคบ) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredReports.map((r, i) => {
            const canManage = isAdmin || (user && r.uploaded_by === user.userId);
            const photoRefs = r.photo_refs ?? [];
            const showGroupHeader = i === 0 || groupOf(filteredReports[i - 1]) !== groupOf(r);
            return (
              <Fragment key={r.id}>
                {showGroupHeader && (
                  <div className="bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    {renderGroupHeader(groupOf(r))}
                  </div>
                )}
              <div className="flex items-start gap-2 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-xs tabular-nums text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{r.plan_projects?.name ?? "-"}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span>{formatThaiDate(r.created_at)}</span>
                    {r.responsible_name && <span>ผู้รับผิดชอบ: {r.responsible_name}</span>}
                    {r.not_implemented && <span className="badge-red">ไม่ได้ดำเนินการ</span>}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {fileLink(r)}
                    {wordLink(r)}
                    {canManage && (
                      <>
                        <Link
                          href={`/project-reports/${r.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-navy-800 hover:underline"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          แก้ไข
                        </Link>
                        <DeleteReportButton
                          id={r.id}
                          fileUrl={r.file_url}
                          photoRefs={photoRefs}
                          projectName={r.plan_projects?.name ?? "โครงการนี้"}
                          action={deleteProjectReport}
                          onChanged={reload}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
              </Fragment>
            );
          })}
          {filteredReports.length === 0 && <p className="table-empty">{emptyMessage}</p>}
        </div>

        {/* จอกว้าง md ขึ้นไป: ตาราง */}
        <table className="hidden table-base md:table">
          <thead>
            <tr>
              <th className="w-10 text-center">#</th>
              <th>ชื่อโครงการ</th>
              <th className="whitespace-nowrap">ผู้รับผิดชอบโครงการ</th>
              <th className="whitespace-nowrap">วันที่รายงาน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r, i) => {
              const canManage = isAdmin || (user && r.uploaded_by === user.userId);
              const photoRefs = r.photo_refs ?? [];
              const showGroupHeader = i === 0 || groupOf(filteredReports[i - 1]) !== groupOf(r);
              return (
                <Fragment key={r.id}>
                {showGroupHeader && (
                  <tr className="bg-slate-100">
                    <td colSpan={5} className="py-2 font-semibold text-slate-700">
                      {renderGroupHeader(groupOf(r))}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                  <td className="max-w-xs whitespace-normal break-words font-medium text-slate-900">
                    {r.plan_projects?.name ?? "-"}
                    {r.not_implemented && <span className="badge-red ml-2">ไม่ได้ดำเนินการ</span>}
                  </td>
                  <td>{r.responsible_name ?? "-"}</td>
                  <td className="whitespace-nowrap">{formatThaiDate(r.created_at)}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {fileLink(r, true)}
                      {wordLink(r, true)}
                      {canManage && (
                        <>
                          <Link href={`/project-reports/${r.id}/edit`} className="btn-secondary btn-sm whitespace-nowrap">
                            <PencilIcon className="h-3.5 w-3.5" />
                            แก้ไข
                          </Link>
                          <DeleteReportButton
                            id={r.id}
                            fileUrl={r.file_url}
                            photoRefs={photoRefs}
                            projectName={r.plan_projects?.name ?? "โครงการนี้"}
                            action={deleteProjectReport}
                            onChanged={reload}
                            asButton
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                </Fragment>
              );
            })}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
