import { google } from "googleapis";
import { Readable } from "stream";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getSetting(supabase: SupabaseServerClient, key: string) {
  const { data } = await supabase.from("proc_app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function getDriveClient(supabase: SupabaseServerClient) {
  const [serviceAccountJson, folderId] = await Promise.all([
    getSetting(supabase, "google_service_account_json"),
    getSetting(supabase, "google_drive_folder_id"),
  ]);
  if (!serviceAccountJson || !folderId) {
    throw new Error('ยังไม่ได้ตั้งค่า Google Drive ในหน้า "ตั้งค่าระบบ"');
  }
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("ข้อมูล Google Service Account ไม่ถูกต้อง");
  }
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });
  return { drive, folderId };
}

export async function driveUpload(
  supabase: SupabaseServerClient,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const { drive, folderId } = await getDriveClient(supabase);
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id",
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error("อัปโหลดไฟล์ไป Google Drive ไม่สำเร็จ");
  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } });
  return fileId;
}

export async function driveDelete(supabase: SupabaseServerClient, fileId: string): Promise<void> {
  const { drive } = await getDriveClient(supabase);
  try {
    await drive.files.delete({ fileId });
  } catch {
    // ไฟล์อาจถูกลบไปแล้วหรือไม่พบ ไม่ต้อง throw ต่อ
  }
}

/** ตั้งชื่อไฟล์ใหม่โดยคงนามสกุลเดิมไว้ (ต้องอ่านชื่อปัจจุบันก่อนเพื่อดึงนามสกุล) */
export async function driveRename(supabase: SupabaseServerClient, fileId: string, newBaseName: string): Promise<void> {
  const { drive } = await getDriveClient(supabase);
  const meta = await drive.files.get({ fileId, fields: "name" });
  const currentName = meta.data.name ?? "";
  const dotIndex = currentName.lastIndexOf(".");
  const ext = dotIndex > 0 ? currentName.slice(dotIndex) : "";
  await drive.files.update({ fileId, requestBody: { name: `${newBaseName}${ext}` } });
}

export async function driveDownload(supabase: SupabaseServerClient, fileId: string): Promise<Buffer> {
  const { drive } = await getDriveClient(supabase);
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}
