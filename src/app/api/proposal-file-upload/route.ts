import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage, isDriveRef } from "@/lib/storage";

const BUCKET = "procurement-files";
const PATH_PREFIX = "project-proposals";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "กรุณาเลือกไฟล์" }, { status: 400 });

  const ext = file.name.split(".").pop();
  const path = `${PATH_PREFIX}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  try {
    const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });
    return NextResponse.json({ ref });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const { ref } = await request.json();
  if (typeof ref !== "string" || !ref || (!isDriveRef(ref) && !ref.startsWith(`${PATH_PREFIX}/`))) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  await deleteFromStorage(supabase, ref, BUCKET);
  return NextResponse.json({ ok: true });
}
