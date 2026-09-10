"use client";

// หน้า "ผู้บริหาร" — ทางลัด/ศูนย์แจ้งเตือนรวมสำหรับ แอดมิน/รองผู้อำนวยการ/ผู้อำนวยการ รวมรายการที่
// รอการพิจารณาจากผู้ใช้คนนี้จากทุกกระบวนการ 2 ขั้น (รองผู้อำนวยการ -> ผู้อำนวยการ) ในระบบไว้ที่เดียว
// แทนที่ต้องไล่เปิดทีละเมนู — กดแต่ละรายการพาตรงไปหน้า/ป็อปอัปที่กดดำเนินการได้เลย (ผ่าน ?open=<id>
// ที่ /project-proposals และ /approvals รองรับใหม่ ส่วน /asset-audits/[id] ลิงก์ตรงได้อยู่แล้ว)
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
import { BellIcon, BoxIcon, ChevronRightIcon, ClipboardCheckIcon, LightbulbIcon } from "@/components/icons";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

type ProposalItem = { id: string; name: string; budgetAmount: number; createdAt: string };
type ApprovalItem = {
  id: string;
  docNumber: string | null;
  activityName: string | null;
  projectName: string | null;
  requestedAmount: number;
  docDate: string;
};
type AuditRoundItem = { id: string; fiscalYear: number; dueDate: string };
type PendingRow = { id: string; href: string; primary: string; secondary?: string; amount?: string };

function PendingGroup({ title, items }: { title: string; items: PendingRow[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {items.length > 0 && <span className="badge-amber">{items.length} รายการ</span>}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm text-slate-400">
          ไม่มีรายการรอดำเนินการ
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {items.map((it, i) => (
            <li key={it.id}>
              <Link href={it.href} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-navy-950/[0.02]">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-xs font-medium tabular-nums text-slate-400">{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{it.primary}</p>
                    {it.secondary && <p className="truncate text-xs text-slate-500">{it.secondary}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {it.amount && <span className="text-sm tabular-nums text-slate-600">{it.amount}</span>}
                  <ChevronRightIcon className="h-4 w-4 text-slate-300" />
                </div>
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

export default function ExecutivePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  const [proposalsToEndorse, setProposalsToEndorse] = useState<ProposalItem[]>([]);
  const [proposalsToApprove, setProposalsToApprove] = useState<ProposalItem[]>([]);
  const [approvalsToDeputy, setApprovalsToDeputy] = useState<ApprovalItem[]>([]);
  const [approvalsToDirector, setApprovalsToDirector] = useState<ApprovalItem[]>([]);
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
            .select("id, name, budget_amount, status, created_at")
            .in("status", [deputy ? "รอเห็นชอบ" : "", director ? "รออนุมัติ" : ""].filter(Boolean))
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
      deputy || director
        ? supabase
            .from("proc_approvals")
            .select("id, doc_number, activity_name, requested_amount, status, deputy_decision, doc_date, plan_projects(name)")
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

    const toProposalItem = (p: { id: string; name: string; budget_amount: number; created_at: string }): ProposalItem => ({
      id: p.id,
      name: p.name,
      budgetAmount: Number(p.budget_amount),
      createdAt: p.created_at,
    });
    setProposalsToEndorse((proposals ?? []).filter((p) => p.status === "รอเห็นชอบ").map(toProposalItem));
    setProposalsToApprove((proposals ?? []).filter((p) => p.status === "รออนุมัติ").map(toProposalItem));

    const approvalRows = (approvals ?? []) as unknown as {
      id: string;
      doc_number: string | null;
      activity_name: string | null;
      requested_amount: number;
      status: string;
      deputy_decision: string | null;
      doc_date: string;
      plan_projects: { name: string } | null;
    }[];
    const toApprovalItem = (r: (typeof approvalRows)[number]): ApprovalItem => ({
      id: r.id,
      docNumber: r.doc_number,
      activityName: r.activity_name,
      projectName: r.plan_projects?.name ?? null,
      requestedAmount: Number(r.requested_amount),
      docDate: r.doc_date,
    });
    setApprovalsToDeputy(
      deputy
        ? approvalRows
            .filter((r) => r.deputy_decision === null && r.status !== "อนุมัติ" && r.status !== "ไม่อนุมัติ")
            .map(toApprovalItem)
        : [],
    );
    setApprovalsToDirector(
      director
        ? approvalRows
            .filter((r) => r.deputy_decision !== null && r.status !== "อนุมัติ" && r.status !== "ไม่อนุมัติ")
            .map(toApprovalItem)
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
          <p className="text-sm text-amber-700">กดที่รายการด้านล่างเพื่อเข้าไปดำเนินการได้ทันที</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {(canActDeputy || canActDirector) && (
          <CategoryCard icon={<LightbulbIcon className="h-4 w-4" />} title="เสนอโครงการ" totalCount={proposalTotal}>
            {canActDeputy && (
              <PendingGroup
                title="รอเห็นชอบ (รองผู้อำนวยการ)"
                items={proposalsToEndorse.map((p) => ({
                  id: p.id,
                  href: `/project-proposals?open=${p.id}`,
                  primary: p.name,
                  secondary: `เสนอเมื่อ ${formatThaiDate(p.createdAt)}`,
                  amount: `${formatBaht(p.budgetAmount)} บาท`,
                }))}
              />
            )}
            {canActDirector && (
              <PendingGroup
                title="รออนุมัติ (ผู้อำนวยการ)"
                items={proposalsToApprove.map((p) => ({
                  id: p.id,
                  href: `/project-proposals?open=${p.id}`,
                  primary: p.name,
                  secondary: `เสนอเมื่อ ${formatThaiDate(p.createdAt)}`,
                  amount: `${formatBaht(p.budgetAmount)} บาท`,
                }))}
              />
            )}
          </CategoryCard>
        )}

        {(canActDeputy || canActDirector) && (
          <CategoryCard icon={<ClipboardCheckIcon className="h-4 w-4" />} title="บันทึกขออนุมัติ" totalCount={approvalTotal}>
            {canActDeputy && (
              <PendingGroup
                title="รอเสนอความเห็น (รองผู้อำนวยการ)"
                items={approvalsToDeputy.map((a) => ({
                  id: a.id,
                  href: `/approvals?open=${a.id}`,
                  primary: a.projectName ?? a.activityName ?? a.docNumber ?? "-",
                  secondary: `เลขที่ ${a.docNumber ?? "-"} · ${formatThaiDate(a.docDate)}`,
                  amount: `${formatBaht(a.requestedAmount)} บาท`,
                }))}
              />
            )}
            {canActDirector && (
              <PendingGroup
                title="รออนุมัติ (ผู้อำนวยการ)"
                items={approvalsToDirector.map((a) => ({
                  id: a.id,
                  href: `/approvals?open=${a.id}`,
                  primary: a.projectName ?? a.activityName ?? a.docNumber ?? "-",
                  secondary: `เลขที่ ${a.docNumber ?? "-"} · ${formatThaiDate(a.docDate)}`,
                  amount: `${formatBaht(a.requestedAmount)} บาท`,
                }))}
              />
            )}
          </CategoryCard>
        )}

        {(canAckDeputyAudit || canAckDirectorAudit) && (
          <CategoryCard icon={<BoxIcon className="h-4 w-4" />} title="ตรวจสอบพัสดุประจำปี" totalCount={auditTotal}>
            {canAckDeputyAudit && (
              <PendingGroup
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
              <PendingGroup
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
