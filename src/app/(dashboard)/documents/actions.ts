"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("proc_documents").insert({
    file_name: fileName || file.name,
    file_url: path,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/documents");
}

export async function deleteDocument(id: string, path: string) {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase.from("proc_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/documents");
}
