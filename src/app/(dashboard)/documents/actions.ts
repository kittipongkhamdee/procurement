"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import { isExternalLink } from "@/lib/storage/ref";

const BUCKET = "procurement-files";

export async function uploadDocument(formData: FormData) {
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
    if (!isExternalLink(link)) throw new Error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
    if (!fileName) throw new Error("กรุณาระบุชื่อไฟล์เอกสาร (จำเป็นเมื่อวางลิงก์แทนการอัปโหลด)");

    const { error } = await supabase.from("proc_documents").insert({
      file_name: fileName,
      file_url: link,
      uploaded_by: user?.id ?? null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/documents");
    return;
  }

  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์ หรือวางลิงก์แทน");

  const ext = file.name.split(".").pop();
  const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });

  const { error } = await supabase.from("proc_documents").insert({
    file_name: fileName || file.name,
    file_url: ref,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/documents");
}

export async function deleteDocument(id: string, ref: string) {
  const supabase = await createClient();
  // ลิงก์ภายนอกที่ผู้ใช้วางเอง ระบบไม่ได้เป็นเจ้าของไฟล์ ไม่ต้อง (และลบไม่ได้) เรียก deleteFromStorage
  if (!isExternalLink(ref)) await deleteFromStorage(supabase, ref, BUCKET);
  const { error } = await supabase.from("proc_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
}
