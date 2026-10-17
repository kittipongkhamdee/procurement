"use client";

// หลังบันทึกรายการจัดซื้อที่มีวัสดุ — ถามผู้ใช้ว่าจะเบิกวัสดุทั้งหมดเลยไหม
// ตกลง → รับเข้าบัญชีวัสดุ + ออกเลขที่ใบเบิกให้ผู้ตรวจรับ/ผู้รับผิดชอบทันที
// ไม่ตกลง → ยังไม่ลงบัญชี ใบเบิกพัสดุ (แผ่นสุดท้ายชุดจัดซื้อ) พิมพ์ไม่ได้จนกว่าจะทำรายการที่เมนูบัญชีวัสดุ

import { createClient } from "@/lib/supabase/client";
import { alertInfo, confirmChoice, errorMessage, toastError } from "@/lib/swal";
import { importFromProcurement, type StockSourceType } from "./stock-actions";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** materials = ชื่อรายการที่ติ๊กเป็นวัสดุ · canIssue = ผู้ใช้มีสิทธิ์ลงบัญชีวัสดุ (เจ้าหน้าที่/แอดมิน) */
export async function offerAutoIssue(type: StockSourceType, id: string, materials: string[], canIssue: boolean) {
  if (materials.length === 0) return;
  const { data: existing } = await createClient().from("proc_stock_moves").select("source_seq").eq("source_type", type).eq("source_id", id).eq("kind", "in");
  if (new Set((existing ?? []).map((m) => m.source_seq)).size >= materials.length) return; // ลงบัญชีครบแล้ว
  const list = `<ul style="text-align:left;margin:.5rem 0 0 1.25rem;list-style:disc">${materials.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`;
  if (!canIssue) {
    await alertInfo({
      title: "มีรายการวัสดุ",
      html: `รายการนี้มีวัสดุ ${materials.length} รายการ${list}<p style="margin-top:.75rem">ให้เจ้าหน้าที่พัสดุนำเข้าและออกใบเบิกที่เมนู <b>บัญชีวัสดุ</b> — ใบเบิกพัสดุจะพิมพ์ได้หลังจากนั้น</p>`,
    });
    return;
  }
  const ok = await confirmChoice({
    title: "ต้องการเบิกวัสดุทั้งหมดในรายการนี้หรือไม่?",
    html: `วัสดุ ${materials.length} รายการ${list}<p style="margin-top:.75rem">ตกลง = นำเข้าบัญชีวัสดุและออกเลขที่ใบเบิกให้ผู้ตรวจรับ/ผู้รับผิดชอบทันที</p>`,
    confirmButtonText: "ตกลง เบิกทั้งหมด",
    cancelButtonText: "ยังไม่เบิก",
  });
  if (!ok) {
    await alertInfo({
      title: "ยังไม่ได้เบิกวัสดุ",
      html: "ใบเบิกพัสดุของรายการนี้จะ<b>พิมพ์ไม่ได้</b>จนกว่าจะทำรายการที่เมนู <b>บัญชีวัสดุ</b> (ปุ่ม &quot;ดึงจากรายการจัดซื้อ&quot;)",
    });
    return;
  }
  try {
    const res = await importFromProcurement(type, id, true);
    if (res.error) return void (await toastError(res.error));
    await alertInfo({ title: "เบิกวัสดุเรียบร้อย", text: res.message });
  } catch (err) {
    await toastError(errorMessage(err));
  }
}
