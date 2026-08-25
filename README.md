# ระบบบริหารงานงบประมาณ โรงเรียนตาเบาวิทยา (v2)

Next.js 15 (App Router) + Supabase + Vercel — สร้างขึ้นเพื่อทดแทนระบบเดิมที่เป็น Google Apps Script + Google Sheets

## สแตก

- **Next.js 15** (App Router, Server Components, Server Actions) + TypeScript + Tailwind CSS 4
- **Supabase**: Postgres + Auth + Row Level Security แทน Google Sheets และรหัสผ่าน hardcode ในโค้ดเดิม
- **Vercel**: hosting / CI ต่อเนื่องจาก GitHub

โปรเจกต์นี้เชื่อมกับ Supabase project ที่มีอยู่แล้ว (`financial-asset-survey`, id `ztxwmximeobyvvkwbzkt`)
ซึ่งมีตารางแผนงบประมาณ (`plan_projects`, `plan_activities`, `plan_budget_years`, `plan_admin_groups`) อยู่ก่อนแล้ว
ตารางใหม่ของระบบจัดซื้อจัดจ้างทั้งหมด (prefix `proc_`) จะอ้างอิง FK เข้ากับตารางเหล่านี้แทนการสร้างซ้ำ

## เริ่มต้นใช้งาน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 — จะ redirect ไป `/login` อัตโนมัติถ้ายังไม่ได้ล็อกอิน (คุมด้วย `src/proxy.ts`)

ตัวแปรแวดล้อมอยู่ใน `.env.local` แล้ว (คัดลอกจาก `.env.example` ถ้าต้อง deploy ที่ใหม่):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## โครงสร้างโปรเจกต์

```
src/
  app/
    login/                    หน้าล็อกอิน + server actions (login/logout)
    (dashboard)/               กลุ่มหน้าหลังบ้าน (ต้องล็อกอิน)
      layout.tsx                sidebar (จัดกลุ่มตามงานแผนงาน/งานพัสดุ/งานการเงิน) + โหลด role ผู้ใช้
      page.tsx                   แดชบอร์ด (การ์ดสรุปยอดจริงจาก Supabase)
      vendors/                    ข้อมูลผู้ขาย/ผู้รับจ้าง — list + add + delete
      purchase-requests/          รายการขอซื้อ-ขอจ้าง — ฟอร์มเต็ม (15 รายการวัสดุ) + สร้าง PDF + เก็บลง Storage
      contracts/                  งานสัญญาจ้าง
      deliveries/                  บันทึกส่งมอบงาน — เลือกสัญญาแล้ว autofill ยอดเงิน/ผู้ตรวจรับ
      allowance/                  เบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค
      project-disbursements/      เบิกจ่ายงบประมาณโครงการ — มีสถานะ รอเบิกจ่าย/จ่ายแล้ว
      documents/                   คลังเอกสารดาวน์โหลด — อัปโหลดไฟล์ทั่วไป
      project-reports/             รายงานโครงการ — อัปโหลดไฟล์ผูกกับโครงการ
      approvals/                   บันทึกขออนุมัติ — คำนวณงบ/เบิกจ่ายแล้ว/คงเหลือจากโครงการที่เลือก
      projects/                   อ่านโครงการจาก plan_projects (ตารางที่มีอยู่แล้ว)
  lib/
    supabase/
      client.ts                Supabase client ฝั่ง browser
      server.ts                Supabase client ฝั่ง Server Component/Action
      middleware.ts             ตรรกะ refresh session + gate หน้าที่ต้องล็อกอิน
      database.types.ts         TypeScript types ที่ generate จากสคีมาจริงใน Supabase
    pdf/
      purchase-request-document.tsx  เลย์เอาต์ PDF บันทึกข้อความ (ฟอนต์ Sarabun ฝัง)
      build-purchase-request-pdf.tsx  โหลดข้อมูล + render ใช้ร่วมกันระหว่าง route กับ save action
    thai.ts                     ThaiBahtText + แปลงวันที่ พ.ศ. (พอร์ตจากโค้ด .gs เดิม)
  proxy.ts                     Next.js proxy (เดิมชื่อ middleware.ts) เรียก updateSession ทุก request
```

## สคีมาฐานข้อมูล (ตาราง `proc_*`)

| ตาราง | แทนที่ชีตเดิม | หมายเหตุ |
|---|---|---|
| `proc_profiles` | - (ใหม่) | role ผู้ใช้: admin / supply_officer / finance_officer / teacher / director |
| `proc_vendors` | `shop` | ข้อมูลผู้ขาย/ผู้รับจ้าง |
| `proc_purchase_requests` + `proc_purchase_items` | `data` (คอลัมน์ P1-P15 เดิม) | รายการขอซื้อ-ขอจ้าง — normalize รายการวัสดุเป็นตารางลูกแทนคอลัมน์แบน 75 คอลัมน์ |
| `proc_contracts` | `sanya` | สัญญาจ้าง |
| `proc_deliveries` | `sentsanya` | ใบส่งมอบงาน |
| `proc_approvals` + `proc_approval_items` | `approval` | บันทึกขออนุมัติใช้งบ |
| `proc_allowance_disbursements` | `datamoney` | เบิกจ่ายเบี้ยเลี้ยง/สาธารณูปโภค |
| `proc_project_disbursements` | `datamoney2` | เบิกจ่ายงบโครงการ |
| `proc_documents` | `document_db` | คลังเอกสาร |
| `proc_project_reports` | `project_reports` | รายงานโครงการ |

ทุกตารางเปิด RLS: **อ่านได้ทุกคนที่ล็อกอิน**, **เขียน/แก้ไขได้เฉพาะ** `admin` / `supply_officer` / `finance_officer`
(ผ่านฟังก์ชัน `proc_is_staff()`), **ลบได้เฉพาะ** `admin` — แก้ปัญหารหัสผ่าน hardcode (`"1234"`, `"32140"`)
ที่พบในโค้ด Apps Script เดิม

ผู้ใช้ใหม่ที่สมัคร (ผ่าน Supabase Auth) จะได้ role `teacher` โดยอัตโนมัติ (มี trigger `proc_handle_new_user`) —
ต้องให้ `admin` ไปแก้ไข role ในตาราง `proc_profiles` เพื่อให้สิทธิ์เจ้าหน้าที่พัสดุ/การเงิน

## การตั้งค่าผู้ใช้แอดมินคนแรก

1. สร้างผู้ใช้ผ่าน Supabase Dashboard → Authentication → Add user (หรือให้ล็อกอินผ่านหน้าเว็บก่อน ถ้าเปิด sign-up)
2. รัน SQL นี้ใน Supabase SQL editor เพื่อตั้ง role เป็น admin:

```sql
update proc_profiles set role = 'admin' where user_id = '<user-id>';
```

## Storage buckets

| Bucket | ใช้กับ | สิทธิ์ |
|---|---|---|
| `procurement-documents` | PDF ใบบันทึกข้อความขอซื้อ-ขอจ้าง (auto-generate ตอนบันทึก) | staff เขียน, admin ลบ |
| `procurement-files` | คลังเอกสาร + รายงานโครงการ (อัปโหลดไฟล์อิสระ) | staff เขียน, admin ลบ |

ทั้งสอง bucket เป็น **private** — หน้า list เรียก `createSignedUrls()` สร้างลิงก์ชั่วคราว (1 ชม.) ทุกครั้งที่ render แทนการเก็บลิงก์สาธารณะถาวร (`pdf_url`/`file_url` ในตารางเก็บแค่ storage path)

## สิ่งที่ยังต้องพัฒนาต่อ

- สร้าง PDF สำหรับบันทึกขออนุมัติ (`approvals/`) — ตอนนี้มีแค่ purchase-requests
- Sign-up flow และหน้าแก้ไข role สำหรับแอดมิน (ตอนนี้ต้องรัน SQL มือเพื่อตั้ง role)
- Dashboard ยังไม่มีการ์ดสรุปสำหรับโมดูลใหม่ (สัญญา/ส่งมอบงาน/เบิกจ่าย) เพิ่มแค่ purchase-requests

## Deploy ขึ้น Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel deploy --prod
```
