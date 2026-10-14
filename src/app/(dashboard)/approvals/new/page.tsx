import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import { createApproval } from "../actions";
import { ApprovalForm, type ApprovalFormPrefill } from "../approval-form";
import { loadItemSuggestions, loadUnitSuggestions } from "@/lib/unit-suggestions";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** เตรียมข้อมูลบันทึกขออนุมัติจากการส่งมอบตามสัญญา (เปิดจากหน้าส่งมอบหลังบันทึกงวดใหม่) */
async function prefillFromDelivery(supabase: SupabaseServer, deliveryId: string): Promise<{ prefill: ApprovalFormPrefill; label: string } | null> {
  const { data: d } = await supabase
    .from("proc_deliveries")
    .select("contract_id, installment_no, period_month, amount")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return null;
  const { data: c } = await supabase
    .from("proc_contracts")
    .select("id, contract_type, contract_no, vendor_name, detail, amount, project_id")
    .eq("id", d.contract_id)
    .maybeSingle();
  if (!c) return null;
  const amount = Number(d.amount);
  const installment = d.installment_no ? ` งวดที่ ${d.installment_no}` : "";
  const period = d.period_month
    ? ` ประจำเดือน${THAI_MONTHS[Number(d.period_month.slice(5, 7)) - 1]} ${Number(d.period_month.slice(0, 4)) + 543}`
    : "";
  const ref = `สัญญา${c.contract_type}เลขที่ ${c.contract_no}${installment}`;

  return {
    label: `${ref} (${c.vendor_name})`,
    prefill: {
      project_id: c.project_id,
      subject: "ขออนุญาตดำเนินการและอนุมัติใช้เงินโครงการ",
      // หน้า ๑ ตารางสรุป แถว "จัดซื้อจัดจ้าง" ต่อท้ายรายละเอียดงานตามสัญญา + ประจำเดือน; ไม่สร้างรายการวัสดุ (หน้า ๒)
      summary_items: [{ label: `จัดซื้อจัดจ้าง ${c.detail || `ตามสัญญา${c.contract_type}`}${period}`, amount, note: null }],
      items: [],
    },
  };
}

export default async function NewApprovalPage({ searchParams }: { searchParams: Promise<{ delivery?: string }> }) {
  const supabase = await createClient();
  const { delivery: deliveryId } = await searchParams;
  const fromDelivery = deliveryId ? await prefillFromDelivery(supabase, deliveryId) : null;

  // บันทึกขออนุมัติทำได้เฉพาะโครงการของปีงบประมาณปัจจุบัน (ปีที่เปิดใช้งาน) — ไม่มีปีที่เปิดอยู่ก็ใช้ปีล่าสุด
  const { data: budgetYears } = await supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false });
  const currentYear = budgetYears?.find((y) => y.is_open) ?? budgetYears?.[0] ?? null;

  const [{ data: projects }, { data: allActivities }, { data: approvals }, { data: adminGroups }, { data: teachers }, { data: learningAreas }] =
    await Promise.all([
      currentYear
        ? supabase.from("plan_projects").select("id, name, admin_group_id").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] as { id: string; name: string; admin_group_id: string }[] }),
      supabase.from("plan_activities").select("id, project_id, name, budget, responsible"),
      supabase.from("proc_approvals").select("project_id, requested_amount").eq("status", "อนุมัติ"),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("plan_teachers").select("id, name, is_active").order("sort_order").order("name"),
    supabase.from("plan_learning_areas").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    ]);

  const currentProjectIds = new Set((projects ?? []).map((p) => p.id));
  const activities = (allActivities ?? []).filter((a) => currentProjectIds.has(a.project_id));

  const [unitSuggestions, itemSuggestions] = await Promise.all([
    loadUnitSuggestions(supabase),
    loadItemSuggestions(supabase),
  ]);

  const budgetByProject = new Map<string, number>();
  activities.forEach((a) => {
    budgetByProject.set(a.project_id, (budgetByProject.get(a.project_id) ?? 0) + Number(a.budget));
  });

  // เงินที่อนุมัติไปแล้วก่อนหน้าของแต่ละโครงการ — ใช้คำนวณ "เงินโครงการเหลือ" ในช่องความเห็นงานแผนงาน
  // (แพทเทิร์นเดียวกับที่หน้ารายงานโครงการใช้ดึงงบใช้จริงมาอัตโนมัติ)
  const approvedByProject = new Map<string, number>();
  (approvals ?? []).forEach((a) => {
    if (!a.project_id) return;
    approvedByProject.set(a.project_id, (approvedByProject.get(a.project_id) ?? 0) + Number(a.requested_amount));
  });

  const projectOptions = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    adminGroupId: p.admin_group_id,
    budget: budgetByProject.get(p.id) ?? 0,
    approvedSoFar: approvedByProject.get(p.id) ?? 0,
  }));

  return (
    <div>
      <Link
        href="/approvals"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        กลับไปการบันทึกขออนุมัติ
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">สร้างบันทึกข้อความขออนุมัติ</h1>
          {currentYear && <p className="page-subtitle">ปีงบประมาณ {currentYear.year}</p>}
        </div>
      </div>
      {projectOptions.length === 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ปีงบประมาณปัจจุบัน{currentYear ? ` ${currentYear.year}` : ""} ยังไม่มีโครงการในแผนปฏิบัติการ จึงยังเลือกโครงการเพื่อขออนุมัติไม่ได้ —
          บันทึกขออนุมัติทำได้เฉพาะโครงการของปีงบประมาณปัจจุบัน
        </div>
      )}
      {fromDelivery && (
        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          กรอกข้อมูลจาก{fromDelivery.label}ไว้ให้แล้ว — ตรวจสอบและเลือกกิจกรรม/ผู้ขออนุมัติ ก่อนบันทึก
          {fromDelivery.prefill.project_id && !currentProjectIds.has(fromDelivery.prefill.project_id) && (
            <span className="block text-amber-700">โครงการของสัญญาไม่อยู่ในปีงบประมาณปัจจุบัน กรุณาเลือกโครงการเอง</span>
          )}
        </div>
      )}
      <ApprovalForm
        prefill={
          fromDelivery
            ? {
                ...fromDelivery.prefill,
                project_id:
                  fromDelivery.prefill.project_id && currentProjectIds.has(fromDelivery.prefill.project_id) ? fromDelivery.prefill.project_id : null,
              }
            : undefined
        }
        action={createApproval}
        projects={projectOptions}
        activities={activities.map((a) => ({
          id: a.id,
          project_id: a.project_id,
          name: a.name,
          responsible: a.responsible ?? [],
        }))}
        adminGroups={adminGroups ?? []}
        teachers={teachers ?? []}
        learningAreas={learningAreas ?? []}
        unitSuggestions={unitSuggestions}
        itemNameSuggestions={itemSuggestions.names}
        itemDefaults={itemSuggestions.defaults}
      />
    </div>
  );
}
