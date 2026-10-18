import { notFound } from "next/navigation";

// หน้าชั่วคราวของเมนูงานพัสดุที่ยังไม่ได้พัฒนา (ลิงก์จากเมนูด้านซ้ายใน layout.tsx) —
// เมื่อสร้างหน้าจริงของเมนูไหน ให้สร้างโฟลเดอร์ /supplies/<slug> แยกของตัวเอง (จะถูกใช้แทนหน้านี้อัตโนมัติ)
// แล้วลบ slug นั้นออกจากรายการด้านล่าง
const PAGES: Record<string, { title: string; description: string }> = {
  textbooks: { title: "หนังสือเรียน (เรียนฟรี 15 ปี)", description: "จัดซื้อหนังสือเรียนตามโครงการสนับสนุนค่าใช้จ่ายในการจัดการศึกษา" },
  "quarterly-announcements": { title: "ประกาศผลรายไตรมาส", description: "สรุปผลการจัดซื้อจัดจ้างรายไตรมาสเพื่อประกาศเผยแพร่" },
  "withholding-tax": { title: "ภาษีหัก ณ ที่จ่าย", description: "หนังสือรับรองการหักภาษี ณ ที่จ่าย" },
  loans: { title: "ยืม-คืนพัสดุ", description: "บันทึกการยืมและคืนพัสดุ" },
  prices: { title: "ราคาพัสดุ", description: "ราคากลาง/ราคาอ้างอิงของพัสดุที่ใช้บ่อย" },
  "audit-log": { title: "ประวัติการแก้ไข", description: "ประวัติการเพิ่ม/แก้ไข/ลบข้อมูลในระบบ" },
};

export default async function SuppliesPlaceholderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{page.title}</h1>
          <p className="page-subtitle">{page.description}</p>
        </div>
      </div>
      <div className="card text-center text-sm text-slate-500">อยู่ระหว่างพัฒนา</div>
    </div>
  );
}
