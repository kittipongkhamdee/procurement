import { ProcurementList } from "../procurement-list";

// ว.804 — ซื้อครั้งละไม่เกิน 50,000 บาท ตามหนังสือ กค (กวจ) 0405.2/ว 804 ลว. 12 พ.ย. 2568
export default function Page() {
  return (
    <ProcurementList
      type="ซื้อ"
      w804
      title="ว.804 ซื้อไม่เกิน 50,000"
      subtitle="จัดซื้อวงเงินไม่เกิน 50,000 บาท ตามแนวทางปฏิบัติ ว 804 (มอบหมายผู้รับผิดชอบซื้อและตรวจรับ)"
    />
  );
}
