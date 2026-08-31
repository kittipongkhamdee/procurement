import { JWT } from "google-auth-library";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

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
    data: { name: fileName, parents: [folderId] },
  });
  const fileId = createRes.data.id;
  if (!fileId) throw new Error("อัปโหลดไฟล์ไป Google Drive ไม่สำเร็จ");

  await auth.request({
    url: `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`,
    method: "PATCH",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    data: buffer,
  });

  await auth.request({
    url: `${DRIVE_API}/files/${fileId}/permissions`,
    method: "POST",
    data: { role: "reader", type: "anyone" },
  });

  return fileId;
}

export async function driveDelete(supabase: SupabaseServerClient, fileId: string): Promise<void> {
  const { auth } = await getDriveClient(supabase);
  try {
    await auth.request({ url: `${DRIVE_API}/files/${fileId}`, method: "DELETE" });
  } catch {
    // ไฟล์อาจถูกลบไปแล้วหรือไม่พบ ไม่ต้อง throw ต่อ
  }
}

/** ตั้งชื่อไฟล์ใหม่โดยคงนามสกุลเดิมไว้ (ต้องอ่านชื่อปัจจุบันก่อนเพื่อดึงนามสกุล) */
export async function driveRename(supabase: SupabaseServerClient, fileId: string, newBaseName: string): Promise<void> {
  const { auth } = await getDriveClient(supabase);
  const meta = await auth.request<{ name?: string }>({
    url: `${DRIVE_API}/files/${fileId}`,
    params: { fields: "name" },
  });
  const currentName = meta.data.name ?? "";
  const dotIndex = currentName.lastIndexOf(".");
  const ext = dotIndex > 0 ? currentName.slice(dotIndex) : "";
  await auth.request({
    url: `${DRIVE_API}/files/${fileId}`,
    method: "PATCH",
    data: { name: `${newBaseName}${ext}` },
  });
}

export async function driveDownload(supabase: SupabaseServerClient, fileId: string): Promise<Buffer> {
  const { auth } = await getDriveClient(supabase);
  const res = await auth.request<ArrayBuffer>({
    url: `${DRIVE_API}/files/${fileId}`,
    params: { alt: "media" },
    responseType: "arraybuffer",
  });
  return Buffer.from(res.data);
}

/** ทดสอบว่า Service Account เชื่อมต่อ Drive ได้จริงและเปิดโฟลเดอร์ปลายทางได้ (ต้องแชร์โฟลเดอร์ให้อีเมล Service Account เป็น Editor ไว้ก่อน) */
export async function testDriveConnection(supabase: SupabaseServerClient): Promise<void> {
  const { auth, folderId } = await getDriveClient(supabase);
  let meta;
  try {
    meta = await auth.request<{ id: string; mimeType?: string; trashed?: boolean }>({
      url: `${DRIVE_API}/files/${folderId}`,
      params: { fields: "id, mimeType, trashed" },
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
}
