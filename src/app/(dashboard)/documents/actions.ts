"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";
import { driveFinalizeUpload, driveGetMeta, driveStartResumableUpload } from "@/lib/storage/google-drive";
import { extensionFromMime, fileExtension } from "@/lib/file-type";
import { driveFileId, isDriveRef, isExternalLink } from "@/lib/storage/ref";

const BUCKET = "procurement-files";

// ปลายทาง Google Drive: browser อัปโหลดไฟล์ตรงไป Drive เอง ไม่ส่งผ่าน Server Action — Vercel ตัด
// request ที่ใหญ่เกิน ~4.5MB ทิ้งด้วย 413 ก่อนโค้ดในแอ็กชันจะได้ทำงาน (ผู้ใช้เห็นแค่ "An unexpected
// response was received from the server")
export async function startDocumentDriveUpload(
  fileName: string,
  mimeType: string,
  size: number,
): Promise<{ uploadUrl?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "ไม่สามารถระบุที่มาของคำขอได้" };
  try {
    const uploadUrl = await driveStartResumableUpload(supabase, { fileName, mimeType, size, origin });
    return { uploadUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "เปิดการอัปโหลดไป Google Drive ไม่สำเร็จ" };
  }
}

async function finalizeIfDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ref: string,
): Promise<string | null> {
  if (!isDriveRef(ref)) return null;
  try {
    await driveFinalizeUpload(supabase, driveFileId(ref));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "ตั้งค่าไฟล์บน Google Drive ไม่สำเร็จ";
  }
}

async function insertDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: { file_name: string; file_url: string; file_type: string | null; category: string | null; uploaded_by: string | null },
): Promise<{ error?: string }> {
  // รายการใหม่ต่อท้ายลำดับเดิมเสมอ (ผู้ใช้เลื่อนขึ้น/ลงเองได้ภายหลัง)
  const { data: last } = await supabase
    .from("proc_documents")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("proc_documents")
    .insert({ ...row, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return { error: error.message };
  revalidatePath("/documents");
  return {};
}

// นามสกุลไฟล์ต้นฉบับ (client ส่งมาเพราะ ref ของ Google Drive ไม่มีนามสกุลติดมา)
function readFileType(formData: FormData): string | null {
  return fileExtension(`.${String(formData.get("file_type") ?? "").trim()}`);
}

function readCategory(formData: FormData): string | null {
  return String(formData.get("category") ?? "").trim() || null;
}


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

    return insertDocument(supabase, {
      file_name: fileName,
      file_url: link,
      file_type: null,
      category: readCategory(formData),
      uploaded_by: user?.id ?? null,
    });
  }

  if (uploadedRef) {
    const finalizeError = await finalizeIfDrive(supabase, uploadedRef);
    if (finalizeError) return { error: finalizeError };
    return insertDocument(supabase, {
      file_name: fileName || "เอกสาร",
      file_url: uploadedRef,
      file_type: readFileType(formData),
      category: readCategory(formData),
      uploaded_by: user?.id ?? null,
    });
  }

  if (!file || file.size === 0) return { error: "กรุณาเลือกไฟล์ หรือวางลิงก์แทน" };

  const ext = file.name.split(".").pop();
  const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });

  return insertDocument(supabase, {
    file_name: fileName || file.name,
    file_url: ref,
    file_type: fileExtension(file.name),
    category: readCategory(formData),
    uploaded_by: user?.id ?? null,
  });
}

// แก้ไขรายการเดิม — เปลี่ยนชื่อไฟล์ได้เสมอ และถ้าเดิมเป็นลิงก์ภายนอกก็แก้ลิงก์ได้ ถ้าเดิมเป็นไฟล์
// ที่อัปโหลดไว้ก็อัปโหลดไฟล์ใหม่แทนที่ไฟล์เดิมได้ (ลบไฟล์เก่าออกจาก storage หลังอัปโหลดไฟล์ใหม่สำเร็จ)
export async function updateDocument(id: string, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();

  const fileName = String(formData.get("file_name") ?? "").trim();
  if (!fileName) return { error: "กรุณาระบุชื่อไฟล์เอกสาร" };
  const category = readCategory(formData);

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
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, category, file_url: link, file_type: null }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/documents");
    return {};
  }

  // ไฟล์ใหม่ถูกอัปโหลดตรงจาก browser ไปยัง Supabase Storage มาแล้ว (ดู client-upload.ts) — แค่บันทึก
  // แถวให้ชี้ไปไฟล์ใหม่ ไม่ต้องอัปโหลดซ้ำ
  if (uploadedRef) {
    const finalizeError = await finalizeIfDrive(supabase, uploadedRef);
    if (finalizeError) return { error: finalizeError };
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, category, file_url: uploadedRef, file_type: readFileType(formData) }).eq("id", id);
    if (error) return { error: error.message };
    if (!isExternalLink(current.file_url)) await deleteFromStorage(supabase, current.file_url, BUCKET);
    revalidatePath("/documents");
    return {};
  }

  if (file && file.size > 0) {
    const ext = file.name.split(".").pop();
    const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
    const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });
    const { error } = await supabase.from("proc_documents").update({ file_name: fileName, category, file_url: ref, file_type: fileExtension(file.name) }).eq("id", id);
    if (error) return { error: error.message };
    // ลบไฟล์เก่าหลังอัปโหลด/บันทึกไฟล์ใหม่สำเร็จแล้วเท่านั้น กันกรณีบันทึกไม่สำเร็จแล้วไฟล์เก่าหายไปด้วย
    if (!isExternalLink(current.file_url)) await deleteFromStorage(supabase, current.file_url, BUCKET);
    revalidatePath("/documents");
    return {};
  }

  // ไม่ได้เปลี่ยนไฟล์/ลิงก์ — แก้แค่ชื่อ
  const { error } = await supabase.from("proc_documents").update({ file_name: fileName, category }).eq("id", id);
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

// เลื่อนรายการขึ้น/ลงหนึ่งตำแหน่ง — เรียงเลขลำดับใหม่ทั้งชุด (1..n) ทุกครั้ง กันเลขซ้ำ/ช่องว่าง
export async function moveDocument(id: string, direction: "up" | "down"): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: rows, error: fetchError } = await supabase
    .from("proc_documents")
    .select("id")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (fetchError) return { error: fetchError.message };

  const ids = (rows ?? []).map((r) => r.id);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return {};
  [ids[index], ids[target]] = [ids[target], ids[index]];

  const results = await Promise.all(
    ids.map((docId, i) => supabase.from("proc_documents").update({ sort_order: i + 1 }).eq("id", docId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };
  revalidatePath("/documents");
  return {};
}

// เติมประเภทไฟล์ให้รายการเก่าที่อยู่บน Google Drive แต่ชื่อที่ตั้งไว้ไม่มีนามสกุล — ถามชื่อ/ชนิดไฟล์
// จาก Drive ครั้งเดียวแล้วบันทึกไว้ (หน้าเว็บเรียกเฉพาะตอนยังมีรายการที่ไม่มี file_type)
export async function backfillDocumentFileTypes(): Promise<{ updated: number }> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("proc_documents")
    .select("id, file_url")
    .is("file_type", null)
    .like("file_url", "gdrive:%");
  let updated = 0;
  for (const row of rows ?? []) {
    try {
      const meta = await driveGetMeta(supabase, driveFileId(row.file_url));
      const ext = fileExtension(meta.name) ?? extensionFromMime(meta.mimeType);
      if (!ext) continue;
      const { error } = await supabase.from("proc_documents").update({ file_type: ext }).eq("id", row.id);
      if (!error) updated++;
    } catch {
      // ไฟล์อาจถูกลบจาก Drive ไปแล้ว — ข้ามไป แสดงเป็นป้าย "ไฟล์" ทั่วไป
    }
  }
  return { updated };
}
