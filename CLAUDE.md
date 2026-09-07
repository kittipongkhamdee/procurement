@AGENTS.md

## ข้อควรจำ: ขนาดตัวหนังสือในตาราง

`.table-base tbody td` มีค่าเริ่มต้นเป็น `text-sm` (14px) ส่วน badge (`.badge-*`) และลิงก์บางจุดที่ก็อป
มาจากหน้าการ์ดมือถือ มักใช้ `text-xs` (12px) ติดมาด้วย ทำให้ในตารางจอกว้างดูตัวหนังสือเล็กกว่าเซลล์อื่น
ในแถวเดียวกัน (เจอแล้วที่ `/evaluations`, `/project-reports`, `/projects`, `/project-proposals`) —
เวลาสร้างหรือแก้ตารางจอกว้างใหม่ ให้เช็คว่า badge/ลิงก์ในแถวมีขนาดเท่ากับเซลล์ข้างเคียงหรือไม่
ถ้าฟังก์ชัน/คอมโพเนนต์เดียวกันถูกใช้ทั้งการ์ดมือถือ (ตั้งใจให้เล็ก) และตารางจอกว้าง (ต้องเท่ากับ
เซลล์อื่น) ให้เพิ่ม prop ขนาดตัวหนังสือแบบ optional (เช่น `textSizeClass`, default `"text-xs"`) แทน
การเปลี่ยนค่าเริ่มต้นตรงๆ

## ข้อควรจำ: ขนาดฟอนต์/ระยะห่างบรรทัดในเอกสาร PDF (react-pdf)

ผู้ใช้กำหนดค่ามาตรฐานไว้แล้วจากการปรับ `src/lib/pdf/project-report-document.tsx` — ให้ใช้ค่าเดียวกัน
นี้เวลาสร้าง/แก้เอกสาร PDF หน้าอื่น (`src/lib/pdf/approval-document.tsx`,
`src/lib/pdf/purchase-request-document.tsx` และไฟล์ใหม่ในอนาคต):

- ขนาดฟอนต์: ข้อความทั่วไปในเนื้อหา 11pt, หัวเรื่องใหญ่ (ชื่อเอกสาร) 14pt, หัวข้อย่อยแต่ละหมวด 11pt,
  ตัวเลขในตาราง (ตัวชี้วัด/งบประมาณ ฯลฯ) 11pt
- ระยะห่างบรรทัด/ย่อหน้า: อ้างอิงความห่างแบบ label/value row (`row: { marginBottom: 4 }`) เป็นมาตรฐาน
  — อย่าใส่ `marginBottom` ซ้ำทุกบรรทัดย่อยที่ตัดขึ้นบรรทัดใหม่ในย่อหน้าเดียวกัน (ทำให้ดูห่างเหมือนเว้น
  บรรทัดคู่) ให้ครอบทั้งย่อหน้าด้วย View แล้วใส่ `marginBottom`ที่ View ครั้งเดียว, ใช้ `lineHeight`
  ประมาณ 1.2 สำหรับข้อความ/รายการหัวข้อย่อย, หัวข้อย่อยแต่ละหมวด (`subtitle`) ใช้ `marginTop: 6,
  marginBottom: 4`, ตารางตัวชี้วัด/รายการใช้ `marginBottom: 4`

## ข้อควรจำ: ปุ่มดำเนินการต้องเป็นปุ่มจริง ไม่ใช่ลิงก์ตัวหนังสือ

ทุกครั้งที่สร้าง/แก้ "ปุ่ม" สำหรับดำเนินการ (ดู/พิมพ์ PDF, ดาวน์โหลด Word, แก้ไข, ลบ ฯลฯ) โดยเฉพาะใน
ตารางจอกว้าง ให้ใช้สไตล์ปุ่มจริง (`btn-secondary btn-sm` / `btn-danger btn-sm` ตาม globals.css) แทน
ลิงก์ตัวหนังสือธรรมดา (`text-xs/sm ... hover:underline`) — ดูตัวอย่างที่ `/project-reports` (fileLink /
wordLink / DeleteReportButton มี parameter `asButton` สลับสไตล์ระหว่างการ์ดมือถือกับตารางจอกว้าง)
ถ้าฟังก์ชัน/คอมโพเนนต์เดียวกันถูกใช้ทั้งการ์ดมือถือ (ลิงก์ตัวหนังสือเรียบง่ายพอแล้ว) และตารางจอกว้าง
(ต้องเป็นปุ่ม) ให้เพิ่ม prop แบบ optional (เช่น `asButton`, default `false`) แทนการเปลี่ยนทุกจุดเป็นปุ่ม
หมด

## ข้อควรจำ: ช่องกรอกวันที่ต้องใช้ `ThaiDatePicker` ไม่ใช่ `input type="date"`

`input type="date"` ของเบราว์เซอร์ส่วนใหญ่แสดงปฏิทินเป็น ค.ศ. ให้กรอกเอง ไม่ใช่ พ.ศ. — ระบบนี้ใช้
วันที่แบบไทย (พ.ศ.) ทั่วทั้งระบบ ทุกครั้งที่สร้าง/แก้ช่องกรอกวันที่ ให้ใช้คอมโพเนนต์
`ThaiDatePicker` (`@/components/thai-date-picker`) แทน ไม่ใช่ `<input type="date">` ตรงๆ — ปฏิทิน
กำหนดเดือน/ปี พ.ศ. แบบ dropdown พร้อมปุ่มลัด "วันนี้/+3 วัน/+7 วัน/+15 วัน/+30 วัน" (ดูตัวอย่างการใช้ที่
`src/app/(dashboard)/asset-register/register-tab.tsx` ช่อง "วัน/เดือน/ปีที่ได้มา")

ใช้แบบ uncontrolled ในฟอร์ม `<form>` ปกติ: `<ThaiDatePicker name="acquired_date"
defaultValue={item?.acquired_date ?? null} />` — จะ render hidden input ชื่อนั้นด้วยค่า ISO date
(ค.ศ.) ให้อัตโนมัติ อ่านค่าฝั่ง server action ด้วย `formData.get("acquired_date")` ได้เลยเหมือน input
ธรรมดา (ไม่ต้องแยกกรอกวัน/เดือน/ปีเป็นช่องละคอลัมน์เอง)

ยังมีจุดอื่นในระบบที่ใช้ `input type="date"` เดิมอยู่ (`project-reports/project-report-form.tsx`,
`deliveries/delivery-form.tsx`, `purchase-requests/new/purchase-request-form.tsx`,
`approvals/approval-form.tsx`, `contracts/page.tsx`) — ยังไม่ได้ปรับ รอทยอยเปลี่ยนเป็น
`ThaiDatePicker` เมื่อได้แก้ไขหน้านั้นๆ ครั้งต่อไป
