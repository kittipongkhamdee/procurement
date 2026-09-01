"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireTeacherOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "teacher" && profile?.role !== "admin") {
    throw new Error("เฉพาะครูหรือผู้ดูแลระบบเท่านั้น");
  }
  return { supabase, userId: user?.id ?? "" };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("proc_profiles")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("เฉพาะผู้ดูแลระบบเท่านั้น");
  return { supabase, userId: user?.id ?? "" };
}

export type QuestionInput = {
  question_type: "likert" | "choice" | "text";
  question_text: string;
  options: string[];
  required: boolean;
};

export async function createForm(formData: FormData) {
  const { supabase, userId } = await requireTeacherOrAdmin();

  const project_id = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const template_source_id = String(formData.get("template_source_id") ?? "") || null;

  if (!project_id || !title) throw new Error("กรุณาระบุโครงการและชื่อแบบประเมิน");

  const { data: form, error } = await supabase
    .from("eval_forms")
    .insert({ project_id, title, description, created_by: userId, template_source_id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (template_source_id) {
    const { data: templateQuestions, error: qFetchError } = await supabase
      .from("eval_questions")
      .select("sort_order, question_type, question_text, options, required")
      .eq("form_id", template_source_id)
      .order("sort_order");
    if (qFetchError) throw new Error(qFetchError.message);

    if (templateQuestions && templateQuestions.length > 0) {
      const rows = templateQuestions.map((q) => ({ ...q, form_id: form.id }));
      const { error: qInsertError } = await supabase.from("eval_questions").insert(rows);
      if (qInsertError) throw new Error(qInsertError.message);
    }
  }

  revalidatePath("/evaluations");
  return form.id as string;
}

export async function createTemplate(formData: FormData) {
  const { supabase, userId } = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) throw new Error("กรุณาระบุชื่อ template");

  const { data: form, error } = await supabase
    .from("eval_forms")
    .insert({ title, description, created_by: userId, is_template: true, project_id: null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/evaluations");
  return form.id as string;
}

export async function updateFormMeta(formId: string, formData: FormData) {
  const { supabase } = await requireTeacherOrAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) throw new Error("กรุณาระบุชื่อแบบประเมิน");

  const { error } = await supabase
    .from("eval_forms")
    .update({ title, description, updated_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw new Error(error.message);
  revalidatePath("/evaluations");
}

export async function deleteForm(formId: string) {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase.from("eval_forms").delete().eq("id", formId);
  if (error) throw new Error(error.message);
  revalidatePath("/evaluations");
}

export async function publishForm(formId: string) {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase
    .from("eval_forms")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw new Error(error.message);
  revalidatePath("/evaluations");
}

export async function closeForm(formId: string) {
  const { supabase } = await requireTeacherOrAdmin();
  const { error } = await supabase
    .from("eval_forms")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", formId);
  if (error) throw new Error(error.message);
  revalidatePath("/evaluations");
}

// ลบคำถามเดิมทั้งหมดแล้ว insert ชุดใหม่ทั้งหมดในคำสั่งเดียว — ง่ายกว่า diff ทีละแถวเพราะจำนวน
// คำถามต่อแบบประเมินไม่มาก (คำตอบที่มีอยู่แล้วจะอ้างอิง question_id เดิมไม่ได้อีกต่อไป แต่ระบบนี้
// ไม่ผูกคำถามเข้ากับคำตอบแบบที่ต้องแก้ไขคำถามหลังมีคำตอบแล้วบ่อยๆ จึงยอมรับข้อจำกัดนี้ได้)
export async function replaceQuestions(formId: string, formData: FormData) {
  const { supabase } = await requireTeacherOrAdmin();

  let questions: QuestionInput[] = [];
  try {
    questions = JSON.parse(String(formData.get("questions_json") ?? "[]"));
  } catch {
    questions = [];
  }

  const { error: delError } = await supabase.from("eval_questions").delete().eq("form_id", formId);
  if (delError) throw new Error(delError.message);

  const rows = questions
    .filter((q) => q.question_text.trim() !== "")
    .map((q, idx) => ({
      form_id: formId,
      sort_order: idx,
      question_type: q.question_type,
      question_text: q.question_text.trim(),
      options: q.question_type === "choice" ? q.options.map((o) => o.trim()).filter(Boolean) : null,
      required: q.required,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("eval_questions").insert(rows);
    if (error) throw new Error(error.message);
  }
}
