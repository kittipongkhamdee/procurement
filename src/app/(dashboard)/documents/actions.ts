"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import { isExternalLink } from "@/lib/storage/ref";

const BUCKET = "procurement-files";

// คืนค่า { error } แทนการ throw — ข้อความ error ที่ throw จาก Server Action ถูก Next.js ปิดบัง
// (redact) ในโปรดักชัน ฝั่ง client จะเห็นแค่ "Minified React error #441" อ่านไม่รู้เรื่อง แทนข้อความ
// จริงที่ตั้งใจให้ผู้ใช้เห็น (แพทเทิร์นเดียวกับ deleteProject ใน projects/actions.ts)
export async function uploadDocument(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File | null;
  const fileName = String(formData.get("file_name") ?? "").trim();
  // วางลิงก์ภายนอกแทนการอัปโหลดไฟล์ (เช่น แชร์ลิงก์จาก Google Drive ของตัวเอง) — เมื่อไฟล์ต้นทาง
  // เปลี่ยนแปลง ไม่ต้องมาลบ/อัปโหลดใหม่ในระบบนี้ เพราะระบบแค่เก็บลิงก์ไว้ ไม่ได้เก็บไฟล์เอง
  const link = String(formData.get("link") ?? "").trim();

  if (link) {
    if (!isExternalLink(link)) return { error: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" };
    if (!fileName) return { error: "กรุณาระบุชื่อไฟล์เอกสาร (จำเป็นเมื่อวางลิงก์แทนการอัปโหลด)" };

    const { error } = await supabase.from("proc_documents").insert({
      file_name: fileName,
      file_url: link,
      uploaded_by: user?.id ?? null,
    });
    if (error) return { error: error.message };
    revalidatePath("/documents");
    return {};
  }

  if (!file || file.size === 0) return { error: "กรุณาเลือกไฟล์ หรือวางลิงก์แทน" };

  const ext = file.name.split(".").pop();
  const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });

  const { error } = await supabase.from("proc_documents").insert({
    file_name: fileName || file.name,
    file_url: ref,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/documents");
  return {};
}

export async function deleteDocument(id: string, ref: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  // ลิงก์ภายนอกที่ผู้ใช้วางเอง ระบบไม่ได้เป็นเจ้าของไฟล์ ไม่ต้อง (และลบไม่ได้) เรียก deleteFromStorage
  if (!isExternalLink(ref)) await deleteFromStorage(supabase, ref, BUCKET);
  const { error } = await supabase.from("proc_documents").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/documents");
  return {};
}
