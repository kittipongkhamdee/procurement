import { createClient } from "@/lib/supabase/server";
import { createPurchaseRequest } from "../actions";
import { PurchaseRequestForm } from "./purchase-request-form";

export default async function NewPurchaseRequestPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: activities }, { data: vendors }] = await Promise.all([
    supabase.from("plan_projects").select("id, name").order("sort_order"),
    supabase.from("plan_activities").select("id, name, project_id").order("sort_order"),
    supabase.from("proc_vendors").select("*").order("name"),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        แบบบันทึกขอซื้อ/ขอจ้าง
      </h1>
      <PurchaseRequestForm
        action={createPurchaseRequest}
        projects={projects ?? []}
        activities={activities ?? []}
        vendors={vendors ?? []}
      />
    </div>
  );
}
