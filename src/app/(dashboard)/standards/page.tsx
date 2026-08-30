import { createClient } from "@/lib/supabase/server";
import { NamedListManager } from "@/components/named-list-manager";
import { createStandard, deleteStandard, toggleStandardActive, updateStandardName } from "./actions";

export default async function StandardsPage() {
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

  const { data: standards } = await supabase
    .from("plan_standards")
    .select("id, name, is_active")
    .order("sort_order")
    .order("name");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">มาตรฐานการศึกษา</h1>
          <p className="page-subtitle">กำหนดรายการมาตรฐานการศึกษาของสถานศึกษาสำหรับใช้อ้างอิงในการเสนอโครงการ</p>
        </div>
      </div>

      <NamedListManager
        title="รายการมาตรฐานการศึกษา"
        itemLabel="ชื่อมาตรฐาน"
        placeholder="เช่น มาตรฐานที่ 1 คุณภาพของผู้เรียน"
        items={standards ?? []}
        createItem={createStandard}
        updateItemName={updateStandardName}
        toggleItemActive={toggleStandardActive}
        deleteItem={deleteStandard}
      />
    </div>
  );
}
