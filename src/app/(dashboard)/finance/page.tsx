// หน้ารวมงานการเงิน — การ์ดไปหน้าย่อยทั้งหมดใต้กลุ่ม "การเงินและบัญชี" (แบบเดียวกับหน้ารวมอื่นของระบบ)
// สิทธิ์ของแต่ละหน้าย่อยยังตรวจที่หน้าปลายทางเอง การ์ดนี้เป็นแค่ทางเข้า

import { HubCardGrid } from "@/components/hub-cards";
import { CoinsIcon, FileTextIcon, WalletIcon } from "@/components/icons";

export default function FinanceHubPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">งานการเงิน</h1>
          <p className="page-subtitle">บัญชีรับ-จ่าย สัญญายืมเงิน ภาษีหัก ณ ที่จ่าย แบบฟอร์มการเงิน และสลิปเงินเดือน</p>
        </div>
      </div>
      <HubCardGrid
        cards={[
          {
            key: "ledger",
            title: "บัญชีรับ-จ่ายเงิน",
            description: "บันทึกรับ-จ่ายแยกประเภทเงิน · รายงานเงินคงเหลือประจำวัน · ทะเบียนคุมเงิน · ยืมเงินระหว่างประเภทเงิน",
            href: "/finance/ledger",
            icon: <CoinsIcon className="h-6 w-6" />,
          },
          {
            key: "loans",
            title: "สัญญายืมเงิน",
            description: "ทำสัญญายืมเงิน ติดตามการอนุมัติ ส่งใช้เงินยืม และเชื่อมกับรายงานการเดินทางไปราชการ (แบบ 8708)",
            href: "/finance/loans",
            icon: <WalletIcon className="h-6 w-6" />,
          },
          {
            key: "withholding",
            title: "ภาษีหัก ณ ที่จ่าย",
            description: "หนังสือรับรองการหักภาษี ณ ที่จ่าย",
            href: "/supplies/withholding-tax",
            icon: <CoinsIcon className="h-6 w-6" />,
          },
          {
            key: "forms",
            title: "แบบฟอร์มการเงิน",
            description: "ใบสำคัญรับเงินนักเรียน · รายงานการเดินทางไปราชการ (แบบ 8708) · ดาวน์โหลดแบบฟอร์มการเงินของโรงเรียน",
            href: "/finance/forms",
            icon: <FileTextIcon className="h-6 w-6" />,
          },
          {
            key: "salary-slip",
            title: "สลิปเงินเดือน",
            description: "เปิดดูสลิปเงินเดือนจากระบบของสำนักงานเขตพื้นที่การศึกษา ด้วยเลขบัตรประชาชนและเดือน/ปี",
            href: "/finance/salary-slip",
            icon: <CoinsIcon className="h-6 w-6" />,
          },
        ]}
      />
    </div>
  );
}
