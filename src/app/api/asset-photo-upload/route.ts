import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ASSET_PHOTO_BUCKET, thumbPathFor } from "@/lib/storage/asset-photo";

// อัปโหลดตรงไปที่ bucket "asset-photos" ของ Supabase Storage เสมอ (ไม่ผ่าน uploadToStorage/
// getStorageProvider ของ @/lib/storage ที่สลับไปใช้ Google Drive ได้) เพราะ bucket นี้ใช้ร่วมกับ
// ระบบสำรวจทรัพย์สินแยกต่างหากที่คาดว่า photo_path เป็นพาธ Supabase Storage ธรรมดาเสมอ
const BUCKET = ASSET_PHOTO_BUCKET;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "supply_officer") {
    return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบหรือเจ้าหน้าที่พัสดุเท่านั้น" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });

  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // รูปย่อ (ไม่บังคับ) — เก็บที่ thumbs/<path> ไว้ใช้ในรายการ ถ้าอัปโหลดรูปย่อไม่สำเร็จก็ไม่ทำให้การอัปโหลดรูปหลักล้มเหลว
  // (หน้าที่ใช้รูปย่อจะย้อนไปใช้รูปหลักแทนเมื่อไม่มีรูปย่อ)
  const thumb = formData.get("thumb") as File | null;
  if (thumb && thumb.size > 0 && thumb.size <= 200 * 1024) {
    await supabase.storage.from(BUCKET).upload(thumbPathFor(path), thumb, { contentType: "image/jpeg" });
  }
  return NextResponse.json({ path });
}
