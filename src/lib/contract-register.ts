import { todayTh } from "@/lib/thai";
import type { createClient } from "@/lib/supabase/server";

// ข้อมูลทะเบียนสัญญาสำหรับพิมพ์ PDF / ส่งออก Excel — ตัวกรองชุดเดียวกับหน้า /contracts/register
// (ประเภท, ปีงบประมาณ, สถานะ, คำค้นหา) ส่งมาทาง query string: type, year, status, q

export type ContractRegisterRow = {
  contract_type: string;
  contract_no: string;
  contract_date: string;
  end_date: string | null;
  vendor_name: string;
  amount: number;
  project_name: string | null;
  budget_source_name: string | null;
};

export type ContractRegisterFilter = { type?: string; year?: string; status?: string; q?: string };

/** ปีงบประมาณไทย (ต.ค.–ก.ย.) ของวันที่ ISO */
export function fiscalYear(iso: string): number {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

/** สถานะจากวันสิ้นสุดสัญญา: active / due (≤7 วัน) / overdue / none */
export function contractStatusKey(endDate: string | null): { key: string; label: string } {
  if (!endDate) return { key: "none", label: "ไม่ระบุวันสิ้นสุด" };
  const today = todayTh();
  const days = Math.round((Date.parse(endDate) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { key: "overdue", label: `เลยกำหนด ${-days} วัน` };
  if (days <= 7) return { key: "due", label: `เหลือ ${days} วัน` };
  return { key: "active", label: "อยู่ในสัญญา" };
}

export const STATUS_FILTER_LABEL: Record<string, string> = {
  active: "อยู่ในสัญญา",
  due: "ใกล้ครบ (≤7 วัน)",
  overdue: "เลยกำหนด",
  none: "ไม่ระบุวันสิ้นสุด",
};

export function filterFromSearchParams(sp: URLSearchParams): ContractRegisterFilter {
  return {
    type: sp.get("type") || undefined,
    year: sp.get("year") || undefined,
    status: sp.get("status") || undefined,
    q: sp.get("q") || undefined,
  };
}

/** บรรทัดใต้หัวเอกสาร — แสดงเฉพาะปีงบประมาณที่เลือก (ไม่เลือกปี = ไม่แสดง) */
export function describeFilter(f: ContractRegisterFilter): string {
  return f.year ? `ปีงบประมาณ ${f.year}` : "";
}

export function applyContractFilter<T extends { contract_type: string; contract_date: string; end_date: string | null; contract_no: string; vendor_name: string; project_name?: string | null }>(
  rows: T[],
  f: ContractRegisterFilter,
): T[] {
  const q = f.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!f.type || r.contract_type === f.type) &&
      (!f.year || fiscalYear(r.contract_date) === Number(f.year)) &&
      (!f.status || contractStatusKey(r.end_date).key === f.status) &&
      (!q || [r.contract_no, r.vendor_name, r.project_name].some((v) => v?.toLowerCase().includes(q))),
  );
}

export async function fetchContractRegister(
  supabase: Awaited<ReturnType<typeof createClient>>,
  f: ContractRegisterFilter,
): Promise<ContractRegisterRow[]> {
  const { data, error } = await supabase
    .from("proc_contracts")
    .select("contract_type, contract_no, contract_date, end_date, vendor_name, amount, plan_projects(name), plan_budget_sources(name)")
    .order("contract_date", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((r) => ({
    contract_type: r.contract_type,
    contract_no: r.contract_no,
    contract_date: r.contract_date,
    end_date: r.end_date,
    vendor_name: r.vendor_name,
    amount: Number(r.amount),
    project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? null,
    budget_source_name: (r.plan_budget_sources as unknown as { name: string } | null)?.name ?? null,
  }));
  return applyContractFilter(rows, f);
}
