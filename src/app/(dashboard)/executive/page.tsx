"use client";

// หน้า "ผู้บริหาร" — ทางลัด/ศูนย์แจ้งเตือนรวมสำหรับ แอดมิน/รองผู้อำนวยการ/ผู้อำนวยการ รวมรายการที่
// รอการพิจารณาจากผู้ใช้คนนี้จากทุกกระบวนการ 2 ขั้น (รองผู้อำนวยการ -> ผู้อำนวยการ) ในระบบไว้ที่เดียว
//
// เสนอโครงการ/บันทึกขออนุมัติ: popup พิจารณา (ProposalDetailModal / ApprovalStatusCell) ฝังอยู่ใน
// หน้านี้โดยตรง (ใช้ทั้งแถวรายการเป็น trigger ของ Modal เดิม ผ่าน prop trigger/triggerClassName ที่
// เพิ่มให้ทั้งสอง component) — กดรายการ ทำงานในป็อปอัปเสร็จ ก็อยู่ที่หน้านี้ต่อเลย ไม่ต้องเปลี่ยนหน้า
// ไปมาเหมือนเดิม (ก่อนหน้านี้ลิงก์ไป /project-proposals?open=<id> และ /approvals?open=<id> ทำให้ผู้ใช้
// ต้องกดย้อนกลับมาหน้า "ผู้บริหาร" เองทุกครั้งหลังทำรายการเสร็จ)
// ตรวจสอบพัสดุประจำปี: ยังคงลิงก์ไปหน้ารายละเอียดรอบตรวจสอบ (/asset-audits/[id]) เหมือนเดิม เพราะเป็น
// หน้าเต็มหลายแท็บ ไม่ใช่ popup ที่ฝังกลับมาได้ง่ายๆ
//
// สิทธิ์เห็นรายการแต่ละหมวดอ้างอิงกลไกเดียวกับหน้าเดิมของหมวดนั้นเป๊ะๆ (ไม่ได้คิดใหม่):
// - เสนอโครงการ/บันทึกขออนุมัติ ใช้กลไกเดียวกันทั้งคู่ (คนละหน้าแต่เช็คแบบเดียวกัน): ป้าย
//   "สถานะผู้ใช้งาน" ชื่อ "รองผู้อำนวยการ"/"ผู้อำนวยการ" (proc_user_group_members)
// - ตรวจสอบพัสดุประจำปี: role ผู้ใช้ (proc_profiles.role) เป็น deputy_director/director เหมือน
//   asset-audits/actions.ts ทุกประการ
// แอดมิน (isAdmin) เห็น/ทำแทนได้ทุกหมวดเหมือนหน้าอื่นๆ ในระบบ

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { formatThaiDate } from "@/lib/thai";
import { toastError, toastSuccess, errorMessage, confirmWarning } from "@/lib/swal";
import { BellIcon, BoxIcon, ChevronRightIcon, ClipboardCheckIcon, LightbulbIcon } from "@/components/icons";
import { ProposalDetailModal } from "../project-proposals/proposal-detail-modal";
import {
  approveProposal,
  cancelEndorsement,
  deleteProposal,
  deleteProposalFile,
  endorseProposal,
  resetProposalStatus,
} from "../project-proposals/actions";
import { ApprovalStatusCell, type Approval, type DecisionMode } from "../approvals/page";
import {
  resetApprovalStatus,
  resetDeputyDecision,
  updateApprovalStatus,
  updateDeputyDecision,
} from "../approvals/actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type ActivityRow = { name: string; responsible: string[]; budget: number };
type ProposalItem = {
  id: string;
  name: string;
  proposerName: string | null;
  createdBy: string | null;
  adminGroup: string;
  budgetSource: string;
  standard: string | null;
  responsible: string[];
  strategyAlignment: string | null;
  fileUrlWord: string | null;
  fileUrlPdf: string | null;
  activities: ActivityRow[];
  budgetAmount: number;
  status: string;
  endorsedByName: string | null;
  endorsedAt: string | null;
  endorseNote: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  approveNote: string | null;
  createdAt: string;
};
type AuditRoundItem = { id: string; fiscalYear: number; dueDate: string };
type PendingRow = { id: string; href: string; primary: string; secondary?: string; amount?: string };

/** เนื้อหาแถวรายการ (เลขลำดับ + ชื่อ/รายละเอียด + จำนวนเงิน) — ใช้ร่วมกันทั้งแถวแบบลิงก์ (asset-audits)
 * และแถวที่เป็น trigger เปิด popup ฝังในหน้า (proposals/approvals) ให้หน้าตาเหมือนกันทุกจุด */
function RowContent({
  index,
  primary,
  secondary,
  amount,
}: {
  index: number;
  primary: string;
  secondary?: string;
  amount?: string;
}) {
  return (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-xs font-medium tabular-nums text-slate-400">{index + 1}.</span>
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{primary}</p>
          {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {amount && <span className="text-sm tabular-nums text-slate-600">{amount}</span>}
        <ChevronRightIcon className="h-4 w-4 text-slate-300" />
      </div>
    </>
  );
}

const ROW_TRIGGER_CLASS =
  "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-navy-950/[0.02]";

function EmptyRow() {
  return (
    <p className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm text-slate-400">
      ไม่มีรายการรอดำเนินการ
    </p>
  );
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {count > 0 && <span className="badge-amber">{count} รายการ</span>}
    </div>
  );
}

/** หมวดที่ยังลิงก์ไปหน้าปลายทาง (ตรวจสอบพัสดุประจำปี — หน้าเต็มหลายแท็บ ไม่ฝัง popup) */
function LinkPendingGroup({ title, items }: { title: string; items: PendingRow[] }) {
  return (
    <div>
      <GroupHeader title={title} count={items.length} />
      {items.length === 0 ? (
        <EmptyRow />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((it, i) => (
            <li key={it.id}>
              <Link href={it.href} className={ROW_TRIGGER_CLASS}>
                <RowContent index={i} primary={it.primary} secondary={it.secondary} amount={it.amount} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryCard({
  icon,
  title,
  totalCount,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  totalCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-800/10 text-navy-800">
          {icon}
        </span>
        <span className="font-semibold text-slate-900">{title}</span>
        {totalCount > 0 ? (
          <span className="badge-amber ml-auto">{totalCount} รอดำเนินการ</span>
        ) : (
          <span className="badge-emerald ml-auto">ไม่มีค้าง</span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ProposalPendingGroup({
  title,
  items,
  isAdmin,
  canActDeputy,
  canActDirector,
  currentUserId,
  onChanged,
}: {
  title: string;
  items: ProposalItem[];
  isAdmin: boolean;
  canActDeputy: boolean;
  canActDirector: boolean;
  currentUserId: string | null;
  onChanged: () => void;
}) {
  return (
    <div>
      <GroupHeader title={title} count={items.length} />
      {items.length === 0 ? (
        <EmptyRow />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((p, i) => (
            <li key={p.id}>
              <ProposalDetailModal
                proposal={p}
                isAdmin={isAdmin}
                canEndorse={canActDeputy}
                canApprove={canActDirector}
                canDelete={p.status === "รอเห็นชอบ" && (isAdmin || p.createdBy === currentUserId)}
                endorseProposal={endorseProposal}
                cancelEndorsement={cancelEndorsement}
                approveProposal={approveProposal}
                resetProposalStatus={resetProposalStatus}
                deleteProposal={deleteProposal}
                deleteProposalFile={deleteProposalFile}
                onChanged={onChanged}
                trigger={
                  <RowContent
                    index={i}
                    primary={p.name}
                    secondary={`เสนอเมื่อ ${formatThaiDate(p.createdAt)}`}
                    amount={`${formatBaht(p.budgetAmount)} บาท`}
                  />
                }
                triggerClassName={ROW_TRIGGER_CLASS}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApprovalPendingGroup({
  title,
  items,
  mode,
  isAdmin,
  canActDeputy,
  canActDirector,
  onSubmitDeputy,
  onSubmitDirector,
  onResetDeputy,
  onResetStatus,
}: {
  title: string;
  items: Approval[];
  mode: DecisionMode;
  isAdmin: boolean;
  canActDeputy: boolean;
  canActDirector: boolean;
  onSubmitDeputy: (id: string, decision: "ควร" | "ไม่ควร", note?: string) => Promise<void>;
  onSubmitDirector: (id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) => Promise<void>;
  onResetDeputy: (id: string) => void;
  onResetStatus: (id: string) => void;
}) {
  return (
    <div>
      <GroupHeader title={title} count={items.length} />
      {items.length === 0 ? (
        <EmptyRow />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((a, i) => (
            <li key={a.id}>
              <ApprovalStatusCell
                approval={a}
                mode={mode}
                isAdmin={isAdmin}
                canApproveDeputy={canActDeputy}
                canApproveDirector={canActDirector}
                onSubmitDeputy={onSubmitDeputy}
                onSubmitDirector={onSubmitDirector}
                onResetDeputy={onResetDeputy}
                onResetStatus={onResetStatus}
                trigger={
                  <RowContent
                    index={i}
                    primary={a.plan_projects?.name ?? a.activity_name ?? a.doc_number ?? "-"}
                    secondary={`เลขที่ ${a.doc_number ?? "-"} · ${formatThaiDate(a.doc_date)}`}
                    amount={`${formatBaht(Number(a.requested_amount))} บาท`}
                  />
                }
                triggerClassName={ROW_TRIGGER_CLASS}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ExecutivePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  const [proposalsToEndorse, setProposalsToEndorse] = useState<ProposalItem[]>([]);
  const [proposalsToApprove, setProposalsToApprove] = useState<ProposalItem[]>([]);
  const [approvalsToDeputy, setApprovalsToDeputy] = useState<Approval[]>([]);
  const [approvalsToDirector, setApprovalsToDirector] = useState<Approval[]>([]);
  const [roundsToAckDeputy, setRoundsToAckDeputy] = useState<AuditRoundItem[]>([]);
  const [roundsToAckDirector, setRoundsToAckDirector] = useState<AuditRoundItem[]>([]);

  // ป้าย "รองผู้อำนวยการ"/"ผู้อำนวยการ" — ใช้ร่วมกันทั้งหมวดเสนอโครงการและบันทึกขออนุมัติ (กลไกเดียวกัน)
  const [canActDeputy, setCanActDeputy] = useState(false);
  const [canActDirector, setCanActDirector] = useState(false);
  // role deputy_director/director — ใช้เฉพาะหมวดตรวจสอบพัสดุประจำปี (กลไกคนละแบบ)
  const [canAckDeputyAudit, setCanAckDeputyAudit] = useState(false);
  const [canAckDirectorAudit, setCanAckDirectorAudit] = useState(false);

  const role = user?.role ?? "";
  const allowed = isAdmin || role === "deputy_director" || role === "director";

  const reload = useCallback(async () => {
    if (authLoading || !allowed) return;
    setLoading(true);
    const supabase = createClient();

    let myGroupNames = new Set<string>();
    if (!isAdmin && user) {
      const { data: myGroups } = await supabase
        .from("proc_user_group_members")
        .select("proc_user_groups(name)")
        .eq("user_id", user.userId);
      myGroupNames = new Set(
        (myGroups ?? [])
          .map((g) => (g.proc_user_groups as unknown as { name: string } | null)?.name)
          .filter((n): n is string => !!n),
      );
    }
    const deputy = isAdmin || myGroupNames.has("รองผู้อำนวยการ");
    const director = isAdmin || myGroupNames.has("ผู้อำนวยการ");
    const ackDeputy = isAdmin || role === "deputy_director";
    const ackDirector = isAdmin || role === "director";
    setCanActDeputy(deputy);
    setCanActDirector(director);
    setCanAckDeputyAudit(ackDeputy);
    setCanAckDirectorAudit(ackDirector);

    const [{ data: proposals }, { data: approvals }, { data: rounds }] = await Promise.all([
      deputy || director
        ? supabase
            .from("plan_project_proposals")
            .select(
              "id, name, proposer_name, created_by, standard, responsible, strategy_alignment, activities, budget_amount, status, file_url_word, file_url_pdf, created_at, endorsed_by_name, endorsed_at, endorse_note, approved_by_name, approved_at, approve_note, plan_admin_groups(name), plan_budget_sources(name)",
            )
            .in("status", [deputy ? "รอเห็นชอบ" : "", director ? "รออนุมัติ" : ""].filter(Boolean))
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      deputy || director
        ? supabase
            .from("proc_approvals")
            .select(
              "id, created_by, doc_number, doc_date, activity_name, requested_amount, requested_by_name, approval_pdf_url, status, deputy_decision, deputy_decided_by_name, deputy_decided_at, deputy_note, approved_by_name, approved_at, approve_note, summary_items, plan_projects(name)",
            )
            .order("doc_date", { ascending: true })
        : Promise.resolve({ data: [] }),
      ackDeputy || ackDirector
        ? supabase
            .from("asset_audit_rounds")
            .select("id, fiscal_year, due_date, status")
            .in(
              "status",
              [ackDeputy ? "submitted" : null, ackDirector ? "acknowledged_deputy" : null].filter(
                (s): s is "submitted" | "acknowledged_deputy" => s !== null,
              ),
            )
            .order("due_date", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const proposalRows = (proposals ?? []) as unknown as {
      id: string;
      name: string;
      proposer_name: string | null;
      created_by: string | null;
      standard: string | null;
      responsible: string[] | null;
      strategy_alignment: string | null;
      activities: ActivityRow[] | null;
      budget_amount: number;
      status: string;
      file_url_word: string | null;
      file_url_pdf: string | null;
      created_at: string;
      endorsed_by_name: string | null;
      endorsed_at: string | null;
      endorse_note: string | null;
      approved_by_name: string | null;
      approved_at: string | null;
      approve_note: string | null;
      plan_admin_groups: { name: string } | null;
      plan_budget_sources: { name: string } | null;
    }[];

    // เซ็นลิงก์ไฟล์โครงการ (Word/PDF) เป็น batch เดียว ให้เปิดอ่านประกอบการตัดสินใจได้ในป็อปอัป
    // (มิเรอร์แพทเทิร์นเดียวกับ project-proposals/page.tsx)
    const filePaths = proposalRows.flatMap((p) => [p.file_url_word, p.file_url_pdf]).filter((p): p is string => !!p);
    const signedFileUrls = new Map<string, string>();
    if (filePaths.length > 0) {
      const { data: signed } = await supabase.storage.from("procurement-files").createSignedUrls(filePaths, 3600);
      signed?.forEach((s) => {
        if (s.signedUrl && !s.error) signedFileUrls.set(s.path ?? "", s.signedUrl);
      });
    }

    const toProposalItem = (p: (typeof proposalRows)[number]): ProposalItem => ({
      id: p.id,
      name: p.name,
      proposerName: p.proposer_name,
      createdBy: p.created_by,
      adminGroup: p.plan_admin_groups?.name ?? "-",
      budgetSource: p.plan_budget_sources?.name ?? "-",
      standard: p.standard,
      responsible: p.responsible ?? [],
      strategyAlignment: p.strategy_alignment,
      fileUrlWord: p.file_url_word ? (signedFileUrls.get(p.file_url_word) ?? null) : null,
      fileUrlPdf: p.file_url_pdf ? (signedFileUrls.get(p.file_url_pdf) ?? null) : null,
      activities: p.activities ?? [],
      budgetAmount: Number(p.budget_amount),
      status: p.status,
      endorsedByName: p.endorsed_by_name,
      endorsedAt: p.endorsed_at,
      endorseNote: p.endorse_note,
      approvedByName: p.approved_by_name,
      approvedAt: p.approved_at,
      approveNote: p.approve_note,
      createdAt: p.created_at,
    });
    setProposalsToEndorse(proposalRows.filter((p) => p.status === "รอเห็นชอบ").map(toProposalItem));
    setProposalsToApprove(proposalRows.filter((p) => p.status === "รออนุมัติ").map(toProposalItem));

    const approvalRows = (approvals ?? []) as unknown as Approval[];
    setApprovalsToDeputy(
      deputy
        ? approvalRows.filter((r) => r.deputy_decision === null && r.status !== "อนุมัติ" && r.status !== "ไม่อนุมัติ")
        : [],
    );
    setApprovalsToDirector(
      director
        ? approvalRows.filter((r) => r.deputy_decision !== null && r.status !== "อนุมัติ" && r.status !== "ไม่อนุมัติ")
        : [],
    );

    setRoundsToAckDeputy(
      (rounds ?? [])
        .filter((r) => r.status === "submitted")
        .map((r) => ({ id: r.id, fiscalYear: r.fiscal_year, dueDate: r.due_date })),
    );
    setRoundsToAckDirector(
      (rounds ?? [])
        .filter((r) => r.status === "acknowledged_deputy")
        .map((r) => ({ id: r.id, fiscalYear: r.fiscal_year, dueDate: r.due_date })),
    );

    setLoading(false);
  }, [authLoading, allowed, isAdmin, user, role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  async function submitDeputyDecision(id: string, decision: "ควร" | "ไม่ควร", note?: string) {
    try {
      await updateDeputyDecision(id, decision, note);
      await toastSuccess("บันทึกความเห็นของรองผู้อำนวยการแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
      throw err;
    }
  }

  async function submitDirectorDecision(id: string, decision: "อนุมัติ" | "ไม่อนุมัติ", note?: string) {
    try {
      await updateApprovalStatus(id, decision, note);
      await toastSuccess(`บันทึกสถานะ "${decision}" แล้ว`);
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
      throw err;
    }
  }

  async function handleResetDeputyDecision(id: string) {
    const ok = await confirmWarning({ title: "ย้อนความเห็นของรองผู้อำนวยการกลับเป็นค่าว่าง?" });
    if (!ok) return;
    try {
      await resetDeputyDecision(id);
      await toastSuccess("ย้อนความเห็นแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleResetStatus(id: string) {
    const ok = await confirmWarning({ title: 'ย้อนสถานะกลับเป็น "รออนุมัติ"?' });
    if (!ok) return;
    try {
      await resetApprovalStatus(id);
      await toastSuccess("ย้อนสถานะแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  if (authLoading) return <PageLoadingSkeleton />;

  if (!allowed) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ รองผู้อำนวยการ และผู้อำนวยการเท่านั้น
      </div>
    );
  }

  if (loading) return <PageLoadingSkeleton />;

  const proposalTotal = proposalsToEndorse.length + proposalsToApprove.length;
  const approvalTotal = approvalsToDeputy.length + approvalsToDirector.length;
  const auditTotal = roundsToAckDeputy.length + roundsToAckDirector.length;
  const grandTotal = proposalTotal + approvalTotal + auditTotal;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ผู้บริหาร</h1>
          <p className="page-subtitle">ทางลัดและรายการที่รอการพิจารณาจากท่าน รวมจากทุกกระบวนการในระบบ</p>
        </div>
      </div>

      <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <BellIcon className="h-5 w-5 text-amber-700" />
        </span>
        <div>
          <p className="font-semibold text-amber-900">
            {grandTotal > 0 ? `มีรายการรอดำเนินการทั้งหมด ${grandTotal.toLocaleString("th-TH")} รายการ` : "ไม่มีรายการรอดำเนินการ"}
          </p>
          <p className="text-sm text-amber-700">กดที่รายการด้านล่างเพื่อพิจารณาได้ทันที (ไม่ต้องเปลี่ยนหน้า)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(canActDeputy || canActDirector) && (
          <CategoryCard icon={<LightbulbIcon className="h-4 w-4" />} title="เสนอโครงการ" totalCount={proposalTotal}>
            {canActDeputy && (
              <ProposalPendingGroup
                title="รอเห็นชอบ (รองผู้อำนวยการ)"
                items={proposalsToEndorse}
                isAdmin={isAdmin}
                canActDeputy={canActDeputy}
                canActDirector={canActDirector}
                currentUserId={user?.userId ?? null}
                onChanged={reload}
              />
            )}
            {canActDirector && (
              <ProposalPendingGroup
                title="รออนุมัติ (ผู้อำนวยการ)"
                items={proposalsToApprove}
                isAdmin={isAdmin}
                canActDeputy={canActDeputy}
                canActDirector={canActDirector}
                currentUserId={user?.userId ?? null}
                onChanged={reload}
              />
            )}
          </CategoryCard>
        )}

        {(canActDeputy || canActDirector) && (
          <CategoryCard icon={<ClipboardCheckIcon className="h-4 w-4" />} title="บันทึกขออนุมัติ" totalCount={approvalTotal}>
            {canActDeputy && (
              <ApprovalPendingGroup
                title="รอเสนอความเห็น (รองผู้อำนวยการ)"
                items={approvalsToDeputy}
                mode="deputy"
                isAdmin={isAdmin}
                canActDeputy={canActDeputy}
                canActDirector={canActDirector}
                onSubmitDeputy={submitDeputyDecision}
                onSubmitDirector={submitDirectorDecision}
                onResetDeputy={handleResetDeputyDecision}
                onResetStatus={handleResetStatus}
              />
            )}
            {canActDirector && (
              <ApprovalPendingGroup
                title="รออนุมัติ (ผู้อำนวยการ)"
                items={approvalsToDirector}
                mode="director"
                isAdmin={isAdmin}
                canActDeputy={canActDeputy}
                canActDirector={canActDirector}
                onSubmitDeputy={submitDeputyDecision}
                onSubmitDirector={submitDirectorDecision}
                onResetDeputy={handleResetDeputyDecision}
                onResetStatus={handleResetStatus}
              />
            )}
          </CategoryCard>
        )}

        {(canAckDeputyAudit || canAckDirectorAudit) && (
          <CategoryCard icon={<BoxIcon className="h-4 w-4" />} title="ตรวจสอบพัสดุประจำปี" totalCount={auditTotal}>
            {canAckDeputyAudit && (
              <LinkPendingGroup
                title="รอรับทราบ (รองผู้อำนวยการ)"
                items={roundsToAckDeputy.map((r) => ({
                  id: r.id,
                  href: `/asset-audits/${r.id}`,
                  primary: `ตรวจสอบพัสดุประจำปีงบประมาณ ${r.fiscalYear}`,
                  secondary: `ครบกำหนด ${formatThaiDate(r.dueDate)}`,
                }))}
              />
            )}
            {canAckDirectorAudit && (
              <LinkPendingGroup
                title="รอรับทราบ (ผู้อำนวยการ)"
                items={roundsToAckDirector.map((r) => ({
                  id: r.id,
                  href: `/asset-audits/${r.id}`,
                  primary: `ตรวจสอบพัสดุประจำปีงบประมาณ ${r.fiscalYear}`,
                  secondary: `ครบกำหนด ${formatThaiDate(r.dueDate)}`,
                }))}
              />
            )}
          </CategoryCard>
        )}
      </div>
    </div>
  );
}
