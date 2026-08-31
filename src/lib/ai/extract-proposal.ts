import mammoth from "mammoth";
import type { createClient } from "@/lib/supabase/server";
import { downloadFromStorage } from "@/lib/storage";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PROPOSAL_FILES_BUCKET = "procurement-files";
const DEFAULT_MODEL = "gemini-2.5-flash";

export type ExtractedProposal = {
  name: string;
  strategy_alignment: string | null;
  standard: string | null;
  responsible: string[];
  activities: { name: string; responsible: string[]; budget: number }[];
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    strategy_alignment: { type: "STRING", nullable: true },
    standard: { type: "STRING", nullable: true },
    responsible: { type: "ARRAY", items: { type: "STRING" } },
    activities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          responsible: { type: "ARRAY", items: { type: "STRING" } },
          budget: { type: "NUMBER" },
        },
        required: ["name"],
      },
    },
  },
  required: ["name", "activities"],
};

function buildPrompt(options: { strategies: string[]; standards: string[]; teachers: string[] }) {
  return `คุณเป็นผู้ช่วยอ่านไฟล์เอกสารข้อเสนอโครงการของโรงเรียน แล้วสรุปข้อมูลออกมาเป็น JSON ตามโครงสร้างที่กำหนด

กติกา:
- "name" คือชื่อโครงการ
- "strategy_alignment" ให้เลือกข้อความที่ตรงที่สุดจากรายการนี้เท่านั้น (หรือ null ถ้าไม่แน่ใจ): ${JSON.stringify(options.strategies)}
- "standard" ให้เลือกข้อความที่ตรงที่สุดจากรายการนี้เท่านั้น (หรือ null ถ้าไม่แน่ใจ): ${JSON.stringify(options.standards)}
- "responsible" คือรายชื่อผู้รับผิดชอบโครงการ ให้เลือกเฉพาะชื่อที่ตรงกับรายการนี้เท่านั้น (ข้ามชื่อที่ไม่ตรง): ${JSON.stringify(options.teachers)}
- "activities" คือรายการขั้นตอน/กิจกรรมการดำเนินงานพร้อมงบประมาณของแต่ละกิจกรรม (responsible ของแต่ละกิจกรรมให้เลือกจากรายการชื่อเดียวกันข้างต้น, budget เป็นตัวเลขบาท)
- ถ้าหาข้อมูลส่วนใดไม่พบ ให้ใส่ค่าว่างหรือ null ตามชนิดข้อมูล ห้ามแต่งข้อมูลขึ้นเอง

ตอบเป็น JSON เท่านั้น`;
}

async function getSetting(supabase: SupabaseServerClient, key: string) {
  const { data } = await supabase.from("proc_app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

/** อ่านไฟล์ (pdf/docx) แล้วดาวน์โหลด+แปลงเป็น content parts สำหรับส่งให้ Gemini ใช้ร่วมกันทั้งการดึงข้อเสนอโครงการเต็มรูปแบบและการดึงเฉพาะบางส่วน */
async function loadFileContentParts(supabase: SupabaseServerClient, filePath: string): Promise<unknown[]> {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const buffer = await downloadFromStorage(supabase, filePath, PROPOSAL_FILES_BUCKET);

  const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — ไฟล์ใหญ่กว่านี้เสี่ยงหมดเวลาก่อน AI ประมวลผลเสร็จ
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("ไฟล์มีขนาดใหญ่เกินไป (เกิน 15MB) กรุณาใช้ไฟล์ที่มีขนาดเล็กลง");
  }

  if (ext === "pdf") {
    return [{ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } }];
  }
  if (ext === "docx") {
    const { value: text } = await mammoth.extractRawText({ buffer });
    if (!text.trim()) throw new Error("ไม่พบข้อความในไฟล์ Word");
    return [{ text: `เนื้อหาไฟล์โครงการ:\n${text}` }];
  }
  throw new Error("รองรับเฉพาะไฟล์ .pdf และ .docx เท่านั้น");
}

async function callGeminiJson(
  supabase: SupabaseServerClient,
  contentParts: unknown[],
  prompt: string,
  responseSchema: unknown,
): Promise<unknown> {
  const apiKey = await getSetting(supabase, "gemini_api_key");
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key ในหน้า "ตั้งค่าระบบ"');
  const model = (await getSetting(supabase, "gemini_model")) || DEFAULT_MODEL;

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }, ...contentParts] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const callGemini = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      signal: AbortSignal.timeout(45_000),
    });

  let res: Response;
  try {
    res = await callGemini();
    for (const delayMs of [800, 1600]) {
      if (res.ok || (res.status !== 503 && res.status !== 429)) break;
      // โมเดลกำลังโหลดสูง/ถูกจำกัดอัตราชั่วคราว ลองใหม่อีกครั้งหลังหน่วงเวลาสั้นๆ
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      res = await callGemini();
    }
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("เรียก Gemini ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง หรือใช้ไฟล์ที่มีขนาดเล็กลง");
    }
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Gemini API error (${res.status}) model=${model}:`, body.slice(0, 1000));
    if (res.status === 503) throw new Error("Gemini กำลังมีผู้ใช้งานหนาแน่น กรุณาลองใหม่อีกครั้งในสักครู่ (ลองหลายครั้งแล้วยังไม่สำเร็จ)");
    if (res.status === 403 || res.status === 400) throw new Error("Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบในหน้าตั้งค่าระบบ");
    throw new Error(`เรียก Gemini ไม่สำเร็จ (${res.status}) ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI ไม่ตอบกลับข้อมูล");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("แปลงผลลัพธ์จาก AI ไม่สำเร็จ");
  }
}

const BACKGROUND_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    background: { type: "STRING" },
  },
  required: ["background"],
};

/** ให้ AI อ่านไฟล์ข้อเสนอโครงการ (Word/PDF) แล้วสรุป "หลักการและเหตุผล" มาเป็นความเป็นมาสั้นๆ สำหรับใช้ในรายงานสรุปโครงการ */
export async function extractProjectBackgroundFromFile(
  supabase: SupabaseServerClient,
  filePath: string,
): Promise<string> {
  const contentParts = await loadFileContentParts(supabase, filePath);
  const prompt = `คุณเป็นผู้ช่วยอ่านไฟล์เอกสารข้อเสนอโครงการของโรงเรียน แล้วสรุปเฉพาะหัวข้อ "หลักการและเหตุผล" (หรือหัวข้อที่ความหมายใกล้เคียงกัน เช่น ความเป็นมา) ให้กระชับเป็นย่อหน้าสั้นๆ ไม่เกิน 5-6 บรรทัด เพื่อนำไปใช้เป็น "ความเป็นมา" ในรายงานสรุปผลโครงการ ห้ามแต่งเนื้อหาขึ้นเองถ้าไม่พบหัวข้อนี้ในไฟล์ให้ตอบเป็นข้อความว่างเปล่า ตอบเป็น JSON เท่านั้น`;
  const parsed = await callGeminiJson(supabase, contentParts, prompt, BACKGROUND_RESPONSE_SCHEMA);
  return String((parsed as { background?: string })?.background ?? "").trim();
}

export async function extractProposalFromFile(
  supabase: SupabaseServerClient,
  filePath: string,
  options: { strategies: string[]; standards: string[]; teachers: string[] },
): Promise<ExtractedProposal> {
  const contentParts = await loadFileContentParts(supabase, filePath);
  const parsed = (await callGeminiJson(
    supabase,
    contentParts,
    buildPrompt(options),
    RESPONSE_SCHEMA,
  )) as Partial<ExtractedProposal>;

  return {
    name: String(parsed.name ?? ""),
    strategy_alignment: parsed.strategy_alignment ?? null,
    standard: parsed.standard ?? null,
    responsible: Array.isArray(parsed.responsible) ? parsed.responsible.map(String) : [],
    activities: Array.isArray(parsed.activities)
      ? parsed.activities.map((a) => ({
          name: String(a.name ?? ""),
          responsible: Array.isArray(a.responsible) ? a.responsible.map(String) : [],
          budget: Number(a.budget) || 0,
        }))
      : [],
  };
}
