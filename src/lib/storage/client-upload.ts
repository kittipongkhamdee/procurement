"use client";

// อัปโหลดไฟล์ตรงจากเบราว์เซอร์ไป Supabase Storage (ข้าม Server Action) เพื่อให้แสดง % ความคืบหน้า
// การอัปโหลดได้จริง — Server Action ของ Next.js ไม่มีกลไกรายงานความคืบหน้ากลับมาที่ client เลย
// (fetch ที่ Next ใช้ส่ง action ไม่ส่ง progress event ของฝั่งอัปโหลด) จึงต้องอัปโหลดตรงด้วย
// XMLHttpRequest (มี upload.onprogress) แล้วค่อยเรียก server action แยกอีกทีแค่บันทึกแถวอ้างอิงไฟล์
// ที่อัปโหลดเสร็จแล้วลงตาราง (ไม่ต้องอัปโหลดไฟล์ซ้ำ)
//
// ใช้ได้เฉพาะปลายทาง Supabase Storage เท่านั้น — ไม่รองรับ Google Drive provider เพราะต้องอัปโหลด
// ผ่าน service account ที่รันได้แค่ฝั่ง server เท่านั้น (ดู storage_provider ใน proc_app_settings)

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

function fetchWithProgress(onProgress: (percent: number) => void): typeof fetch {
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      xhr.open(method, url, true);

      const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
      if (headers) {
        const entries = headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers as Record<string, string>);
        for (const [key, value] of entries) xhr.setRequestHeader(key, value);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
      xhr.onerror = () => reject(new TypeError("Network request failed"));

      xhr.send((init?.body ?? null) as XMLHttpRequestBodyInit | null);
    });
}

/** อัปโหลด `file` ไปที่ `bucket`/`path` ของ Supabase Storage โดยตรง พร้อมรายงาน % ผ่าน onProgress —
 * สร้าง client instance แยก (isSingleton: false) สลับ fetch เป็นตัวที่ห่อ XHR ไว้เฉพาะตอนนี้ ยังคง
 * ใช้ auth session เดิม (createBrowserClient อ่าน session จาก cookie เดียวกันเสมอ) ให้ RLS ทำงาน
 * เหมือนตอนอัปโหลดผ่าน server action ทุกประการ */
export async function uploadFileToSupabaseWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ error?: string }> {
  const client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, global: { fetch: fetchWithProgress(onProgress) } },
  );
  const { error } = await client.storage.from(bucket).upload(path, file, { contentType: file.type || undefined });
  if (error) return { error: error.message };
  return {};
}
