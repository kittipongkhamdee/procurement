import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Database } from "@/lib/supabase/database.types";
import { ProposalDocument, type ProposalPdfData } from "./proposal-document";

export async function buildProposalPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: ProposalPdfData; fileLabel: string } | null> {
  const { data: p, error } = await supabase
    .from("plan_project_proposals")
    .select(
      "name, proposer_name, standard, project_type, responsible, strategy_alignment, start_date, end_date, location, rationale, objectives, target_quantity, target_quality, activities, budget_amount, risk_factors, risk_mitigation, evaluation_items, expected_results, endorsed_by_name, approved_by_name, plan_admin_groups(name), plan_budget_sources(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !p) return null;

  const data: ProposalPdfData = {
    name: p.name,
    proposerName: p.proposer_name,
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
    endorsedByName: p.endorsed_by_name,
    approvedByName: p.approved_by_name,
  };

  return { data, fileLabel: `เสนอโครงการ-${data.name}` };
}

export async function renderProposalPdfBuffer(data: ProposalPdfData): Promise<Buffer> {
  return renderToBuffer(<ProposalDocument data={data} />);
}
