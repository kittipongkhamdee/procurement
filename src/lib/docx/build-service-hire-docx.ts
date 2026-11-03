import type { ContractContext } from "@/lib/teacher-hire-contract";
import { buildServiceHireBlocks, type ServiceHireContract } from "@/lib/service-hire-contract";
import { renderBlocksDocx } from "./build-teacher-hire-docx";

export async function renderServiceHireDocxBuffer(contract: ServiceHireContract, ctx: ContractContext): Promise<Buffer> {
  return renderBlocksDocx(buildServiceHireBlocks(contract, ctx), `สัญญาจ้างเหมาบริการ ${contract.contract_no}`, ctx.school_name);
}
