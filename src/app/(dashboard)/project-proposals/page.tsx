"use client";

// Client Component — ต่อจาก /projects, /documents ฯลฯ (ดู /root/.claude/plans) ดึงข้อมูล
// ข้อเสนอโครงการ + สิทธิ์ผู้ใช้ผ่าน browser Supabase client แทนการรอ Server Component fetch
//
// สำคัญ: ใช้ resolveUrls แบบ client เอง (เหมือนหน้า /documents) ไม่ import จากบาร์เรล
// @/lib/storage เพราะดึง google-drive.ts (service account secret) เข้ามาด้วย ไฟล์โครงการใน
// หน้านี้ใช้แค่ Supabase Storage เสมอ (ไม่รองรับ Google Drive) จึงไม่ต้องเช็ค isDriveRef เลย

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/modal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { CheckIcon, ClipboardCheckIcon, LightbulbIcon, PlusIcon } from "@/components/icons";
import { ProposalForm } from "./proposal-form";
import { ProposalsTable } from "./proposals-table";
import {
  approveProposal,
  cancelEndorsement,
  createProposal,
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
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<{ id: string } | null>(null);
  const [adminGroups, setAdminGroups] = useState<Option[]>([]);
  const [budgetSources, setBudgetSources] = useState<Option[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [strategies, setStrategies] = useState<Option[]>([]);
  const [standards, setStandards] = useState<Option[]>([]);
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
          "id, name, proposer_name, created_by, standard, responsible, objectives, strategy_alignment, activities, indicators_quantity, indicators_quality, budget_amount, status, admin_group_id, budget_source_id, file_url_word, file_url_pdf, endorsed_by_name, endorsed_at, endorse_note, approved_by_name, approved_at, approve_note, plan_admin_groups(name), plan_budget_sources(name)",
        )
        .order("created_at", { ascending: false }),
    ]);
    if (error) setError(error.message);

    setCurrentYear(budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null);
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
      .filter((p): p is string => !!p);
    const signedFileUrls = new Map<string, string>();
    if (filePaths.length > 0) {
      const { data: signed } = await supabase.storage.from("procurement-files").createSignedUrls(filePaths, 3600);
      signed?.forEach((s) => {
        if (s.signedUrl && !s.error) signedFileUrls.set(s.path ?? "", s.signedUrl);
      });
    }

    setRows(
      (proposals ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        proposerName: p.proposer_name,
        createdBy: p.created_by,
        adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
        budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
        standard: p.standard,
        adminGroupId: p.admin_group_id,
        budgetSourceId: p.budget_source_id,
        responsible: p.responsible ?? [],
        objectives: (p.objectives as unknown as string[]) ?? [],
        strategyAlignment: p.strategy_alignment,
        fileUrlWord: p.file_url_word ? (signedFileUrls.get(p.file_url_word) ?? null) : null,
        fileUrlPdf: p.file_url_pdf ? (signedFileUrls.get(p.file_url_pdf) ?? null) : null,
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
          <Modal
            title="เสนอโครงการใหม่"
            trigger={
              <>
                <PlusIcon className="h-5 w-5" />
                เสนอโครงการใหม่
              </>
            }
            triggerClassName="btn-gold px-5 py-2.5 text-base shadow-md transition-transform hover:scale-[1.03]"
            closeOnSubmit
            wide
          >
            <ProposalForm
              action={createProposal}
              budgetYearId={currentYear.id}
              adminGroups={adminGroups}
              budgetSources={budgetSources}
              teachers={teachers}
              strategies={strategies}
              standards={standards}
              onSuccess={reload}
            />
          </Modal>
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

      <div className="card mb-4 flex items-start gap-3 bg-navy-950/[0.03]">
        <LightbulbIcon className="h-5 w-5 shrink-0 text-navy-700" />
        <p className="text-sm text-slate-600">
          ข้อเสนอโครงการต้องผ่าน 2 ขั้นตอน: <strong>ผู้เห็นชอบ</strong> (เช่น รองผู้อำนวยการ) แล้วจึงส่งต่อให้
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
        />
      </div>
    </div>
  );
}
