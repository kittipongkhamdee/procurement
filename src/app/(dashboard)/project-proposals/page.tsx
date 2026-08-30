import { createClient } from "@/lib/supabase/server";
import { Modal } from "@/components/modal";
import { LightbulbIcon } from "@/components/icons";
import { ProposalForm } from "./proposal-form";
import { ProposalsTable } from "./proposals-table";
import { approveProposal, createProposal, deleteProposal, endorseProposal, resetProposalStatus } from "./actions";

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

  const { data: budgetYears } = await supabase
    .from("plan_budget_years")
    .select("id, year, is_open")
    .order("year", { ascending: false });
  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0];

  const [{ data: adminGroups }, { data: budgetSources }, { data: teachers }] = await Promise.all([
    supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
  ]);

  const { data: proposals, error } = await supabase
    .from("plan_project_proposals")
    .select(
      "id, name, proposer_name, created_by, standard, project_type, responsible, strategy_alignment, start_date, end_date, location, rationale, objectives, target_quantity, target_quality, activities, budget_amount, risk_factors, risk_mitigation, evaluation_items, expected_results, status, endorsed_by_name, endorsed_at, endorse_note, approved_by_name, approved_at, approve_note, plan_admin_groups(name), plan_budget_sources(name)",
    )
    .order("created_at", { ascending: false });

  const rows = (proposals ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    proposerName: p.proposer_name,
    createdBy: p.created_by,
    adminGroup: (p.plan_admin_groups as unknown as { name: string } | null)?.name ?? "-",
    budgetSource: (p.plan_budget_sources as unknown as { name: string } | null)?.name ?? "-",
    standard: p.standard,
    projectType: p.project_type,
    responsible: p.responsible ?? [],
    strategyAlignment: p.strategy_alignment,
    startDate: p.start_date,
    endDate: p.end_date,
    location: p.location,
    rationale: p.rationale,
    objectives: p.objectives,
    targetQuantity: p.target_quantity,
    targetQuality: p.target_quality,
    activities:
      (p.activities as unknown as {
        name: string;
        period: string;
        responsible: string[];
        compensation: number;
        service: number;
        material: number;
      }[]) ?? [],
    budgetAmount: Number(p.budget_amount ?? 0),
    riskFactors: p.risk_factors,
    riskMitigation: p.risk_mitigation,
    evaluationItems:
      (p.evaluation_items as unknown as { type: string; indicator: string; target: string; method: string; tool: string }[]) ??
      [],
    expectedResults: p.expected_results,
    status: p.status,
    endorsedByName: p.endorsed_by_name,
    endorsedAt: p.endorsed_at,
    endorseNote: p.endorse_note,
    approvedByName: p.approved_by_name,
    approvedAt: p.approved_at,
    approveNote: p.approve_note,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">เสนอโครงการ</h1>
          <p className="page-subtitle">
            เขียนข้อเสนอโครงการตามแบบฟอร์มของโรงเรียน เพื่อเสนอเห็นชอบและอนุมัติ
          </p>
        </div>
        {currentYear && (
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
            />
          </Modal>
        )}
      </div>

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
          rows={rows}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? null}
          endorseProposal={endorseProposal}
          approveProposal={approveProposal}
          resetProposalStatus={resetProposalStatus}
          deleteProposal={deleteProposal}
        />
      </div>
    </div>
  );
}
