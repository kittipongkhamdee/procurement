"use server";

// Server Action คู่กับ uploadFileDirect (client-upload.ts) สำหรับปลายทาง Google Drive — browser อัปโหลด
// ไฟล์ตรงไป Drive เอง (ไม่ส่งไฟล์ผ่าน Vercel ซึ่งตัด request ที่ใหญ่เกิน ~4.5MB ทิ้งด้วย 413) server ทำแค่
// เปิด resumable upload session ด้วย service account และตั้งสิทธิ์อ่านหลังอัปโหลดเสร็จ

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { driveFinalizeUpload, driveStartResumableUpload } from "./google-drive";

export async function startDriveUpload(
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

export async function finalizeDriveUpload(fileId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };
  try {
    await driveFinalizeUpload(supabase, fileId);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "ตั้งค่าไฟล์บน Google Drive ไม่สำเร็จ" };
  }
}
