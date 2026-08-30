import mammoth from "mammoth";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PROPOSAL_FILES_BUCKET = "procurement-files";
const DEFAULT_MODEL = "gemini-flash-latest";

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

export async function extractProposalFromFile(
  supabase: SupabaseServerClient,
  filePath: string,
  options: { strategies: string[]; standards: string[]; teachers: string[] },
): Promise<ExtractedProposal> {
  const apiKey = await getSetting(supabase, "gemini_api_key");
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key ในหน้า "ตั้งค่าระบบ"');
  const model = (await getSetting(supabase, "gemini_model")) || DEFAULT_MODEL;

  const ext = filePath.split(".").pop()?.toLowerCase();
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(PROPOSAL_FILES_BUCKET)
    .download(filePath);
  if (downloadError || !fileBlob) throw new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ");

  let contentParts: unknown[];
  if (ext === "pdf") {
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    contentParts = [{ inlineData: { mimeType: "application/pdf", data: buffer.toString("base64") } }];
  } else if (ext === "docx") {
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const { value: text } = await mammoth.extractRawText({ buffer });
    if (!text.trim()) throw new Error("ไม่พบข้อความในไฟล์ Word");
    contentParts = [{ text: `เนื้อหาไฟล์โครงการ:\n${text}` }];
  } else {
    throw new Error("รองรับเฉพาะไฟล์ .pdf และ .docx เท่านั้น");
  }

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(options) }, ...contentParts] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody });
  if (!res.ok && (res.status === 503 || res.status === 429)) {
    // โมเดลกำลังโหลดสูง/ถูกจำกัดอัตราชั่วคราว ลองใหม่อีกครั้งหลังหน่วงเวลาสั้นๆ
    await new Promise((resolve) => setTimeout(resolve, 2000));
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody });
  }
  if (!res.ok) {
    if (res.status === 503) throw new Error("Gemini กำลังมีผู้ใช้งานหนาแน่น กรุณาลองใหม่อีกครั้งในสักครู่");
    const body = await res.text().catch(() => "");
    throw new Error(`เรียก Gemini ไม่สำเร็จ (${res.status}) ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI ไม่ตอบกลับข้อมูล");

  let parsed: ExtractedProposal;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("แปลงผลลัพธ์จาก AI ไม่สำเร็จ");
  }

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
