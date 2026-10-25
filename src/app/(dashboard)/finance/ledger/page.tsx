import { redirect } from "next/navigation";

// บัญชีรับ-จ่ายเงินย้ายไปรวมกับหน้างานการเงิน (/finance) — ลิงก์/บุ๊กมาร์กเดิมพาไปหน้าใหม่ (คง ?view=… ไว้)
export default async function LedgerRedirect({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const v = Array.isArray(view) ? view[0] : view;
  redirect(v ? `/finance?view=${encodeURIComponent(v)}` : "/finance");
}
