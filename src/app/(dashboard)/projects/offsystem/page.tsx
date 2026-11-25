"use client";

// รายการตัดงบนอกระบบ — กรณีใช้จ่ายด้วยเอกสารกระดาษไม่ได้ทำในระบบ (เช่น ค่าเดินทาง ค่าสาธารณูปโภค) เจ้าหน้าที่บันทึกเป็นข้อมูลเพื่อให้ยอด
// "ใช้ไปแล้ว/คงเหลือ" ของโครงการ กิจกรรม และแหล่งเงิน ครบถ้วน (นับรวมกับบันทึกขออนุมัติที่อนุมัติในระบบ) — ไม่ผ่านขั้นเห็นชอบ/อนุมัติ

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon } from "@/components/icons";
import { Modal, type ModalHandle } from "@/components/modal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { loadProjectSpending } from "@/lib/project-spending";
import { OFFSYSTEM_CATEGORIES } from "@/lib/offsystem-spending";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import { deleteOffsystem, saveOffsystem } from "./actions";

type Source = { id: string; name: string };
type Activity = { id: string; name: string | null; budget: number };
type Project = { id: string; name: string; budget: number; sourceId: string | null; groupOrder: number; activities: Activity[]; remaining: number };
type Entry = {
  id: string;
  project_id: string;
  project_name: string;
  activity_id: string | null;
  activity_name: string | null;
  spend_date: string;
  category: string | null;
  amount: number;
  ref_doc: string | null;
  note: string | null;
  created_by_name: string | null;
  sources: { sourceId: string; amount: number }[];
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function EntryForm({
  entry,
  projects,
  sources,
  onSaved,
}: {
  entry: Entry | null;
  projects: Project[];
  sources: Source[];
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [projectId, setProjectId] = useState(entry?.project_id ?? "");
  const [activityId, setActivityId] = useState(entry?.activity_id ?? "");
  const [date, setDate] = useState<string | null>(entry?.spend_date ?? null);
  const [category, setCategory] = useState(entry?.category ?? OFFSYSTEM_CATEGORIES[0]);
  const [refDoc, setRefDoc] = useState(entry?.ref_doc ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const counter = useRef(1000);
  const nk = () => ++counter.current;
  const [rows, setRows] = useState<{ key: number; sourceId: string; amount: string }[]>(
    entry && entry.sources.length > 0
      ? entry.sources.map((x, i) => ({ key: i, sourceId: x.sourceId, amount: String(x.amount) }))
      : [{ key: 0, sourceId: "", amount: entry ? String(entry.amount) : "" }],
  );
  const [saving, setSaving] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  // แก้ไขรายการเดิม: ยอดเดิมของรายการนี้ไม่นับซ้ำกับยอดคงเหลือ
  const remaining = project ? project.remaining + (entry && entry.project_id === project.id ? entry.amount : 0) : null;
  const over = remaining != null && total > remaining + 0.005;

  function pickProject(id: string) {
    setProjectId(id);
    setActivityId("");
    const p = projects.find((x) => x.id === id);
    // แหล่งเงินตั้งต้น = แหล่งงบหลักของโครงการ (ถ้ายังไม่ได้เลือกแหล่งเอง)
    setRows((cur) => (cur.length === 1 && !cur[0].sourceId && p?.sourceId ? [{ ...cur[0], sourceId: p.sourceId }] : cur));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!projectId) return void (await toastError("กรุณาเลือกโครงการ"));
    if (!date) return void (await toastError("กรุณาเลือกวันที่"));
    if (!(total > 0)) return void (await toastError("กรุณากรอกจำนวนเงิน"));
    if (rows.some((r) => !r.sourceId)) return void (await toastError("กรุณาเลือกแหล่งเงินให้ครบทุกบรรทัด"));
    setSaving(true);
    try {
      const res = await saveOffsystem(entry?.id ?? null, {
        project_id: projectId,
        activity_id: activityId || null,
        spend_date: date,
        category,
        amount: total,
        ref_doc: refDoc,
        note,
        sources: rows.map((r) => ({ budget_source_id: r.sourceId, amount: parseFloat(r.amount) || 0 })),
      });
      if (res.error) return void (await toastError(res.error));
      modalRef.current?.close();
      await toastSuccess(entry ? "บันทึกการแก้ไขแล้ว" : "บันทึกรายการตัดงบนอกระบบแล้ว");
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      ref={modalRef}
      title={entry ? "แก้ไขรายการตัดงบนอกระบบ" : "บันทึกรายการตัดงบนอกระบบ"}
      trigger={entry ? "แก้ไข" : "+ บันทึกรายการนอกระบบ"}
      triggerClassName={entry ? "btn-secondary btn-sm" : "btn-primary"}
      wide
      lazy
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ใช้บันทึกรายจ่ายที่ทำเป็นเอกสารกระดาษนอกระบบ (เช่น ค่าเดินทาง ค่าสาธารณูปโภค) เพื่อให้ยอดคงเหลือถูกต้อง — ไม่ต้องผ่านการเห็นชอบ/อนุมัติในระบบ
          โปรดอ้างอิงเลขที่เอกสารจริงทุกครั้ง
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">โครงการ *</label>
            <select value={projectId} onChange={(e) => pickProject(e.target.value)} className="input w-full" required>
              <option value="">-- เลือกโครงการ --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {remaining != null && (
              <p className={`mt-1 text-xs ${over ? "font-medium text-red-600" : "text-slate-500"}`}>
                งบคงเหลือของโครงการ {fmt(remaining)} บาท{over ? ` — ยอดที่บันทึกเกิน ${fmt(total - remaining)} บาท (เตือนเท่านั้น ยังบันทึกได้)` : ""}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="label">กิจกรรม</label>
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!project} className="input w-full">
              <option value="">{project ? "-- ไม่ระบุกิจกรรม --" : "-- เลือกโครงการก่อน --"}</option>
              {(project?.activities ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">วันที่ *</label>
            <ThaiDatePicker value={date} onChange={setDate} />
          </div>
          <div>
            <label className="label">ประเภทรายจ่าย</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-full">
              {OFFSYSTEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="label !mb-0">แหล่งเงินและจำนวนเงิน *</p>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[1fr_9rem_auto] items-center gap-2">
              <select
                value={r.sourceId}
                onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, sourceId: e.target.value } : x)))}
                className="input"
                aria-label="แหล่งเงิน"
              >
                <option value="">เลือกแหล่งเงิน…</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id !== r.sourceId && rows.some((x) => x.sourceId === s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))}
                className="input text-right"
                placeholder="0.00"
                aria-label="จำนวนเงิน"
              />
              <button
                type="button"
                disabled={rows.length <= 1}
                onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                เอาออก
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setRows([...rows, { key: nk(), sourceId: "", amount: "" }])} className="text-xs font-medium text-navy-800 hover:underline">
              + เพิ่มแหล่งเงิน (ตัดจากหลายแหล่ง)
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-800">รวม {fmt(total)} บาท</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">เลขที่เอกสารอ้างอิง</label>
            <input value={refDoc} onChange={(e) => setRefDoc(e.target.value)} placeholder="เช่น บันทึกที่ 12/2570" className="input w-full" />
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function OffsystemPage() {
  const { isProcStaff, loading: authLoading } = useAuth();
  const [year, setYear] = useState<{ id: string; year: number } | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false });
    const y = years?.find((x) => x.is_open) ?? years?.[0] ?? null;
    setYear(y ? { id: y.id, year: y.year } : null);
    const { data: src } = await supabase.from("plan_budget_sources").select("id, name").eq("is_active", true).order("sort_order").order("name");
    setSources(src ?? []);
    if (!y) return;
    const { data: projs } = await supabase
      .from("plan_projects")
      .select("id, name, budget, budget_source_id, sort_order, plan_admin_groups(sort_order), plan_activities(id, name, budget, sort_order)")
      .eq("budget_year_id", y.id)
      .order("sort_order");
    const ids = (projs ?? []).map((p) => p.id);
    const { byProject } = await loadProjectSpending(supabase, ids);
    setProjects(
      (projs ?? [])
        .map((p) => {
          const acts = [...((p.plan_activities as unknown as (Activity & { sort_order: number })[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
          const budget = acts.length > 0 ? acts.reduce((s, a) => s + Number(a.budget ?? 0), 0) : Number(p.budget ?? 0);
          return {
            id: p.id,
            name: p.name,
            budget,
            sourceId: p.budget_source_id,
            groupOrder: (p.plan_admin_groups as unknown as { sort_order: number | null } | null)?.sort_order ?? 1e9,
            activities: acts.map((a) => ({ id: a.id, name: a.name, budget: Number(a.budget ?? 0) })),
            remaining: budget - (byProject.get(p.id)?.approved ?? 0),
          };
        })
        .sort((a, b) => a.groupOrder - b.groupOrder),
    );
    const { data: rows } = await supabase
      .from("proc_offsystem_spending")
      .select("id, project_id, activity_id, activity_name, spend_date, category, amount, ref_doc, note, created_by_name, plan_projects(name), proc_offsystem_spending_sources(budget_source_id, amount, sort_order)")
      .in("project_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .order("spend_date", { ascending: false })
      .order("created_at", { ascending: false });
    setEntries(
      (rows ?? []).map((r) => ({
        id: r.id,
        project_id: r.project_id,
        project_name: (r.plan_projects as unknown as { name: string } | null)?.name ?? "-",
        activity_id: r.activity_id,
        activity_name: r.activity_name,
        spend_date: r.spend_date,
        category: r.category,
        amount: Number(r.amount ?? 0),
        ref_doc: r.ref_doc,
        note: r.note,
        created_by_name: r.created_by_name,
        sources: [...((r.proc_offsystem_spending_sources as unknown as { budget_source_id: string; amount: number; sort_order: number }[]) ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((x) => ({ sourceId: x.budget_source_id, amount: Number(x.amount ?? 0) })),
      })),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const sourceName = useMemo(() => new Map(sources.map((s) => [s.id, s.name])), [sources]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => [e.project_name, e.activity_name, e.category, e.ref_doc, e.note].some((v) => v?.toLowerCase().includes(q)));
  }, [entries, query]);
  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);

  async function remove(e: Entry) {
    const ok = await confirmDelete({ title: "ลบรายการตัดงบนอกระบบ?", text: `${e.category ?? ""} ${fmt(e.amount)} บาท — ยอดคงเหลือของโครงการจะกลับมาเพิ่มขึ้น` });
    if (!ok) return;
    const res = await deleteOffsystem(e.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบรายการแล้ว");
    reload();
  }

  if (authLoading || year === undefined) return <PageLoadingSkeleton />;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/projects" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            โครงการ
          </Link>
          <h1 className="page-title">รายการตัดงบนอกระบบ</h1>
          <p className="page-subtitle">
            รายจ่ายที่ทำเป็นเอกสารกระดาษ บันทึกเป็นข้อมูลเพื่อให้ยอดคงเหลือครบถ้วน{year ? ` · ปีงบประมาณ ${year.year}` : ""}
          </p>
        </div>
        {isProcStaff && year && <EntryForm key="new" entry={null} projects={projects} sources={sources} onSaved={reload} />}
      </div>

      {!isProcStaff && (
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">ดูรายการได้ — เฉพาะแอดมิน เจ้าหน้าที่พัสดุ และเจ้าหน้าที่การเงินที่บันทึก/แก้ไขได้</p>
      )}

      <div className="card mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาโครงการ กิจกรรม ประเภท เอกสารอ้างอิง..." className="input max-w-sm" />
          <p className="text-sm text-slate-600">
            {filtered.length} รายการ · รวม <span className="font-semibold tabular-nums text-slate-900">{fmt(totalAmount)}</span> บาท
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[56rem]">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>โครงการ / กิจกรรม</th>
                <th>ประเภท</th>
                <th>แหล่งเงิน</th>
                <th className="text-right">จำนวนเงิน (บาท)</th>
                <th>เอกสารอ้างอิง</th>
                <th>ผู้บันทึก</th>
                {isProcStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatThaiDate(e.spend_date)}</td>
                  <td className="min-w-[14rem]">
                    <span className="font-medium text-slate-900">{e.project_name}</span>
                    {e.activity_name && <span className="block text-xs text-slate-500">– {e.activity_name}</span>}
                  </td>
                  <td>{e.category ?? "-"}</td>
                  <td className="min-w-[10rem]">
                    {e.sources.length > 0 ? e.sources.map((x) => `${sourceName.get(x.sourceId) ?? "แหล่งเงิน"} ${fmt(x.amount)}`).join(" + ") : "ตามแหล่งงบของโครงการ"}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums font-semibold">{fmt(e.amount)}</td>
                  <td>
                    {e.ref_doc ?? "-"}
                    {e.note && <span className="block text-xs text-slate-500">{e.note}</span>}
                  </td>
                  <td className="whitespace-nowrap text-sm text-slate-600">{e.created_by_name ?? "-"}</td>
                  {isProcStaff && (
                    <td className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <EntryForm key={`${e.id}-${e.amount}-${e.sources.length}`} entry={e} projects={projects} sources={sources} onSaved={reload} />
                        <button type="button" onClick={() => remove(e)} className="btn-danger btn-sm">
                          ลบ
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isProcStaff ? 8 : 7} className="table-empty">
                    ยังไม่มีรายการตัดงบนอกระบบ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
