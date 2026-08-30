import { createClient } from "@/lib/supabase/server";
import { NamedListManager } from "@/components/named-list-manager";
import { createStrategy, deleteStrategy, toggleStrategyActive, updateStrategyName } from "./actions";

export default async function StrategiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (myProfile?.role !== "admin") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        หน้านี้สำหรับผู้ดูแลระบบ (admin) เท่านั้น
      </div>
    );
  }

  const { data: strategies } = await supabase
    .from("plan_strategies")
    .select("id, name, is_active")
    .order("sort_order")
    .order("name");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">กลยุทธ์โรงเรียน</h1>
          <p className="page-subtitle">กำหนดรายการกลยุทธ์โรงเรียนสำหรับใช้อ้างอิงในการเสนอโครงการ</p>
        </div>
      </div>

      <NamedListManager
        title="รายการกลยุทธ์โรงเรียน"
        itemLabel="ชื่อกลยุทธ์"
        placeholder="เช่น กลยุทธ์ที่ 1 พัฒนาคุณภาพและศักยภาพผู้เรียน"
        items={strategies ?? []}
        createItem={createStrategy}
        updateItemName={updateStrategyName}
        toggleItemActive={toggleStrategyActive}
        deleteItem={deleteStrategy}
      />
    </div>
  );
}
