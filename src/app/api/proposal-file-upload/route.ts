import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage, isDriveRef } from "@/lib/storage";

const BUCKET = "procurement-files";
const PATH_PREFIX = "project-proposals";

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
