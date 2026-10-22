"use client";

// แบบฟอร์มการเงิน — หน้ารวมเป็นการ์ด (ใบสำคัญรับเงินนักเรียน / รายงานการเดินทางไปราชการ) + เอกสารหมวด "การเงิน" จากคลังเอกสารดาวน์โหลด
// ครูทุกคนเข้าได้ — สร้าง/แก้ไขใบสำคัญรับเงินของตัวเองได้ และดาวน์โหลดแบบฟอร์มการเงินได้จากหน้านี้

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { driveFileId, driveViewUrl, isDriveRef, isExternalLink } from "@/lib/storage/ref";
import { fileTypeBadge } from "@/lib/file-type";
import { HubCardGrid } from "@/components/hub-cards";
import { TruckIcon, UsersIcon } from "@/components/icons";

const BUCKET = "procurement-files";
const FINANCE_CATEGORY = "การเงิน";
type Doc = { id: string; file_name: string; file_url: string; file_type: string | null; category: string | null };

export default function FinanceFormsPage() {
  const [counts, setCounts] = useState({ student: 0, travel: 0 });
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("fin_receipt_forms").select("kind"),
      supabase.from("fin_travel_forms").select("id", { count: "exact", head: true }),
      supabase
        .from("proc_documents")
        .select("id, file_name, file_url, file_type, category")
        .ilike("category", `%${FINANCE_CATEGORY}%`)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]).then(async ([f, tr, d]) => {
      const rows = f.data ?? [];
      setCounts({ student: rows.filter((r) => r.kind === "student").length, travel: tr.count ?? 0 });
      const list = (d.data ?? []) as Doc[];
      setDocs(list);
      // ลิงก์ดาวน์โหลด: ลิงก์ภายนอกใช้ตรง, Google Drive เปิดหน้าดู, Supabase ใช้ signed URL (1 ชม.)
      const m = new Map<string, string>();
      const paths: string[] = [];
      for (const x of list) {
        if (isExternalLink(x.file_url)) m.set(x.file_url, x.file_url);
        else if (isDriveRef(x.file_url)) m.set(x.file_url, driveViewUrl(driveFileId(x.file_url)));
        else paths.push(x.file_url);
      }
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
        signed?.forEach((s) => s.signedUrl && !s.error && m.set(s.path ?? "", s.signedUrl));
      }
      setUrls(m);
    });
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">แบบฟอร์มการเงิน</h1>
          <p className="page-subtitle">กรอกและพิมพ์ใบสำคัญรับเงิน · ดาวน์โหลดแบบฟอร์มการเงินของโรงเรียน</p>
        </div>
      </div>
      <HubCardGrid
        cards={[
          {
            key: "student",
            title: "ใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน",
            description: "เอกสารแนบ ๒ — ค่าอาหาร ค่าเช่าที่พัก ค่าพาหนะ ของนักเรียนที่เข้าร่วมกิจกรรม",
            href: "/finance/forms/student",
            icon: <UsersIcon className="h-6 w-6" />,
            value: counts.student.toLocaleString("th-TH"),
            sub: "ฉบับที่บันทึกไว้",
          },
          {
            key: "travel",
            title: "รายงานการเดินทางไปราชการ (แบบ 8708)",
            description: "ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ ส่วนที่ 1 + หลักฐานการจ่ายเงิน ส่วนที่ 2 (เบิกรายบุคคล/เป็นคณะ)",
            href: "/finance/forms/travel",
            icon: <TruckIcon className="h-6 w-6" />,
            value: counts.travel.toLocaleString("th-TH"),
            sub: "ฉบับที่บันทึกไว้",
          },
        ]}
      />

      <div className="card mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">เอกสารดาวน์โหลด หมวดการเงิน</h2>
          <Link href="/documents" className="btn-secondary btn-sm">
            คลังเอกสารดาวน์โหลดทั้งหมด
          </Link>
        </div>
        {docs === null ? (
          <p className="text-sm text-slate-400">กำลังโหลด…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีเอกสารหมวด &quot;{FINANCE_CATEGORY}&quot; — เพิ่มได้ที่คลังเอกสารดาวน์โหลด (ตั้งหมวดหมู่เป็น &quot;{FINANCE_CATEGORY}&quot;)</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => {
              const badge = fileTypeBadge(d.file_type, isExternalLink(d.file_url) ? d.file_url : undefined);
              const href = urls.get(d.file_url);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`inline-flex shrink-0 items-center rounded border px-1 py-0.5 text-[11px] font-semibold leading-none ${badge.className}`}>{badge.label}</span>
                    <span className="text-slate-900">{d.file_name}</span>
                  </span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                      ดาวน์โหลด
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">กำลังเตรียมลิงก์…</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
