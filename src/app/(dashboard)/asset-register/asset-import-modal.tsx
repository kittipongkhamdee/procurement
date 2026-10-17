"use client";

// ปุ่ม "ดึงจากรายการจัดซื้อ" ของทะเบียนคุมทรัพย์สิน — แสดงเอกสารจัดซื้อปีงบปัจจุบันที่มีรายการติ๊กเป็นครุภัณฑ์
// แล้วส่งเข้าทะเบียน (สถานะรอตรวจสอบ 1 หน่วย = 1 รายการ) — แบบเดียวกับปุ่มดึงของบัญชีวัสดุ

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { PlusIcon, SearchIcon } from "@/components/icons";
import type { ProcurementSourceType } from "@/lib/procurement-source";
import { importAssetsFromProcurement } from "./import-actions";

type Source = { type: ProcurementSourceType; id: string; doc_no: string; date: string; title: string; equipment: number; imported: number };
const LABEL: Record<ProcurementSourceType, string> = { purchase: "จัดซื้อ/จ้าง", w119: "ว 119", urgent: "เร่งด่วน" };

export function AssetImportModal({ onDone }: { onDone: () => void }) {
  const ref = useRef<ModalHandle>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("year, is_open").order("year", { ascending: false });
    const cur = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const ce = cur ? cur.year - 543 : null;
    const from = ce ? `${ce - 1}-10-01` : "1900-01-01";
    const to = ce ? `${ce}-09-30` : "2999-12-31";
    const [{ data: pr }, { data: w }, { data: u }, { data: done }] = await Promise.all([
      supabase.from("proc_purchase_requests").select("id, doc_no, doc_type, record_date, inspected_date, item_name, proc_purchase_items(seq, item_class)").gte("record_date", from).lte("record_date", to),
      supabase.from("proc_w119_reports").select("id, doc_no, purchase_date, purpose, proc_w119_items(seq, name, item_class)").gte("record_date", from).lte("record_date", to),
      supabase.from("proc_urgent_reports").select("id, doc_no, purchase_date, subject, proc_urgent_items(seq, item_class)").gte("record_date", from).lte("record_date", to),
      supabase.from("asset_items").select("source_type, source_id, source_seq").not("source_id", "is", null),
    ]);
    const imported = (type: string, id: string) => new Set((done ?? []).filter((d) => d.source_type === type && d.source_id === id).map((d) => d.source_seq)).size;
    const count = (arr: unknown) => ((arr as { item_class: string | null }[] | null) ?? []).filter((i) => i.item_class === "equipment").length;
    setSources(
      [
        ...(pr ?? []).map((r) => ({ type: "purchase" as const, id: r.id, doc_no: r.doc_no, date: r.inspected_date ?? r.record_date, title: `${r.doc_type} ${r.item_name ?? ""}`, equipment: count(r.proc_purchase_items), imported: imported("purchase", r.id) })),
        ...(w ?? []).map((r) => ({ type: "w119" as const, id: r.id, doc_no: r.doc_no, date: r.purchase_date, title: ((r.proc_w119_items as unknown as { name: string }[]) ?? []).map((i) => i.name).join(", ") || (r.purpose ?? ""), equipment: count(r.proc_w119_items), imported: imported("w119", r.id) })),
        ...(u ?? []).map((r) => ({ type: "urgent" as const, id: r.id, doc_no: r.doc_no ?? "", date: r.purchase_date, title: r.subject, equipment: count(r.proc_urgent_items), imported: imported("urgent", r.id) })),
      ]
        .filter((s) => s.equipment > 0)
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }, []);

  async function run(s: Source) {
    setBusy(s.id);
    try {
      const res = await importAssetsFromProcurement(s.type, s.id);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess(res.message ?? "ส่งเข้าทะเบียนแล้ว");
      await load();
      onDone();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const list = (sources ?? []).filter((s) => !q.trim() || [s.doc_no, s.title].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <Modal
      ref={ref}
      title="ดึงครุภัณฑ์จากรายการจัดซื้อ"
      wide
      lazy
      onOpenChange={(open) => open && load()}
      trigger={
        <span className="btn-gold inline-flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          ดึงจากรายการจัดซื้อ
        </span>
      }
    >
      <p className="mb-2 text-sm text-slate-600">
        แสดงเฉพาะเอกสารที่มีรายการติ๊กเป็น &quot;ครุภัณฑ์&quot; — ส่งเข้าทะเบียน 1 หน่วย = 1 รายการ สถานะ &quot;รอตรวจสอบ&quot; อาคาร/ห้องเป็น &quot;ยังไม่ระบุ&quot;
        จากนั้นแก้ไขเพื่อระบุที่ตั้ง หมวดหมู่ ชนิด และรหัสครุภัณฑ์ แล้วกดอนุมัติ
      </p>
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่ รายการ" className="input w-full pl-9" />
      </div>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {sources === null && <p className="table-empty">กำลังโหลด...</p>}
        {list.map((s) => (
          <div key={`${s.type}-${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-slate !text-sm">{LABEL[s.type]}</span>
                <span className="font-medium text-slate-900">{s.doc_no || "(ไม่มีเลขที่)"}</span>
                <span className="text-sm text-slate-500">{formatThaiDate(s.date)}</span>
              </div>
              <p className="text-sm text-slate-700">{s.title}</p>
              <p className="text-xs text-slate-500">
                ครุภัณฑ์ {s.equipment} รายการ{s.imported ? ` · ส่งแล้ว ${s.imported}` : ""}
              </p>
            </div>
            {s.imported >= s.equipment ? (
              <span className="badge-emerald !text-sm">ส่งครบแล้ว</span>
            ) : (
              <button type="button" onClick={() => run(s)} disabled={busy !== null} className="btn-primary btn-sm">
                {busy === s.id ? "กำลังส่ง..." : "ส่งเข้าทะเบียน"}
              </button>
            )}
          </div>
        ))}
        {sources !== null && list.length === 0 && <p className="table-empty">ไม่มีรายการจัดซื้อที่มีครุภัณฑ์ในปีงบประมาณนี้</p>}
      </div>
    </Modal>
  );
}
