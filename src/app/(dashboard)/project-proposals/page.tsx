"use client";

// Client Component — ต่อจาก /projects, /documents ฯลฯ (ดู /root/.claude/plans) ดึงข้อมูล
// ข้อเสนอโครงการ + สิทธิ์ผู้ใช้ผ่าน browser Supabase client แทนการรอ Server Component fetch
//
// สำคัญ: ใช้ resolveUrls แบบ client เอง (เหมือนหน้า /documents) ไม่ import จากบาร์เรล
// @/lib/storage เพราะดึง google-drive.ts (service account secret) เข้ามาด้วย — import เฉพาะ
// @/lib/storage/ref (pure function) ไฟล์ที่เก็บบน Google Drive (gdrive:{id}) เปิดผ่านลิงก์ดูไฟล์ของ Drive

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { isDriveRef, resolveEmbedUrl, resolveFileUrl } from "@/lib/storage/ref";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { CheckIcon, ClipboardCheckIcon, LightbulbIcon, PlusIcon } from "@/components/icons";
import { ProposalsTable } from "./proposals-table";
import {
  approveProposal,
  cancelEndorsement,
  deleteProposal,
  deleteProposalFile,
  endorseProposal,
  resetProposalStatus,
  updateProposal,
} from "./actions";

type Option = { id: string; name: string };
type Teacher = { id: string; name: string; is_active: boolean };
type ActivityRow = { name: string; responsible: string[]; budget: number };
type IndicatorRow = { indicator: string; target: string };
type ProposalRow = {
  id: string;
  name: string;
  proposerName: string | null;
  createdBy: string | null;
  adminGroup: string;
  adminGroupId: string | null;
  budgetSource: string;
  budgetSourceId: string | null;
  standard: string | null;
  responsible: string[];
  objectives: string[];
  strategyAlignment: string | null;
  fileUrlWord: string | null;
  fileUrlPdf: string | null;
  /** URL สำหรับฝังดูตัวอย่าง (iframe) — ไฟล์ Google Drive ใช้หน้า /preview */
  fileUrlPdfPreview: string | null;
  /** ลำดับกลุ่มบริหารงาน (sort_order ของกลุ่ม) ไว้เรียง/จัดกลุ่มในตาราง */
  adminGroupOrder: number;
  budgetYearId: string | null;
  draftProjectId: string | null;
  fileUrlWordPath: string | null;
  fileUrlPdfPath: string | null;
  activities: ActivityRow[];
  indicatorsQuantity: IndicatorRow[];
  indicatorsQuality: IndicatorRow[];
  budgetAmount: number;
  status: string;
  endorsedByName: string | null;
  endorsedAt: string | null;
  endorseNote: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approveNote: string | null;
};

export default function ProjectProposalsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  // ลิงก์ลัดจากหน้า "ผู้บริหาร" (/project-proposals?open=<id>) — เปิดป็อปอัปรายละเอียดของรายการนี้
  // อัตโนมัติให้เลย ไม่ต้องไล่หาในตาราง
  const autoOpenId = useSearchParams().get("open");
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<{ id: string; year: number } | null>(null);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [strategies, setStrategies] = useState<Option[]>([]);
  const [standards, setStandards] = useState<Option[]>([]);
  // ร่างโครงการของปีงบประมาณปัจจุบัน ไว้นับว่าเสนอแล้วกี่รายการ (นับจากการผูกด้วย id หรือชื่อตรงกัน)
  const [drafts, setDrafts] = useState<{ id: string; name: string; adminGroup: string }[]>([]);
  const [canEndorse, setCanEndorse] = useState(false);
  const [canApprove, setCanApprove] = useState(false);

  const reload = useCallback(async () => {
    if (authLoading) return;
    const supabase = createClient();

    const [
      { data: budgetYears },
      { data: adminGroupsData },
      { data: budgetSourcesData },
      { data: teachersData },
      { data: strategiesData },
      { data: standardsData },
      { data: proposals, error },
    ] = await Promise.all([
      supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false }),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("plan_strategies").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_standards").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase
        .from("plan_project_proposals")
        .select(
          "id, name, proposer_name, created_by, budget_year_id, draft_project_id, standard, responsible, objectives, strategy_alignment, activities, indicators_quantity, indicators_quality, budget_amount, status, admin_group_id, budget_source_id, file_url_word, file_url_pdf, endorsed_by_name, endorsed_at, endorse_note, approved_by_name, approved_at, approve_note, plan_admin_groups(name, sort_order), plan_budget_sources(name)",
        )
        .order("created_at", { ascending: false }),
    ]);
    if (error) setError(error.message);

    const year = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;
    setCurrentYear(year);
    if (year) {
      const { data: draftRows } = await supabase
        .from("plan_draft_projects")
        .select("id, name, plan_admin_groups(name, sort_order)")
        .eq("budget_year_id", year.id)
        .order("sort_order")
        .order("created_at");
      setDrafts(
        (draftRows ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          adminGroup: (d.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
        })),
      );
    } else {
      setDrafts([]);
    }
    setAdminGroups(adminGroupsData ?? []);
    setBudgetSources(budgetSourcesData ?? []);
    setTeachers(teachersData ?? []);
    setStrategies(strategiesData ?? []);
    setStandards(standardsData ?? []);

    let myCanEndorse = isAdmin;
    let myCanApprove = isAdmin;
    if (user) {
      const { data: myGroups } = await supabase
        .from("proc_user_group_members")
        .select("proc_user_groups(name)")
        .eq("user_id", user.userId);
      const myGroupNames = new Set(
        (myGroups ?? [])
          .map((g) => (g.proc_user_groups as unknown as { name: string } | null)?.name)
          .filter((n): n is string => !!n),
      );
      myCanEndorse = isAdmin || myGroupNames.has("รองผู้อำนวยการ");
      myCanApprove = isAdmin || myGroupNames.has("ผู้อำนวยการ");
    }
    setCanEndorse(myCanEndorse);
    setCanApprove(myCanApprove);

    const filePaths = (proposals ?? [])
      .flatMap((p) => [p.file_url_word, p.file_url_pdf])
      .filter((p): p is string => !!p && !isDriveRef(p));
    const signedFileUrls = new Map<string, string>();
    if (filePaths.length > 0) {
      const { data: signed } = await supabase.storage.from("procurement-files").createSignedUrls(filePaths, 3600);
      signed?.forEach((s) => {
        if (s.signedUrl && !s.error) signedFileUrls.set(s.path ?? "", s.signedUrl);
      });
    }

    // ชื่อผู้เสนอใช้ชื่อปัจจุบันในโปรไฟล์ (proposer_name เป็นแค่สำเนาตอนสร้าง — ใช้สำรองเมื่อหาโปรไฟล์ไม่เจอ)
    const creatorIds = Array.from(new Set((proposals ?? []).map((p) => p.created_by).filter((id): id is string => !!id)));
    const currentNames = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from("proc_profiles").select("user_id, full_name").in("user_id", creatorIds);
      creators?.forEach((c) => {
        if (c.full_name) currentNames.set(c.user_id, c.full_name);
      });
    }

    setRows(
      (proposals ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        proposerName: (p.created_by ? currentNames.get(p.created_by) : undefined) ?? p.proposer_name,
        createdBy: p.created_by,
        budgetYearId: p.budget_year_id,
        draftProjectId: p.draft_project_id,
        adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
        adminGroupOrder:
          (p.plan_admin_groups as unknown as { sort_order: number | null } | null)?.sort_order ?? Number.MAX_SAFE_INTEGER,
        budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
        standard: p.standard,
        adminGroupId: p.admin_group_id,
        budgetSourceId: p.budget_source_id,
        responsible: p.responsible ?? [],
        objectives: (p.objectives as unknown as string[]) ?? [],
        strategyAlignment: p.strategy_alignment,
        fileUrlWord: resolveFileUrl(p.file_url_word, signedFileUrls),
        fileUrlPdf: resolveFileUrl(p.file_url_pdf, signedFileUrls),
        fileUrlPdfPreview: resolveEmbedUrl(p.file_url_pdf, signedFileUrls),
        fileUrlWordPath: p.file_url_word,
        fileUrlPdfPath: p.file_url_pdf,
        activities: (p.activities as unknown as ActivityRow[]) ?? [],
        indicatorsQuantity: (p.indicators_quantity as unknown as IndicatorRow[]) ?? [],
        indicatorsQuality: (p.indicators_quality as unknown as IndicatorRow[]) ?? [],
        budgetAmount: Number(p.budget_amount ?? 0),
        status: p.status,
        endorsedByName: p.endorsed_by_name,
        endorsedAt: p.endorsed_at,
        endorseNote: p.endorse_note,
        approvedByName: p.approved_by_name,
        approvedAt: p.approved_at,
        approveNote: p.approve_note,
      })),
    );
  }, [authLoading, isAdmin, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (rows === null || authLoading) return <PageLoadingSkeleton />;

  const isApproverOnly = !isAdmin && (canEndorse || canApprove);
  /** ผู้อำนวยการ (ไม่ใช่แอดมินและไม่ใช่รองผู้อำนวยการ) ยังไม่ควรเห็น/เปิดอ่านโครงการที่รองผู้อำนวยการยังไม่เห็นชอบ */
  const isDirectorOnly = !isAdmin && canApprove && !canEndorse;

  const visibleRows = isDirectorOnly
    ? rows.filter((r) => r.status !== "รอเห็นชอบ" || r.createdBy === user?.userId)
    : rows;

  const pendingEndorseCount = rows.filter((r) => r.status === "รอเห็นชอบ").length;
  const pendingApproveCount = rows.filter((r) => r.status === "รออนุมัติ").length;
  const approvedCount = rows.filter((r) => r.status === "อนุมัติแล้ว").length;

  // สรุป "เสนอโครงการแล้วจากร่างโครงการ" ของปีงบประมาณปัจจุบัน
  const normName = (n: string) => n.trim().replace(/\s+/g, " ").toLowerCase();
  const yearRows = rows.filter((r) => r.budgetYearId === currentYear?.id);
  const linkedDraftIds = new Set(yearRows.map((r) => r.draftProjectId).filter((id): id is string => !!id));
  const yearNameKeys = new Set(yearRows.map((r) => normName(r.name)));
  const draftNameKeys = new Set(drafts.map((d) => normName(d.name)));
  const isDraftProposed = (d: { id: string; name: string }) => linkedDraftIds.has(d.id) || yearNameKeys.has(normName(d.name));
  const unproposedDrafts = drafts.filter((d) => !isDraftProposed(d));
  const proposedDraftCount = drafts.length - unproposedDrafts.length;
  // ข้อเสนอที่ครูพิมพ์ชื่อเอง ไม่ได้ผูกหรือชื่อไม่ตรงกับร่างโครงการใดเลย
  const selfTypedCount = yearRows.filter((r) => !r.draftProjectId && !draftNameKeys.has(normName(r.name))).length;
  const draftSummaryByGroup: Record<string, { total: number; proposed: number }> = {};
  for (const d of drafts) {
    const g = (draftSummaryByGroup[d.adminGroup] ??= { total: 0, proposed: 0 });
    g.total += 1;
    if (isDraftProposed(d)) g.proposed += 1;
  }
  const proposedPct = drafts.length > 0 ? (proposedDraftCount / drafts.length) * 100 : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">เสนอโครงการ</h1>
          <p className="page-subtitle">
            {isApproverOnly
              ? "รายการข้อเสนอโครงการที่ครูเสนอเข้ามา เพื่อพิจารณาเห็นชอบ/อนุมัติ"
              : "เขียนข้อเสนอโครงการตามแบบฟอร์มของโรงเรียน เพื่อเสนอเห็นชอบและอนุมัติ"}
          </p>
        </div>
        {currentYear && !isApproverOnly && (
          <Link
            href="/project-proposals/new"
            className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-base shadow-md transition-transform hover:scale-[1.03]"
          >
            <PlusIcon className="h-5 w-5" />
            เสนอโครงการใหม่
          </Link>
        )}
      </div>

      {(canEndorse || canApprove) && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="stat-card" style={{ "--accent": "#b45309" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#b45309" }}>
                <ClipboardCheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">รอเห็นชอบ</div>
                <div className="stat-value">
                  {pendingEndorseCount.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
                </div>
              </div>
            </div>
          </div>
          <div className="stat-card" style={{ "--accent": "#1b4177" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#1b4177" }}>
                <ClipboardCheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">รออนุมัติ</div>
                <div className="stat-value">
                  {pendingApproveCount.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
                </div>
              </div>
            </div>
          </div>
          <div className="stat-card" style={{ "--accent": "#059669" } as React.CSSProperties}>
            <div className="flex items-start gap-3">
              <span className="stat-icon" style={{ background: "#059669" }}>
                <CheckIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="stat-label">อนุมัติแล้ว</div>
                <div className="stat-value">
                  {approvedCount.toLocaleString("th-TH")} <span className="stat-suffix">โครงการ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="group relative mb-4">
          <div
            tabIndex={unproposedDrafts.length > 0 ? 0 : undefined}
            className={`stat-card outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              unproposedDrafts.length > 0 ? "cursor-pointer transition group-hover:border-amber-300 group-hover:shadow-md" : ""
            }`}
            style={{ "--accent": unproposedDrafts.length > 0 ? "#d97706" : "#059669" } as React.CSSProperties}
          >
            <div className="stat-label">เสนอโครงการแล้วจากร่างโครงการ (ปี {currentYear?.year})</div>
            <div className="stat-value">
              {proposedDraftCount.toLocaleString("th-TH")}{" "}
              <span className="stat-suffix">จาก {drafts.length.toLocaleString("th-TH")} ร่างโครงการ</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${proposedPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {unproposedDrafts.length > 0 ? (
                <span className="font-medium text-amber-700">
                  ยังไม่ได้เสนอ {unproposedDrafts.length.toLocaleString("th-TH")} โครงการ — ดูรายชื่อ <span aria-hidden>▾</span>
                </span>
              ) : (
                <span className="font-medium text-emerald-700">เสนอครบทุกร่างโครงการแล้ว</span>
              )}
              {selfTypedCount > 0 && (
                <span> · มีข้อเสนอที่พิมพ์ชื่อเอง (ไม่ตรงกับร่างโครงการใด) {selfTypedCount.toLocaleString("th-TH")} รายการ</span>
              )}
            </p>
          </div>
          {unproposedDrafts.length > 0 && (
            <div className="absolute left-0 top-full z-20 hidden pt-2 group-focus-within:block group-hover:block">
              <div className="max-h-72 w-96 max-w-[90vw] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                  ร่างโครงการที่ยังไม่ได้เสนอ ({unproposedDrafts.length.toLocaleString("th-TH")})
                </p>
                <ol>
                  {unproposedDrafts.map((d, i) => (
                    <li key={d.id} className="flex gap-2 px-3 py-1.5 text-sm">
                      <span className="w-5 shrink-0 text-right text-xs tabular-nums leading-5 text-slate-400">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-slate-900">{d.name}</span>
                        <span className="block text-xs text-slate-500">{d.adminGroup}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card mb-4 flex items-start gap-3 bg-navy-950/[0.03]">
        <LightbulbIcon className="h-5 w-5 shrink-0 text-navy-700" />
        <p className="text-sm text-slate-600">
          ข้อเสนอโครงการต้องผ่าน 2 ขั้นตอน: <strong>ผู้เห็นชอบ</strong> (รองผู้อำนวยการ) แล้วจึงส่งต่อให้
          <strong> ผู้อนุมัติ</strong> (ผู้อำนวยการ) เมื่ออนุมัติแล้ว ระบบจะบันทึกเป็นโครงการจริงในเมนู
          &quot;โครงการ&quot; ให้อัตโนมัติ
        </p>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
        <ProposalsTable
          rows={visibleRows}
          isAdmin={isAdmin}
          canEndorse={canEndorse}
          canApprove={canApprove}
          currentUserId={user?.userId ?? null}
          draftSummaryByGroup={draftSummaryByGroup}
          adminGroups={adminGroups}
          budgetSources={budgetSources}
          teachers={teachers}
          strategies={strategies}
          standards={standards}
          endorseProposal={endorseProposal}
          cancelEndorsement={cancelEndorsement}
          approveProposal={approveProposal}
          resetProposalStatus={resetProposalStatus}
          deleteProposal={deleteProposal}
          deleteProposalFile={deleteProposalFile}
          updateProposal={updateProposal}
          onChanged={reload}
          autoOpenId={autoOpenId}
        />
      </div>
    </div>
  );
}
