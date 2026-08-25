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
      layout.tsx                sidebar + โหลด role ผู้ใช้
      page.tsx                   แดชบอร์ด (การ์ดสรุปยอด)
      vendors/                    ตัวอย่างโมดูลที่เขียนครบ (list + add + delete ผ่าน Server Action)
      purchase-requests/          ตัวอย่างอ่านข้อมูล join กับผู้ขาย
      projects/                   อ่านโครงการจาก plan_projects (ตารางที่มีอยู่แล้ว)
  lib/supabase/
    client.ts                  Supabase client ฝั่ง browser
    server.ts                  Supabase client ฝั่ง Server Component/Action
    middleware.ts               ตรรกะ refresh session + gate หน้าที่ต้องล็อกอิน
    database.types.ts           TypeScript types ที่ generate จากสคีมาจริงใน Supabase
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

## สิ่งที่ยังต้องพัฒนาต่อ (ยังไม่ได้ทำในรอบ scaffold นี้)

- ฟอร์มบันทึกรายการขอซื้อ-ขอจ้าง/ขออนุมัติแบบเต็ม (พร้อมตารางรายการวัสดุ 15 แถว)
- สร้าง PDF (แนะนำ `@react-pdf/renderer` หรือ Puppeteer แทน Google Slides template เดิม)
- อัปโหลดไฟล์ผ่าน Supabase Storage (แทน Google Drive folder + `ANYONE_WITH_LINK`)
- โมดูลสัญญา/ส่งมอบงาน/การเงิน/คลังเอกสาร/รายงานโครงการ (ตามรูปแบบเดียวกับ `vendors/`)
- Sign-up flow และหน้าแก้ไข role สำหรับแอดมิน

## Deploy ขึ้น Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel deploy --prod
```
