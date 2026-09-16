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
  // ไฟล์ถูกอัปโหลดตรงจาก browser ไปยัง Supabase Storage มาแล้ว (ดู client-upload.ts — ทำแบบนี้เพื่อให้
  // แสดง % ความคืบหน้าได้จริง) แอ็กชันนี้แค่บันทึกแถวอ้างอิงไฟล์ที่อัปโหลดเสร็จแล้ว ไม่ต้องอัปโหลดซ้ำ
  const uploadedRef = String(formData.get("uploaded_ref") ?? "").trim();

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

  if (uploadedRef) {
    const { error } = await supabase.from("proc_documents").insert({
      file_name: fileName || uploadedRef.split("/").pop() || "เอกสาร",
      file_url: uploadedRef,
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

// แก้ไขรายการเดิม — เปลี่ยนชื่อไฟล์ได้เสมอ และถ้าเดิมเป็นลิงก์ภายนอกก็แก้ลิงก์ได้ ถ้าเดิมเป็นไฟล์
// ที่อัปโหลดไว้ก็อัปโหลดไฟล์ใหม่แทนที่ไฟล์เดิมได้ (ลบไฟล์เก่าออกจาก storage หลังอัปโหลดไฟล์ใหม่สำเร็จ)
export async function updateDocument(id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const fileName = String(formData.get("file_name") ?? "").trim();
  if (!fileName) return { error: "กรุณาระบุชื่อไฟล์เอกสาร" };

  const link = String(formData.get("link") ?? "").trim();
  const file = formData.get("file") as File | null;
  const uploadedRef = String(formData.get("uploaded_ref") ?? "").trim();

  const { data: current, error: fetchError } = await supabase
    .from("proc_documents")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!current) return { error: "ไม่พบรายการนี้" };

  if (link) {
    if (!isExternalLink(link)) return { error: "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://" };
    // ถ้าของเดิมเป็นไฟล์ที่ระบบอัปโหลดไว้ (ไม่ใช่ลิงก์) แล้วเปลี่ยนมาใช้ลิงก์แทน ลบไฟล์เก่าออกจาก storage ด้วย
    if (!isExternalLink(current.file_url)) await deleteFromStorage(supabase, current.file_url, BUCKET);
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, file_url: link }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/documents");
    return {};
  }

  // ไฟล์ใหม่ถูกอัปโหลดตรงจาก browser ไปยัง Supabase Storage มาแล้ว (ดู client-upload.ts) — แค่บันทึก
  // แถวให้ชี้ไปไฟล์ใหม่ ไม่ต้องอัปโหลดซ้ำ
  if (uploadedRef) {
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, file_url: uploadedRef }).eq("id", id);
    if (error) return { error: error.message };
    if (!isExternalLink(current.file_url)) await deleteFromStorage(supabase, current.file_url, BUCKET);
    revalidatePath("/documents");
    return {};
  }

  if (file && file.size > 0) {
    const ext = file.name.split(".").pop();
    const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
    const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, file_url: ref }).eq("id", id);
    if (error) return { error: error.message };
    // ลบไฟล์เก่าหลังอัปโหลด/บันทึกไฟล์ใหม่สำเร็จแล้วเท่านั้น กันกรณีบันทึกไม่สำเร็จแล้วไฟล์เก่าหายไปด้วย
    if (!isExternalLink(current.file_url)) await deleteFromStorage(supabase, current.file_url, BUCKET);
    revalidatePath("/documents");
    return {};
  }

  // ไม่ได้เปลี่ยนไฟล์/ลิงก์ — แก้แค่ชื่อ
  const { error } = await supabase.from("proc_documents").update({ file_name: fileName }).eq("id", id);
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
