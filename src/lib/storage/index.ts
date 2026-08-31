import type { createClient } from "@/lib/supabase/server";
import { driveUpload, driveDelete, driveRename, driveDownload, testDriveConnection } from "./google-drive";
import { isDriveRef, driveFileId, encodeDriveRef, driveViewUrl } from "./ref";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export { isDriveRef, driveFileId, displayNameForRef } from "./ref";

export async function getStorageProvider(supabase: SupabaseServerClient): Promise<"supabase" | "google_drive"> {
  const { data } = await supabase
    .from("proc_app_settings")
    .select("value")
    .eq("key", "storage_provider")
    .maybeSingle();
  return data?.value === "google_drive" ? "google_drive" : "supabase";
}

/** อัปโหลดไฟล์ตามผู้ให้บริการที่ตั้งค่าไว้ในปัจจุบัน คืนค่า ref (พาธ Supabase หรือ gdrive:{fileId}) */
export async function uploadToStorage(
  supabase: SupabaseServerClient,
  opts: { file: File; bucket: string; path: string },
): Promise<string> {
  const provider = await getStorageProvider(supabase);
  if (provider === "google_drive") {
    const buffer = Buffer.from(await opts.file.arrayBuffer());
    const fileName = opts.path.split("/").pop() ?? opts.file.name;
    const fileId = await driveUpload(supabase, buffer, fileName, opts.file.type);
    return encodeDriveRef(fileId);
  }
  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(opts.path, opts.file, { contentType: opts.file.type || undefined });
  if (error) throw new Error(error.message);
  return opts.path;
}

export async function deleteFromStorage(supabase: SupabaseServerClient, ref: string | null, bucket: string): Promise<void> {
  if (!ref) return;
  if (isDriveRef(ref)) {
    await driveDelete(supabase, driveFileId(ref));
    return;
  }
  await supabase.storage.from(bucket).remove([ref]);
}

/** ตั้งชื่อไฟล์ใหม่ (คงนามสกุลเดิม) — ไฟล์ Supabase จะถูกย้ายไปพาธใหม่ในโฟลเดอร์ที่กำหนด ส่วนไฟล์ Google Drive จะถูกเปลี่ยนชื่อโดยไม่ย้ายตำแหน่ง */
export async function renameStorageFile(
  supabase: SupabaseServerClient,
  ref: string | null,
  bucket: string,
  folderPrefix: string,
  baseName: string,
): Promise<string | null> {
  if (!ref) return null;
  if (isDriveRef(ref)) {
    await driveRename(supabase, driveFileId(ref), baseName);
    return ref;
  }
  const ext = ref.split(".").pop();
  const newPath = `${folderPrefix}/${baseName}${ext ? `.${ext}` : ""}`;
  if (newPath === ref) return ref;
  const { error } = await supabase.storage.from(bucket).move(ref, newPath);
  return error ? ref : newPath;
}

/** สร้าง URL สำหรับดู/ดาวน์โหลดไฟล์เป็นชุด: ไฟล์ Supabase ใช้ signed URL (หมดอายุใน 1 ชม.) ไฟล์ Google Drive ใช้ลิงก์ดูไฟล์โดยตรง */
export async function resolveStorageUrls(
  supabase: SupabaseServerClient,
  refs: (string | null | undefined)[],
  bucket: string,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const supabasePaths: string[] = [];
  for (const ref of refs) {
    if (!ref) continue;
    if (isDriveRef(ref)) result.set(ref, driveViewUrl(driveFileId(ref)));
    else supabasePaths.push(ref);
  }
  if (supabasePaths.length > 0) {
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(supabasePaths, 3600);
    signed?.forEach((s) => {
      if (s.signedUrl && !s.error) result.set(s.path ?? "", s.signedUrl);
    });
  }
  return result;
}

export async function downloadFromStorage(supabase: SupabaseServerClient, ref: string, bucket: string): Promise<Buffer> {
  if (isDriveRef(ref)) return driveDownload(supabase, driveFileId(ref));
  const { data, error } = await supabase.storage.from(bucket).download(ref);
  if (error || !data) throw new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ");
  return Buffer.from(await data.arrayBuffer());
}

/** ทดสอบว่าปลายทางที่จะสลับไปใช้อัปโหลดไฟล์ได้จริง ก่อนบันทึกการสลับ */
export async function testStorageConnection(
  supabase: SupabaseServerClient,
  provider: "supabase" | "google_drive",
  bucket: string,
): Promise<void> {
  if (provider === "google_drive") {
    await testDriveConnection(supabase);
    return;
  }
  const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
  if (error) throw new Error(`เชื่อมต่อ Supabase Storage ไม่สำเร็จ: ${error.message}`);
}
