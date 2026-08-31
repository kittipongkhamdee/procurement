"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadToStorage, deleteFromStorage } from "@/lib/storage";

const BUCKET = "procurement-files";

export async function uploadProjectReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const file = formData.get("file") as File | null;
  const projectId = String(formData.get("project_id") ?? "");
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์");
  if (!projectId) throw new Error("กรุณาเลือกโครงการ");

  const ext = file.name.split(".").pop();
  const path = `project-reports/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;

  const ref = await uploadToStorage(supabase, { file, bucket: BUCKET, path });

  const { error } = await supabase.from("proc_project_reports").insert({
    project_id: projectId,
    file_url: ref,
    uploaded_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/project-reports");
}

export async function deleteProjectReport(id: string, ref: string) {
  const supabase = await createClient();
  await deleteFromStorage(supabase, ref, BUCKET);
  const { error } = await supabase.from("proc_project_reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/project-reports");
}
