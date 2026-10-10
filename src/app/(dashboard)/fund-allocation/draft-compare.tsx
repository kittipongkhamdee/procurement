"use client";

// ตารางเทียบ "ร่างโครงการปีงบประมาณนี้" กับโครงการปีงบประมาณก่อน — แสดงทั้งโครงการและกิจกรรมย่อย
// จัดกลุ่มตามกลุ่มบริหารงาน ให้กรอกวงเงินปีนี้ข้างๆ ยอดปีก่อนได้เลย (ใช้ในแท็บ "ร่างโครงการปีงบประมาณนี้")
//
// - ร่างจับคู่กับโครงการปีก่อนด้วย plan_draft_projects.source_project_id ถ้ามี ไม่งั้นจับคู่ตามชื่อ
//   (เลือกจับคู่เองได้ตอนกดแก้ไข)
// - ร่างที่มีกิจกรรมย่อย: งบโครงการ = ผลรวมกิจกรรม / ไม่มีกิจกรรม: กรอกงบที่ระดับโครงการ
// - โครงการปีก่อนที่ยังไม่มีร่าง แสดงเป็นแถวสีเทา กด "สร้างร่างจากโครงการนี้" ได้

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { useSchoolSettings } from "@/lib/school-settings";
import { ExcelFileIcon, PrinterIcon } from "@/components/icons";
import { buildDraftCompareWorkbook, type DraftCompareExportGroup } from "@/lib/draft-compare-export";
import {
  acquireDraftEditLock,
  copyActivitiesFromPrevious,
  createDraftFromProject,
  createDraftProject,
  deleteDraftProject,
  discardNewDraftProject,
  releaseDraftEditLock,
  saveDraftProject,
} from "./actions";

type Option = { id: string; name: string };
type BudgetYear = { id: string; year: number; is_open: boolean };

type PrevActivity = { name: string; budget: number };
type PrevProject = {
  id: string;
  name: string;
  adminGroupId: string | null;
  budgetSourceId: string | null;
  activities: PrevActivity[];
  total: number;
};

type DraftActivity = { id: string; name: string; budget: number };
type Draft = {
  id: string;
  name: string;
  adminGroupId: string | null;
  budgetSourceId: string | null;
  sourceProjectId: string | null;
  budget: number;
  activities: DraftActivity[];
  editingByName: string | null;
};

type FormActivity = { key: string; id?: string; name: string; budget: string };
type EditForm = {
  name: string;
  adminGroupId: string;
  budgetSourceId: string;
  sourceProjectId: string;
  budget: string;
  activities: FormActivity[];
};

// ล็อกแก้ไขหมดอายุหลังเวลานี้ — ต้องตรงกับ EDIT_LOCK_MINUTES ใน actions.ts
const EDIT_LOCK_MINUTES = 10;
const NO_GROUP = "__none__";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function norm(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function diffClass(diff: number) {
  if (Math.abs(diff) < 0.005) return "text-slate-500";
  return diff > 0 ? "text-amber-700" : "text-emerald-700";
}

function formatDiff(diff: number) {
  if (Math.abs(diff) < 0.005) return "0.00";
  return `${diff > 0 ? "+" : ""}${formatBaht(diff)}`;
}

// แถวกิจกรรมที่จับคู่ฝั่งปีก่อน/ปีนี้ตามชื่อ (ที่ไม่มีคู่แสดงเป็นแถวเดี่ยว)
type ActivityLine = { name: string; prev: number | null; next: number | null };

function mergeActivities(prev: PrevActivity[], next: DraftActivity[]): ActivityLine[] {
  const usedPrev = new Set<number>();
  const lines: ActivityLine[] = next.map((n) => {
    const idx = prev.findIndex((p, i) => !usedPrev.has(i) && norm(p.name) === norm(n.name));
    if (idx >= 0) usedPrev.add(idx);
    return { name: n.name, prev: idx >= 0 ? prev[idx].budget : null, next: n.budget };
  });
  prev.forEach((p, i) => {
    if (!usedPrev.has(i)) lines.push({ name: p.name, prev: p.budget, next: null });
  });
  return lines;
}

export function DraftCompare({
  budgetYearId,
  budgetYears,
  adminGroups,
  budgetSources,
  isAdmin,
  canEditDraft,
  groupAllocations,
  myUserId,
  onChanged,
}: {
  budgetYearId: string;
  budgetYears: BudgetYear[];
  adminGroups: Option[];
  budgetSources: Option[];
  isAdmin: boolean;
  canEditDraft: boolean;
  groupAllocations: Record<string, number>;
  myUserId: string | null;
  /** เรียกหลังบันทึก/เพิ่ม/ลบ เพื่อให้หน้าแม่รีโหลดตารางสรุปด้านบน */
  onChanged: () => void;
}) {
  const targetYear = budgetYears.find((y) => y.id === budgetYearId) ?? null;
  const otherYears = budgetYears.filter((y) => y.id !== budgetYearId);

  const [compareYearId, setCompareYearId] = useState("");
  const [prevProjects, setPrevProjects] = useState<PrevProject[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDraftId, setNewDraftId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [acquiringId, setAcquiringId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { schoolName } = useSchoolSettings();

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const keyCounter = useRef(0);

  useEffect(() => {
    if (compareYearId || otherYears.length === 0 || !targetYear) return;
    const older = otherYears.filter((y) => y.year < targetYear.year).sort((a, b) => b.year - a.year);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompareYearId((older[0] ?? otherYears[0]).id);
  }, [otherYears, targetYear, compareYearId]);

  const loadPrev = useCallback(async (yearId: string) => {
    if (!yearId) {
      setPrevProjects([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("plan_projects")
      .select("id, name, budget, admin_group_id, budget_source_id, sort_order, plan_activities(name, budget, sort_order)")
      .eq("budget_year_id", yearId)
      .order("sort_order")
      .order("name");
    setPrevProjects(
      (data ?? []).map((p) => {
        const rawActs = [...((p.plan_activities as unknown as { name: string | null; budget: number; sort_order: number }[]) ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order);
        // โครงการที่ไม่มีกิจกรรมย่อย: ระบบเดิมเก็บงบไว้ในกิจกรรมเดียวที่ไม่มีชื่อ — ถือว่าไม่มีกิจกรรมย่อย (ใช้ยอดนั้นเป็นงบโครงการ)
        const noSubActivities = rawActs.length === 1 && !rawActs[0].name?.trim();
        const acts = noSubActivities
          ? []
          : rawActs.map((a, i) => ({ name: a.name?.trim() || `กิจกรรมที่ ${i + 1}`, budget: Number(a.budget ?? 0) }));
        return {
          id: p.id,
          name: p.name,
          adminGroupId: p.admin_group_id,
          budgetSourceId: p.budget_source_id,
          activities: acts,
          total: noSubActivities
            ? Number(rawActs[0].budget ?? 0)
            : acts.length > 0
              ? acts.reduce((s, a) => s + a.budget, 0)
              : Number(p.budget ?? 0),
        };
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPrev(compareYearId);
  }, [compareYearId, loadPrev]);

  const loadDrafts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("plan_draft_projects")
      .select(
        "id, name, admin_group_id, budget_source_id, source_project_id, budget, editing_by, editing_by_name, editing_at, sort_order, created_at, plan_draft_activities(id, name, budget, sort_order)",
      )
      .eq("budget_year_id", budgetYearId)
      .order("sort_order")
      .order("created_at")
      // ตัวตัดสินสุดท้ายที่คงที่ ไม่งั้นแถวที่ sort_order/created_at เท่ากันสลับลำดับทุกครั้งที่ถูก UPDATE
      .order("id");
    setDrafts(
      (data ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        adminGroupId: d.admin_group_id,
        budgetSourceId: d.budget_source_id,
        sourceProjectId: d.source_project_id,
        budget: Number(d.budget ?? 0),
        activities: [...((d.plan_draft_activities as unknown as (DraftActivity & { sort_order: number })[]) ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((a) => ({ id: a.id, name: a.name, budget: Number(a.budget ?? 0) })),
        // แสดง "กำลังแก้ไขโดย…" เฉพาะล็อกของคนอื่นที่ยังไม่หมดอายุ
        editingByName:
          d.editing_by_name &&
          d.editing_by !== myUserId &&
          d.editing_at &&
          Date.now() - new Date(d.editing_at).getTime() < EDIT_LOCK_MINUTES * 60 * 1000
            ? d.editing_by_name
            : null,
      })),
    );
  }, [budgetYearId, myUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDrafts();
  }, [loadDrafts]);

  // โพลเป็นระยะเพื่อให้เห็นว่าใครกำลังแก้ไขแถวไหนอยู่ (ฟอร์มที่กำลังแก้ของตัวเองแยก state จึงไม่ถูกทับ)
  useEffect(() => {
    const interval = setInterval(() => {
      loadDrafts();
    }, 8000);
    return () => clearInterval(interval);
  }, [loadDrafts]);

  async function refreshAll() {
    await Promise.all([loadDrafts(), loadPrev(compareYearId)]);
    onChanged();
  }

  // จับคู่ร่าง -> โครงการปีก่อน (ผูกไว้ชัดเจนก่อน แล้วค่อยจับตามชื่อ โครงการปีก่อนหนึ่งโครงการจับได้หนึ่งร่าง)
  const { matchByDraft, unmatchedPrev } = useMemo(() => {
    const prevList = prevProjects ?? [];
    const prevById = new Map(prevList.map((p) => [p.id, p]));
    const claimed = new Set<string>();
    const map = new Map<string, PrevProject>();
    for (const d of drafts ?? []) {
      const p = d.sourceProjectId ? prevById.get(d.sourceProjectId) : undefined;
      if (p && !claimed.has(p.id)) {
        map.set(d.id, p);
        claimed.add(p.id);
      }
    }
    for (const d of drafts ?? []) {
      if (map.has(d.id) || d.sourceProjectId) continue;
      const p = prevList.find((x) => !claimed.has(x.id) && norm(x.name) === norm(d.name));
      if (p) {
        map.set(d.id, p);
        claimed.add(p.id);
      }
    }
    return { matchByDraft: map, unmatchedPrev: prevList.filter((p) => !claimed.has(p.id)) };
  }, [prevProjects, drafts]);

  const pendingPairs = useMemo(
    () =>
      (drafts ?? [])
        .filter((d) => {
          const p = matchByDraft.get(d.id);
          return p && p.activities.length > 0 && d.activities.length === 0;
        })
        .map((d) => ({ draftId: d.id, projectId: matchByDraft.get(d.id)!.id })),
    [drafts, matchByDraft],
  );

  const groups = useMemo(() => {
    const s = norm(search);
    const keyOf = (id: string | null) => (id && adminGroups.some((g) => g.id === id) ? id : NO_GROUP);
    const order = [...adminGroups.map((g) => g.id), NO_GROUP];
    return order
      .map((gid) => {
        const draftRows = (drafts ?? []).filter((d) => keyOf(d.adminGroupId) === gid && (!s || norm(d.name).includes(s)));
        const prevRows = unmatchedPrev.filter((p) => keyOf(p.adminGroupId) === gid && (!s || norm(p.name).includes(s)));
        const allDrafts = (drafts ?? []).filter((d) => keyOf(d.adminGroupId) === gid);
        const prevTotal = allDrafts.reduce((sum, d) => sum + (matchByDraft.get(d.id)?.total ?? 0), 0) +
          unmatchedPrev.filter((p) => keyOf(p.adminGroupId) === gid).reduce((sum, p) => sum + p.total, 0);
        const nextTotal = allDrafts.reduce((sum, d) => sum + d.budget, 0);
        return {
          id: gid,
          name: gid === NO_GROUP ? "ไม่ระบุกลุ่มบริหาร" : (adminGroups.find((g) => g.id === gid)?.name ?? ""),
          draftRows,
          prevRows,
          prevTotal,
          nextTotal,
          allocated: gid === NO_GROUP ? null : (groupAllocations[gid] ?? 0),
        };
      })
      .filter((g) => (groupFilter ? g.id === groupFilter : true) && (g.draftRows.length > 0 || g.prevRows.length > 0));
  }, [adminGroups, drafts, unmatchedPrev, matchByDraft, groupAllocations, search, groupFilter]);

  const grand = useMemo(() => {
    const prevTotal = (prevProjects ?? []).reduce((s, p) => s + p.total, 0);
    const nextTotal = (drafts ?? []).reduce((s, d) => s + d.budget, 0);
    return { prevTotal, nextTotal };
  }, [prevProjects, drafts]);

  // เลื่อนไปที่แถวที่เพิ่งเปิดแก้ไข (เช่น เพิ่มร่างใหม่ที่อยู่ท้ายตาราง)
  useEffect(() => {
    if (!editingId) return;
    document.getElementById(`draft-edit-${editingId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [editingId]);

  function newKey() {
    keyCounter.current += 1;
    return `k${keyCounter.current}`;
  }

  function formFromDraft(d: Draft): EditForm {
    const match = matchByDraft.get(d.id);
    return {
      name: d.name,
      adminGroupId: d.adminGroupId ?? "",
      budgetSourceId: d.budgetSourceId ?? "",
      sourceProjectId: match?.id ?? "",
      budget: String(d.budget),
      activities: d.activities.map((a) => ({ key: newKey(), id: a.id, name: a.name, budget: String(a.budget) })),
    };
  }

  async function startEdit(d: Draft) {
    setAcquiringId(d.id);
    try {
      await acquireDraftEditLock(d.id, budgetYearId);
      setEditingId(d.id);
      setForm(formFromDraft(d));
    } catch (err) {
      await toastError(errorMessage(err));
      await loadDrafts();
    } finally {
      setAcquiringId(null);
    }
  }

  async function cancelEdit(d: Draft) {
    setEditingId(null);
    setForm(null);
    try {
      if (d.id === newDraftId) {
        setNewDraftId(null);
        const { deleted } = await discardNewDraftProject(d.id, budgetYearId);
        if (deleted) {
          setDrafts((prev) => (prev ? prev.filter((r) => r.id !== d.id) : prev));
          onChanged();
          return;
        }
      } else {
        await releaseDraftEditLock(d.id, budgetYearId);
      }
      await loadDrafts();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function saveEdit(d: Draft) {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      await toastError("กรุณากรอกชื่อโครงการ");
      return;
    }
    const hasActivities = form.activities.length > 0;
    const acts = form.activities.map((a) => ({ id: a.id, name: a.name.trim(), budget: Number(a.budget || 0) }));
    if (acts.some((a) => !a.name)) {
      await toastError("กรุณากรอกชื่อกิจกรรมให้ครบ");
      return;
    }
    if (acts.some((a) => Number.isNaN(a.budget) || a.budget < 0)) {
      await toastError("กรุณากรอกงบกิจกรรมให้ถูกต้อง");
      return;
    }
    const budget = Number(form.budget || 0);
    if (!hasActivities && (Number.isNaN(budget) || budget < 0)) {
      await toastError("กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setSavingId(d.id);
    try {
      const result = await saveDraftProject(d.id, budgetYearId, {
        name,
        admin_group_id: form.adminGroupId || null,
        budget_source_id: form.budgetSourceId || null,
        source_project_id: form.sourceProjectId || null,
        budget,
        activities: hasActivities ? acts : null,
      });
      if (result.error) {
        await toastError(result.error);
        return;
      }
      setNewDraftId(null);
      setEditingId(null);
      setForm(null);
      await refreshAll();
      await toastSuccess("บันทึกร่างโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const created = await createDraftProject(budgetYearId);
      if (created) {
        const d: Draft = {
          id: created.id,
          name: created.name,
          adminGroupId: created.admin_group_id,
          budgetSourceId: created.budget_source_id,
          sourceProjectId: null,
          budget: Number(created.budget ?? 0),
          activities: [],
          editingByName: null,
        };
        setDrafts((prev) => [...(prev ?? []), d]);
        setSearch("");
        setGroupFilter("");
        setNewDraftId(d.id);
        setEditingId(d.id);
        setForm(formFromDraft(d));
        onChanged();
      }
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(d: Draft) {
    const ok = await confirmDelete({ title: `ลบร่างโครงการ "${d.name}"?`, text: "กิจกรรมย่อยของร่างนี้จะถูกลบด้วย ไม่สามารถกู้คืนได้" });
    if (!ok) return;
    setSavingId(d.id);
    try {
      await deleteDraftProject(d.id);
      setDrafts((prev) => (prev ? prev.filter((r) => r.id !== d.id) : prev));
      onChanged();
      await toastSuccess("ลบร่างโครงการเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingId(null);
    }
  }

  async function copyActivities(pairs: { draftId: string; projectId: string }[], busyId: string | null) {
    if (busyId) setBusyProjectId(busyId);
    else setBulkBusy(true);
    try {
      const result = await copyActivitiesFromPrevious(budgetYearId, pairs);
      if (result.error) {
        await toastError(result.error);
        return;
      }
      await refreshAll();
      await toastSuccess(
        result.copied > 0
          ? `ดึงกิจกรรมจากปีก่อนให้ ${result.copied} ร่างโครงการแล้ว (งบกิจกรรมเริ่มที่ 0 กรอกวงเงินปีนี้ได้เลย)`
          : "ไม่มีร่างที่ต้องดึงกิจกรรม",
      );
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusyProjectId(null);
      setBulkBusy(false);
    }
  }

  async function handleBulkCopy() {
    const ok = await confirmWarning({
      title: `ดึงกิจกรรมจากปีก่อนให้ ${pendingPairs.length} ร่างโครงการ?`,
      text: "ทำเฉพาะร่างที่ยังไม่มีกิจกรรม ได้ชื่อกิจกรรมเหมือนปีก่อนและงบกิจกรรมเริ่มที่ 0 ส่วนงบโครงการเดิมของร่างจะไม่ถูกเปลี่ยนจนกว่าจะกดแก้ไขและบันทึก",
      confirmButtonText: "ดึงกิจกรรม",
    });
    if (!ok) return;
    await copyActivities(pendingPairs, null);
  }

  async function handleCreateFromPrev(p: PrevProject) {
    setBusyProjectId(p.id);
    try {
      const result = await createDraftFromProject(budgetYearId, p.id);
      if (result.error) {
        await toastError(result.error);
        return;
      }
      await refreshAll();
      await toastSuccess(`สร้างร่างโครงการ "${p.name}" แล้ว กรอกวงเงินปีนี้ได้เลย`);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusyProjectId(null);
    }
  }

  // ---------- ส่วนแสดงผล ----------

  function renderEditor(d: Draft) {
    if (!form) return null;
    const isSaving = savingId === d.id;
    const prevLookup = (name: string) => {
      const match = prevProjects?.find((p) => p.id === form.sourceProjectId);
      return match?.activities.find((a) => norm(a.name) === norm(name))?.budget ?? null;
    };
    const selectedPrev = prevProjects?.find((p) => p.id === form.sourceProjectId) ?? null;
    const claimedElsewhere = new Set(
      (drafts ?? []).filter((x) => x.id !== d.id).map((x) => matchByDraft.get(x.id)?.id).filter((x): x is string => !!x),
    );
    const sumActs = form.activities.reduce((s, a) => s + Number(a.budget || 0), 0);
    return (
      <div id={`draft-edit-${d.id}`} className="space-y-3 bg-navy-950/[0.03] px-4 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">ชื่อโครงการ</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={isSaving}
              className="input font-medium disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="label">กลุ่มบริหาร</label>
            <select
              value={form.adminGroupId}
              onChange={(e) => setForm({ ...form, adminGroupId: e.target.value })}
              disabled={isSaving}
              className="input disabled:bg-slate-100"
            >
              <option value="">ไม่ระบุ</option>
              {adminGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">แหล่งงบประมาณ</label>
            <select
              value={form.budgetSourceId}
              onChange={(e) => setForm({ ...form, budgetSourceId: e.target.value })}
              disabled={isSaving}
              className="input disabled:bg-slate-100"
            >
              <option value="">ไม่ระบุ</option>
              {budgetSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">
              เทียบกับโครงการปี {budgetYears.find((y) => y.id === compareYearId)?.year ?? "ก่อน"}
            </label>
            <select
              value={form.sourceProjectId}
              onChange={(e) => setForm({ ...form, sourceProjectId: e.target.value })}
              disabled={isSaving}
              className="input disabled:bg-slate-100"
            >
              <option value="">ไม่เทียบกับโครงการใด (เป็นโครงการใหม่)</option>
              {(prevProjects ?? [])
                .filter((p) => p.id === form.sourceProjectId || !claimedElsewhere.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatBaht(p.total)})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="label !mb-0">กิจกรรมย่อย</span>
            <div className="flex gap-2">
              {selectedPrev && selectedPrev.activities.length > 0 && form.activities.length === 0 && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    setForm({
                      ...form,
                      activities: selectedPrev.activities.map((a) => ({ key: newKey(), name: a.name, budget: "0" })),
                    })
                  }
                  className="btn-secondary btn-sm"
                >
                  ดึงชื่อกิจกรรมจากปีก่อน
                </button>
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  setForm({ ...form, activities: [...form.activities, { key: newKey(), name: "", budget: "0" }] })
                }
                className="btn-secondary btn-sm"
              >
                + เพิ่มกิจกรรม
              </button>
            </div>
          </div>

          {form.activities.length === 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="label">งบประมาณโครงการปี {targetYear?.year} (ไม่มีกิจกรรมย่อย)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  disabled={isSaving}
                  className="input text-right disabled:bg-slate-100"
                />
              </div>
              {selectedPrev && <p className="text-sm text-slate-500">ปีก่อน {formatBaht(selectedPrev.total)}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {form.activities.map((a, i) => {
                const prevBudget = prevLookup(a.name);
                return (
                  <div key={a.key} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2 md:grid-cols-[1fr_9rem_9rem_auto]">
                    <input
                      type="text"
                      value={a.name}
                      placeholder={`ชื่อกิจกรรมที่ ${i + 1}`}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          activities: form.activities.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)),
                        })
                      }
                      disabled={isSaving}
                      className="input disabled:bg-slate-100"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={a.budget}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          activities: form.activities.map((x) => (x.key === a.key ? { ...x, budget: e.target.value } : x)),
                        })
                      }
                      disabled={isSaving}
                      className="input text-right disabled:bg-slate-100"
                    />
                    <span className="hidden text-right text-sm tabular-nums text-slate-500 md:block">
                      {prevBudget === null ? "—" : `ปีก่อน ${formatBaht(prevBudget)}`}
                    </span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setForm({ ...form, activities: form.activities.filter((x) => x.key !== a.key) })}
                      className="btn-danger btn-sm"
                      aria-label="ลบกิจกรรม"
                    >
                      ลบ
                    </button>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-semibold text-slate-700">งบโครงการ = ผลรวมกิจกรรม</span>
                <span className="tabular-nums font-semibold text-slate-900">{formatBaht(sumActs)}</span>
              </div>
              {sumActs === 0 && d.budget > 0 && (
                <p className="text-xs text-amber-700">
                  งบโครงการเดิมคือ {formatBaht(d.budget)} — ยังไม่ได้กระจายลงกิจกรรม ถ้าบันทึกตอนนี้งบโครงการจะเป็น 0
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => cancelEdit(d)} disabled={isSaving} className="btn-secondary btn-sm">
            ยกเลิก
          </button>
          <button type="button" onClick={() => saveEdit(d)} disabled={isSaving} className="btn-primary btn-sm">
            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    );
  }

  function draftActions(d: Draft, hasPrevActs: boolean) {
    const match = matchByDraft.get(d.id);
    const isAcquiring = acquiringId === d.id;
    const busy = busyProjectId === d.id;
    if (d.editingByName) return <span className="text-xs text-amber-700">กำลังแก้ไขโดย {d.editingByName}</span>;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canEditDraft && match && hasPrevActs && d.activities.length === 0 && (
          <button
            type="button"
            onClick={() => copyActivities([{ draftId: d.id, projectId: match.id }], d.id)}
            disabled={busy || editingId !== null}
            className="btn-secondary btn-sm"
          >
            {busy ? "กำลังดึง..." : "ดึงกิจกรรมปีก่อน"}
          </button>
        )}
        {canEditDraft && (
          <button
            type="button"
            onClick={() => startEdit(d)}
            disabled={editingId !== null || isAcquiring}
            className="btn-secondary btn-sm"
          >
            {isAcquiring ? "กำลังเปิด..." : "แก้ไข"}
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => handleDelete(d)}
            disabled={savingId === d.id || editingId !== null}
            className="btn-danger btn-sm"
          >
            ลบ
          </button>
        )}
      </div>
    );
  }

  const prevYearLabel = budgetYears.find((y) => y.id === compareYearId)?.year ?? "ก่อน";
  const targetYearLabel = targetYear?.year ?? "";
  // ส่งออก Excel: หนึ่งแผ่นต่อหนึ่งกลุ่มบริหารงาน (ตามตัวกรองกลุ่ม/ค้นหาที่เลือกอยู่) + แผ่นสรุป
  async function handleExportExcel() {
    if (groups.length === 0) {
      await toastError("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    setExporting(true);
    try {
      const exportGroups: DraftCompareExportGroup[] = groups.map((g) => ({
        name: g.name,
        allocated: g.allocated,
        prevTotal: g.prevTotal,
        nextTotal: g.nextTotal,
        projects: [
          ...g.draftRows.map((d) => {
            const match = matchByDraft.get(d.id);
            return {
              name: d.name,
              prev: match ? match.total : null,
              next: d.budget,
              note: match ? undefined : "ไม่มีโครงการเทียบ",
              activities: mergeActivities(match?.activities ?? [], d.activities),
            };
          }),
          ...g.prevRows.map((p) => ({
            name: p.name,
            prev: p.total,
            next: null,
            note: `ยังไม่มีร่างปี ${targetYearLabel}`,
            activities: p.activities.map((a) => ({ name: a.name, prev: a.budget, next: null })),
          })),
        ],
      }));
      const buffer = await buildDraftCompareWorkbook({
        schoolName,
        prevYear: prevYearLabel,
        nextYear: targetYearLabel,
        groups: exportGroups,
      });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ร่างโครงการ_${targetYearLabel}_เทียบ_${prevYearLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const loading = drafts === null || prevProjects === null;

  return (
    <div>
      {/* ตั้งหน้ากระดาษ A4 แนวตั้งตอนพิมพ์ (มีผลเฉพาะตอนหน้านี้เปิดอยู่) */}
      <style>{`@media print { @page { size: A4 portrait; margin: 12mm; } }`}</style>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <div>
          <label className="label">เทียบกับปีงบประมาณ</label>
          <select value={compareYearId} onChange={(e) => setCompareYearId(e.target.value)} className="input">
            {otherYears.length === 0 && <option value="">ไม่มีปีงบประมาณอื่น</option>}
            {otherYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ค้นหาชื่อโครงการ</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="พิมพ์ชื่อโครงการ..."
            className="input"
          />
        </div>
        <div>
          <label className="label">กลุ่มบริหารงาน</label>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="input">
            <option value="">ทั้งหมด</option>
            {adminGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-slate-600">
          รวมปี {prevYearLabel}: <span className="tabular-nums font-semibold">{formatBaht(grand.prevTotal)}</span> · รวมปี{" "}
          {targetYearLabel}: <span className="tabular-nums font-semibold">{formatBaht(grand.nextTotal)}</span> · ผลต่าง:{" "}
          <span className={`tabular-nums font-semibold ${diffClass(grand.nextTotal - grand.prevTotal)}`}>
            {formatDiff(grand.nextTotal - grand.prevTotal)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} disabled={groups.length === 0} className="btn-secondary btn-sm">
            <PrinterIcon className="h-3.5 w-3.5" />
            พิมพ์
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || groups.length === 0}
            className="btn-secondary btn-sm"
          >
            <ExcelFileIcon className="h-3.5 w-3.5" />
            {exporting ? "กำลังสร้างไฟล์..." : "ส่งออก Excel"}
          </button>
        </div>
        {canEditDraft && (
          <div className="flex flex-wrap gap-2">
            {pendingPairs.length > 0 && (
              <button
                type="button"
                onClick={handleBulkCopy}
                disabled={bulkBusy || editingId !== null}
                className="btn-secondary btn-sm"
              >
                {bulkBusy ? "กำลังดึง..." : `ดึงกิจกรรมปีก่อนให้ร่างที่จับคู่แล้ว (${pendingPairs.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || editingId !== null}
              className="btn-primary btn-sm"
            >
              {adding ? "กำลังเพิ่ม..." : "+ เพิ่มร่างโครงการ"}
            </button>
          </div>
        )}
      </div>

      {loading && <p className="table-empty">กำลังโหลด...</p>}
      {!loading && groups.length === 0 && (
        <p className="table-empty">
          {(drafts ?? []).length === 0 && (prevProjects ?? []).length === 0
            ? 'ยังไม่มีร่างโครงการ — คัดลอกจากปีเดิมที่แท็บ "คัดลอกโครงการเดิม" หรือกด "+ เพิ่มร่างโครงการ"'
            : "ไม่พบโครงการตามตัวกรองที่เลือก"}
        </p>
      )}

      <div className="space-y-5 print:space-y-0">
        {groups.map((g, gi) => {
          const remain = g.allocated === null ? null : g.allocated - g.nextTotal;
          return (
            <section
              key={g.id}
              className={gi < groups.length - 1 ? "print:break-after-page" : ""}
            >
              {/* หัวกระดาษตอนพิมพ์ (ซ้ำทุกหน้า = ทุกกลุ่มบริหาร) */}
              <div className="mb-2 hidden border-b-2 border-navy-800 pb-2 print:block">
                <div className="text-xs text-slate-600">{schoolName}</div>
                <div className="text-base font-bold text-navy-800">
                  ร่างโครงการปีงบประมาณ {targetYearLabel} เทียบกับปีงบประมาณ {prevYearLabel}
                </div>
              </div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h3 className="text-sm font-bold text-navy-800">{g.name}</h3>
                <p className="text-xs text-slate-500">
                  ปี {prevYearLabel} {formatBaht(g.prevTotal)} → ปี {targetYearLabel} {formatBaht(g.nextTotal)}
                  {g.allocated !== null && g.allocated > 0 && remain !== null && (
                    <>
                      {" "}
                      · จัดสรรให้กลุ่ม {formatBaht(g.allocated)} ·{" "}
                      <span className={remain < -0.005 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>
                        {remain < -0.005 ? `เกินงบจัดสรร ${formatBaht(-remain)}` : `เหลือ ${formatBaht(remain)}`}
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="table-shell">
                {/* มือถือ/จอแคบกว่า md: การ์ดต่อโครงการ */}
                <div className="divide-y divide-slate-100 md:hidden print:hidden">
                  {g.draftRows.map((d, i) => {
                    const match = matchByDraft.get(d.id);
                    const lines = mergeActivities(match?.activities ?? [], d.activities);
                    const prevTotal = match?.total ?? null;
                    if (editingId === d.id) return <Fragment key={d.id}>{renderEditor(d)}</Fragment>;
                    return (
                      <div key={d.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 break-words font-medium text-slate-900">
                            <span className="text-xs text-slate-400">#{i + 1}</span> {d.name}
                          </span>
                        </div>
                        <p className="mt-1 text-sm tabular-nums text-slate-700">
                          ปี {prevYearLabel}: {prevTotal === null ? "—" : formatBaht(prevTotal)} · ปี {targetYearLabel}:{" "}
                          <span className="font-semibold">{formatBaht(d.budget)}</span>
                          {prevTotal !== null && (
                            <span className={`ml-2 font-semibold ${diffClass(d.budget - prevTotal)}`}>
                              {formatDiff(d.budget - prevTotal)}
                            </span>
                          )}
                        </p>
                        {prevTotal === null && <p className="text-xs text-slate-400">ไม่มีโครงการเทียบในปี {prevYearLabel}</p>}
                        {lines.length > 0 && (
                          <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
                            {lines.map((l, li) => (
                              <li key={li} className="text-xs text-slate-600">
                                <span className="break-words">{l.name}</span>
                                <span className="ml-1 tabular-nums text-slate-500">
                                  {l.prev === null ? "—" : formatBaht(l.prev)} →{" "}
                                  <span className="font-semibold text-slate-800">
                                    {l.next === null ? "—" : formatBaht(l.next)}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2">{draftActions(d, (match?.activities.length ?? 0) > 0)}</div>
                      </div>
                    );
                  })}
                  {g.prevRows.map((p) => (
                    <div key={p.id} className="bg-slate-50 px-4 py-3">
                      <p className="break-words font-medium text-slate-500">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        ปี {prevYearLabel}: {formatBaht(p.total)} · ยังไม่มีร่างปี {targetYearLabel}
                      </p>
                      {canEditDraft && (
                        <button
                          type="button"
                          onClick={() => handleCreateFromPrev(p)}
                          disabled={busyProjectId === p.id || editingId !== null}
                          className="btn-secondary btn-sm mt-2"
                        >
                          {busyProjectId === p.id ? "กำลังสร้าง..." : "สร้างร่างจากโครงการนี้"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* จอกว้าง md ขึ้นไป: ตารางเทียบ */}
                <table className="hidden table-base min-w-0 md:table print:table [&_td]:px-3 [&_th]:px-3 print:[&_td:nth-child(6)]:hidden print:[&_th:nth-child(6)]:hidden print:[&_tr]:break-inside-avoid">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>โครงการ / กิจกรรม</th>
                      <th className="whitespace-nowrap text-right">ปี {prevYearLabel}</th>
                      <th className="whitespace-nowrap text-right">ปี {targetYearLabel}</th>
                      <th className="whitespace-nowrap text-right">ผลต่าง</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.draftRows.map((d, i) => {
                      const match = matchByDraft.get(d.id);
                      const lines = mergeActivities(match?.activities ?? [], d.activities);
                      const prevTotal = match?.total ?? null;
                      const actSum = d.activities.reduce((s, a) => s + a.budget, 0);
                      const mismatch = d.activities.length > 0 && Math.abs(actSum - d.budget) > 0.005;
                      if (editingId === d.id) {
                        return (
                          <tr key={d.id}>
                            <td colSpan={6} className="!p-0">
                              {renderEditor(d)}
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <Fragment key={d.id}>
                          <tr className="bg-slate-50/60">
                            <td className="text-center tabular-nums text-slate-400">{i + 1}</td>
                            <td className="min-w-[12rem] max-w-[22rem]">
                              <span className="break-words font-semibold text-slate-900">{d.name}</span>
                              {prevTotal === null && (
                                <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">
                                  ไม่มีโครงการเทียบ
                                </span>
                              )}
                              {mismatch && (
                                <p className="text-xs text-amber-700">
                                  ผลรวมกิจกรรม {formatBaht(actSum)} ไม่เท่างบโครงการ — กดแก้ไขแล้วบันทึกเพื่อปรับ
                                </p>
                              )}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums text-slate-600">
                              {prevTotal === null ? "—" : formatBaht(prevTotal)}
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums font-semibold text-slate-900">
                              {formatBaht(d.budget)}
                            </td>
                            <td
                              className={`whitespace-nowrap text-right tabular-nums font-semibold ${
                                prevTotal === null ? "text-slate-400" : diffClass(d.budget - prevTotal)
                              }`}
                            >
                              {prevTotal === null ? "—" : formatDiff(d.budget - prevTotal)}
                            </td>
                            <td className="whitespace-nowrap text-right">
                              {draftActions(d, (match?.activities.length ?? 0) > 0)}
                            </td>
                          </tr>
                          {lines.map((l, li) => (
                            <tr key={`${d.id}-${li}`}>
                              <td></td>
                              <td className="pl-6 text-slate-600">
                                <span className="break-words">– {l.name}</span>
                              </td>
                              <td className="whitespace-nowrap text-right tabular-nums text-slate-500">
                                {l.prev === null ? "—" : formatBaht(l.prev)}
                              </td>
                              <td className="whitespace-nowrap text-right tabular-nums text-slate-700">
                                {l.next === null ? "—" : formatBaht(l.next)}
                              </td>
                              <td
                                className={`whitespace-nowrap text-right tabular-nums ${
                                  l.prev === null || l.next === null ? "text-slate-300" : diffClass(l.next - l.prev)
                                }`}
                              >
                                {l.prev === null || l.next === null ? "—" : formatDiff(l.next - l.prev)}
                              </td>
                              <td></td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                    {g.prevRows.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="bg-slate-100/70 text-slate-500">
                          <td></td>
                          <td className="min-w-[12rem] max-w-[22rem]">
                            <span className="break-words font-semibold">{p.name}</span>
                            <span className="ml-2 text-xs">ยังไม่มีร่างปี {targetYearLabel}</span>
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(p.total)}</td>
                          <td className="text-right">—</td>
                          <td className="text-right">—</td>
                          <td className="whitespace-nowrap text-right">
                            {canEditDraft && (
                              <button
                                type="button"
                                onClick={() => handleCreateFromPrev(p)}
                                disabled={busyProjectId === p.id || editingId !== null}
                                className="btn-secondary btn-sm"
                              >
                                {busyProjectId === p.id ? "กำลังสร้าง..." : "สร้างร่างจากโครงการนี้"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {p.activities.map((a, ai) => (
                          <tr key={`${p.id}-${ai}`} className="bg-slate-100/40 text-slate-500">
                            <td></td>
                            <td className="pl-6">
                              <span className="break-words">– {a.name}</span>
                            </td>
                            <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(a.budget)}</td>
                            <td className="text-right">—</td>
                            <td className="text-right">—</td>
                            <td></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      <td className="font-semibold text-slate-700">รวม {g.name}</td>
                      <td className="whitespace-nowrap text-right tabular-nums font-semibold">{formatBaht(g.prevTotal)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums font-semibold">{formatBaht(g.nextTotal)}</td>
                      <td
                        className={`whitespace-nowrap text-right tabular-nums font-semibold ${diffClass(g.nextTotal - g.prevTotal)}`}
                      >
                        {formatDiff(g.nextTotal - g.prevTotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
