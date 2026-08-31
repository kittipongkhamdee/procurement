import { JWT } from "google-auth-library";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

/** ต้องส่ง supportsAllDrives=true ในทุกคำขอ ไม่งั้น Drive API จะมองไม่เห็น/เขียนไฟล์ในไดรฟ์ที่แชร์ (Shared Drive) ไม่ได้ */
const SUPPORTS_ALL_DRIVES = { supportsAllDrives: true };

async function getSetting(supabase: SupabaseServerClient, key: string) {
  const { data } = await supabase.from("proc_app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

/** ใช้ google-auth-library แทน googleapis (ซึ่งมีขนาดใหญ่กว่าหลายร้อยเท่าเพราะรวม client ของทุก Google API) เพื่อลด cold-start ของ serverless function */
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
  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return { auth, folderId };
}

export async function driveUpload(
  supabase: SupabaseServerClient,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const { auth, folderId } = await getDriveClient(supabase);

  const createRes = await auth.request<{ id: string }>({
    url: `${DRIVE_API}/files`,
    method: "POST",
    params: SUPPORTS_ALL_DRIVES,
    data: { name: fileName, parents: [folderId] },
  });
  const fileId = createRes.data.id;
  if (!fileId) throw new Error("อัปโหลดไฟล์ไป Google Drive ไม่สำเร็จ");

  await auth.request({
    url: `${DRIVE_UPLOAD_API}/files/${fileId}`,
    method: "PATCH",
    params: { ...SUPPORTS_ALL_DRIVES, uploadType: "media" },
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    data: buffer,
  });

  await auth.request({
    url: `${DRIVE_API}/files/${fileId}/permissions`,
    method: "POST",
    params: SUPPORTS_ALL_DRIVES,
    data: { role: "reader", type: "anyone" },
  });

  return fileId;
}

export async function driveDelete(supabase: SupabaseServerClient, fileId: string): Promise<void> {
  const { auth } = await getDriveClient(supabase);
  try {
    await auth.request({ url: `${DRIVE_API}/files/${fileId}`, method: "DELETE", params: SUPPORTS_ALL_DRIVES });
  } catch {
    // ไฟล์อาจถูกลบไปแล้วหรือไม่พบ ไม่ต้อง throw ต่อ
  }
}

/** ตั้งชื่อไฟล์ใหม่โดยคงนามสกุลเดิมไว้ (ต้องอ่านชื่อปัจจุบันก่อนเพื่อดึงนามสกุล) */
export async function driveRename(supabase: SupabaseServerClient, fileId: string, newBaseName: string): Promise<void> {
  const { auth } = await getDriveClient(supabase);
  const meta = await auth.request<{ name?: string }>({
    url: `${DRIVE_API}/files/${fileId}`,
    params: { ...SUPPORTS_ALL_DRIVES, fields: "name" },
  });
  const currentName = meta.data.name ?? "";
  const dotIndex = currentName.lastIndexOf(".");
  const ext = dotIndex > 0 ? currentName.slice(dotIndex) : "";
  await auth.request({
    url: `${DRIVE_API}/files/${fileId}`,
    method: "PATCH",
    params: SUPPORTS_ALL_DRIVES,
    data: { name: `${newBaseName}${ext}` },
  });
}

export async function driveDownload(supabase: SupabaseServerClient, fileId: string): Promise<Buffer> {
  const { auth } = await getDriveClient(supabase);
  const res = await auth.request<ArrayBuffer>({
    url: `${DRIVE_API}/files/${fileId}`,
    params: { ...SUPPORTS_ALL_DRIVES, alt: "media" },
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data);
}

/**
 * ทดสอบว่า Service Account อัปโหลดไฟล์ไป Drive ได้จริง — ไม่ใช่แค่เปิดโฟลเดอร์ดูได้
 * (Service Account ไม่มีโควตาพื้นที่เก็บข้อมูลของตัวเอง เปิดอ่านโฟลเดอร์ธรรมดาผ่านได้เสมอ
 * แต่จะอัปโหลดไฟล์ไม่ได้เลยถ้าโฟลเดอร์นั้นไม่ได้อยู่ใน "ไดรฟ์ที่แชร์" (Shared Drive) —
 * ต้องลองสร้าง+ลบไฟล์จริงเพื่อจับปัญหานี้ได้ก่อนสลับปลายทาง)
 */
export async function testDriveConnection(supabase: SupabaseServerClient): Promise<void> {
  const { auth, folderId } = await getDriveClient(supabase);
  let meta;
  try {
    meta = await auth.request<{ id: string; mimeType?: string; trashed?: boolean }>({
      url: `${DRIVE_API}/files/${folderId}`,
      params: { ...SUPPORTS_ALL_DRIVES, fields: "id, mimeType, trashed" },
    });
  } catch {
    throw new Error(
      "เชื่อมต่อ Google Drive ไม่สำเร็จ กรุณาตรวจสอบ Service Account JSON และ Folder ID ให้ถูกต้อง และแชร์โฟลเดอร์ให้อีเมลของ Service Account เป็น Editor",
    );
  }
  if (meta.data.trashed) throw new Error("โฟลเดอร์ Google Drive ที่ตั้งค่าไว้ถูกลบ (อยู่ในถังขยะ)");
  if (meta.data.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Folder ID ที่ตั้งค่าไว้ไม่ใช่โฟลเดอร์");
  }

  let probeFileId: string | undefined;
  try {
    const createRes = await auth.request<{ id: string }>({
      url: `${DRIVE_API}/files`,
      method: "POST",
      params: SUPPORTS_ALL_DRIVES,
      data: { name: ".procurement-connection-test", parents: [folderId] },
    });
    probeFileId = createRes.data.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("storageQuota") || message.includes("storage quota")) {
      throw new Error(
        "อัปโหลดไฟล์ไม่ได้ เพราะโฟลเดอร์นี้ไม่ได้อยู่ใน \"ไดรฟ์ที่แชร์\" (Shared Drive) — Service Account ไม่มีโควตาพื้นที่เก็บข้อมูลของตัวเอง ต้องสร้าง Shared Drive แล้วย้าย/สร้างโฟลเดอร์ไว้ข้างในนั้น จากนั้นแชร์ Shared Drive ให้อีเมลของ Service Account เป็น Content Manager แล้วนำ Folder ID ใหม่มาตั้งค่าอีกครั้ง",
      );
    }
    throw new Error("อัปโหลดไฟล์ทดสอบไป Google Drive ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Editor ของ Service Account อีกครั้ง");
  }
  if (probeFileId) {
    await auth
      .request({ url: `${DRIVE_API}/files/${probeFileId}`, method: "DELETE", params: SUPPORTS_ALL_DRIVES })
      .catch(() => {});
  }
}
