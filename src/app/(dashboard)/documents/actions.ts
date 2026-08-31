"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";

const BUCKET = "procurement-files";

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File | null;
  const fileName = String(formData.get("file_name") ?? "");
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์");

  const ext = file.name.split(".").pop();
  const path = `documents/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });

  const { error } = await supabase.from("proc_documents").insert({
    file_name: fileName || file.name,
    file_url: ref,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/documents");
}

export async function deleteDocument(id: string, ref: string) {
  const supabase = await createClient();
  await deleteFromStorage(supabase, ref, BUCKET);
  const { error } = await supabase.from("proc_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
}
