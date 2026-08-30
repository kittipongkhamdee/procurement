import { createClient } from "@/lib/supabase/server";
import { Modal } from "@/components/modal";
import { CheckIcon, ClipboardCheckIcon, LightbulbIcon } from "@/components/icons";
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

export default async function ProjectProposalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const isAdmin = myProfile?.role === "admin";

  const { data: myGroups } = await supabase
    .from("proc_user_group_members")
    .select("proc_user_groups(name)")
    .eq("user_id", user?.id ?? "");
  const myGroupNames = new Set(
    (myGroups ?? [])
      .map((g) => (g.proc_user_groups as unknown as { name: string } | null)?.name)
      .filter((n): n is string => !!n),
  );
  const canEndorse = isAdmin || myGroupNames.has("รองผู้อำนวยการ");
  const canApprove = isAdmin || myGroupNames.has("ผู้อำนวยการ");
  const isApproverOnly = !isAdmin && (canEndorse || canApprove);
  /** ผู้อำนวยการ (ไม่ใช่แอดมินและไม่ใช่รองผู้อำนวยการ) ยังไม่ควรเห็น/เปิดอ่านโครงการที่รองผู้อำนวยการยังไม่เห็นชอบ */
  const isDirectorOnly = !isAdmin && canApprove && !canEndorse;

  const { data: budgetYears } = await supabase
    .from("plan_budget_years")
    .select("id, year, is_open")
    .order("year", { ascending: false });
  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];

  const [{ data: adminGroups }, { data: budgetSources }, { data: teachers }, { data: strategies }, { data: standards }] =
    await Promise.all([
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("plan_strategies").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_standards").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    ]);

  const { data: proposals, error } = await supabase
    .from("plan_project_proposals")
    .select(
      "id, name, proposer_name, created_by, standard, responsible, strategy_alignment, activities, budget_amount, status, admin_group_id, budget_source_id, file_url_word, file_url_pdf, endorsed_by_name, endorsed_at, endorse_note, approved_by_name, approved_at, approve_note, plan_admin_groups(name), plan_budget_sources(name)",
    )
    .order("created_at", { ascending: false });

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

  const rows = (proposals ?? []).map((p) => ({
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
    strategyAlignment: p.strategy_alignment,
    fileUrlWord: p.file_url_word ? (signedFileUrls.get(p.file_url_word) ?? null) : null,
    fileUrlPdf: p.file_url_pdf ? (signedFileUrls.get(p.file_url_pdf) ?? null) : null,
    fileUrlWordPath: p.file_url_word,
    fileUrlPdfPath: p.file_url_pdf,
    activities:
      (p.activities as unknown as {
        name: string;
        responsible: string[];
        budget: number;
      }[]) ?? [],
    budgetAmount: Number(p.budget_amount ?? 0),
    status: p.status,
    endorsedByName: p.endorsed_by_name,
    endorsedAt: p.endorsed_at,
    endorseNote: p.endorse_note,
    approvedByName: p.approved_by_name,
    approvedAt: p.approved_at,
    approveNote: p.approve_note,
  }));

  const visibleRows = isDirectorOnly
    ? rows.filter((r) => r.status !== "รอเห็นชอบ" || r.createdBy === user?.id)
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
            trigger="+ เสนอโครงการใหม่"
            triggerClassName="btn-primary"
            closeOnSubmit
          >
            <ProposalForm
              action={createProposal}
              budgetYearId={currentYear.id}
              adminGroups={adminGroups ?? []}
              budgetSources={budgetSources ?? []}
              teachers={teachers ?? []}
              strategies={strategies ?? []}
              standards={standards ?? []}
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
          <strong> ผู้อนุมัติ</strong> (ผู้อำนวยการ) เมื่ออนุมัติแล้ว ให้นำไปบันทึกเป็นโครงการจริงในเมนู
          &quot;โครงการ&quot; ต่อไป
        </p>
      </div>

      <div className="table-shell">
        {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error.message}</p>}
        <ProposalsTable
          rows={visibleRows}
          isAdmin={isAdmin}
          canEndorse={canEndorse}
          canApprove={canApprove}
          currentUserId={user?.id ?? null}
          adminGroups={adminGroups ?? []}
          budgetSources={budgetSources ?? []}
          teachers={teachers ?? []}
          strategies={strategies ?? []}
          standards={standards ?? []}
          endorseProposal={endorseProposal}
          cancelEndorsement={cancelEndorsement}
          approveProposal={approveProposal}
          resetProposalStatus={resetProposalStatus}
          deleteProposal={deleteProposal}
          deleteProposalFile={deleteProposalFile}
          updateProposal={updateProposal}
        />
      </div>
    </div>
  );
}
