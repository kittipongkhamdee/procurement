"use client";

// รายละเอียดรอบตรวจสอบพัสดุประจำปี 1 รอบ — 3 แท็บ: ตรวจนับ / สรุปผลต่าง / รายงานสรุป
// สิทธิ์แก้ไขผลตรวจนับ (แท็บ "ตรวจนับ") เปิดให้ทั้งเจ้าหน้าที่พัสดุ (canManage) และผู้ตรวจสอบที่ได้รับ
// แต่งตั้งในรอบนี้ (isInspector) — RLS (asset_audit_items_write) เป็นด่านจริง ฝั่งนี้แค่ซ่อน/แสดงปุ่ม
// ให้สอดคล้องกัน ส่วนแท็บ "รายงานสรุป" (ส่งรายงาน/แก้ข้อเสนอแนะ) จำกัดเฉพาะ canManage เท่านั้น

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { errorMessage, toastError, toastSuccess, confirmDelete, confirmWarning } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import { buildExcelBuffer } from "@/lib/excel";
import { ExcelFileIcon, PrinterIcon } from "@/components/icons";
import { QrScanButton } from "../../asset-register/qr-scan-button";
import {
  acknowledgeAuditReport,
  deleteAuditRound,
  reopenAuditRound,
  saveAuditReportNote,
  submitAuditReport,
  updateAuditItemResult,
} from "../actions";

const ALL = "__all__";
const INSPECT_STATUS = {
  pending: "ยังไม่ตรวจ",
  match: "พบตรงบัญชี",
  diff: "พบสภาพต่างจากบัญชี",
  notFound: "ตรวจไม่พบ",
} as const;

type Round = {
  id: string;
  fiscal_year: number;
  appointment_doc_ref: string | null;
  appointment_date: string | null;
  start_date: string;
  due_date: string;
  status: string;
  report_note: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
};

type Inspector = { user_id: string; full_name_snapshot: string; role_in_committee: string | null };

type Condition = { id: string; name: string; badge_color: string };

type AuditItemRow = {
  id: string;
  item_id: string;
  book_condition_id: string;
  found: boolean | null;
  actual_condition_id: string | null;
  actual_location: string | null;
  note: string | null;
  // จาก asset_items (join ด้วย Map ฝั่ง client ตามแพทเทิร์น register-tab.tsx/summary-tab.tsx)
  name: string;
  asset_code: string | null;
  category_id: string | null;
  location: string;
};

function inspectStatus(row: AuditItemRow): keyof typeof INSPECT_STATUS {
  if (row.found === null) return "pending";
  if (row.found === false) return "notFound";
  if (row.actual_condition_id !== row.book_condition_id) return "diff";
  return "match";
}

function statusBadge(status: string) {
  if (status === "submitted") return { cls: "badge-amber", label: "ส่งรายงานแล้ว" };
  if (status === "acknowledged") return { cls: "badge-emerald", label: "รับทราบผลแล้ว" };
  if (status === "in_progress") return { cls: "badge-slate", label: "กำลังตรวจนับ" };
  return { cls: "badge-slate", label: "แบบร่าง" };
}

function ResultModal({
  row,
  roundId,
  conditions,
  conditionLookup,
  canEdit,
  onSaved,
}: {
  row: AuditItemRow;
  roundId: string;
  conditions: Condition[];
  conditionLookup: Map<string, Condition>;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [found, setFound] = useState(row.found ?? true);
  const [submitting, setSubmitting] = useState(false);

  function handleOpen() {
    setFound(row.found ?? true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("found", String(found));
    if (found) {
      const actualConditionId = String(formData.get("actual_condition_id") ?? "");
      const note = String(formData.get("note") ?? "").trim();
      if (actualConditionId !== row.book_condition_id && !note) {
        await toastError("กรุณาระบุหมายเหตุ/เหตุผล เมื่อสภาพที่พบต่างจากบัญชี");
        return;
      }
    } else if (!String(formData.get("note") ?? "").trim()) {
      await toastError("กรุณาระบุหมายเหตุ/เหตุผล เมื่อตรวจไม่พบรายการนี้");
      return;
    }
    setSubmitting(true);
    try {
      await updateAuditItemResult(row.id, roundId, formData);
      await toastSuccess("บันทึกผลตรวจนับเรียบร้อยแล้ว");
      modalRef.current?.close();
      onSaved();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const st = inspectStatus(row);
  const stCls = st === "match" ? "badge-emerald" : st === "pending" ? "badge-slate" : st === "diff" ? "badge-amber" : "badge-red";

  return (
    <Modal
      ref={modalRef}
      trigger={<span onClick={handleOpen}>{canEdit ? "บันทึกผลตรวจนับ" : "ดูรายละเอียด"}</span>}
      triggerClassName="btn-secondary btn-sm"
      title={row.name}
    >
      <div>
        <p className="mb-3 text-sm text-slate-500">
          {row.asset_code ?? "ยังไม่ติดป้าย"} · {row.location} · สภาพตามบัญชี:{" "}
          <span className={`badge-${conditionLookup.get(row.book_condition_id)?.badge_color ?? "slate"}`}>
            {conditionLookup.get(row.book_condition_id)?.name ?? "-"}
          </span>{" "}
          <span className={stCls}>{INSPECT_STATUS[st]}</span>
        </p>
        {canEdit ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="radio" checked={found} onChange={() => setFound(true)} />
                พบตัวจริง
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!found} onChange={() => setFound(false)} />
                ตรวจไม่พบ
              </label>
            </div>
            {found && (
              <>
                <div>
                  <label className="label">สภาพที่พบจริง</label>
                  <select name="actual_condition_id" defaultValue={row.actual_condition_id ?? row.book_condition_id} className="input">
                    {conditions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">สถานที่พบจริง (ถ้าต่างจากทะเบียน)</label>
                  <input name="actual_location" defaultValue={row.actual_location ?? ""} className="input" />
                </div>
              </>
            )}
            <div>
              <label className="label">หมายเหตุ/เหตุผล {!found && <span className="text-red-600">*</span>}</label>
              <textarea name="note" defaultValue={row.note ?? ""} rows={2} className="input" />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "กำลังบันทึก..." : "บันทึกผลตรวจนับ"}
            </button>
          </form>
        ) : (
          <p className="text-sm text-slate-500">หมายเหตุ: {row.note ?? "-"}</p>
        )}
      </div>
    </Modal>
  );
}

export default function AssetAuditDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roundId = params.id;
  const { user, isAdmin, loading: authLoading } = useAuth();
  const canManage = isAdmin || user?.role === "supply_officer";

  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState<Round | null>(null);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [rows, setRows] = useState<AuditItemRow[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<"count" | "diff" | "report">("count");
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const isInspector = inspectors.some((i) => i.user_id === user?.userId);
  const canEditResults = (canManage || isInspector) && round?.status === "in_progress";
  const isDirector = user?.role === "director";

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: roundData }, { data: inspectorsData }, { data: auditItemsData }, { data: conditionsData }, { data: categoriesData }] =
      await Promise.all([
        supabase.from("asset_audit_rounds").select("*").eq("id", roundId).maybeSingle(),
        supabase.from("asset_audit_inspectors").select("user_id, full_name_snapshot, role_in_committee").eq("audit_round_id", roundId).order("sort_order"),
        supabase.from("asset_audit_items").select("*").eq("audit_round_id", roundId),
        supabase.from("asset_conditions").select("id, name, badge_color"),
        supabase.from("asset_categories").select("id, name"),
      ]);

    const itemIds = (auditItemsData ?? []).map((r) => r.item_id);
    const { data: assetItemsData } =
      itemIds.length > 0
        ? await supabase.from("asset_items").select("id, name, asset_code, category_id, building, floor, room").in("id", itemIds)
        : { data: [] };
    const assetItemLookup = new Map((assetItemsData ?? []).map((it) => [it.id, it]));

    const joined: AuditItemRow[] = (auditItemsData ?? []).map((r) => {
      const it = assetItemLookup.get(r.item_id);
      const location = it ? [it.building, it.floor ? `ชั้น ${it.floor}` : null, it.room ? `ห้อง ${it.room}` : null].filter(Boolean).join(" ") : "";
      return {
        id: r.id,
        item_id: r.item_id,
        book_condition_id: r.book_condition_id,
        found: r.found,
        actual_condition_id: r.actual_condition_id,
        actual_location: r.actual_location,
        note: r.note,
        name: it?.name ?? "(ไม่พบรายการในทะเบียน)",
        asset_code: it?.asset_code ?? null,
        category_id: it?.category_id ?? null,
        location,
      };
    });

    setRound(roundData ?? null);
    setInspectors(inspectorsData ?? []);
    setRows(joined);
    setConditions(conditionsData ?? []);
    setCategories(categoriesData ?? []);
    setReportNote(roundData?.report_note ?? "");
    setLoading(false);
  }, [roundId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (authLoading || loading) return <PageLoadingSkeleton />;
  if (!round) return <p className="table-empty">ไม่พบรอบตรวจสอบนี้</p>;

  const conditionLookup = new Map(conditions.map((c) => [c.id, c]));

  const filteredRows = rows.filter((r) => {
    if (categoryFilter !== ALL && r.category_id !== categoryFilter) return false;
    if (statusFilter !== ALL && inspectStatus(r) !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.name} ${r.asset_code ?? ""} ${r.location} ${r.item_id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totals = {
    total: rows.length,
    pending: rows.filter((r) => inspectStatus(r) === "pending").length,
    match: rows.filter((r) => inspectStatus(r) === "match").length,
    diff: rows.filter((r) => inspectStatus(r) === "diff").length,
    notFound: rows.filter((r) => inspectStatus(r) === "notFound").length,
  };

  const diffRows = rows.filter((r) => inspectStatus(r) === "diff" || inspectStatus(r) === "notFound");

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleExportDiff() {
    const buffer = await buildExcelBuffer(
      "สรุปผลต่างตรวจสอบพัสดุ",
      [
        { header: "รหัสครุภัณฑ์", key: "assetCode", width: 22 },
        { header: "ชื่อทรัพย์สิน", key: "name", width: 30 },
        { header: "สถานที่ตามทะเบียน", key: "location", width: 22 },
        { header: "สภาพตามบัญชี", key: "bookCondition", width: 18 },
        { header: "ผลตรวจนับ", key: "status", width: 18 },
        { header: "สภาพที่พบจริง", key: "actualCondition", width: 18 },
        { header: "หมายเหตุ", key: "note", width: 30 },
      ],
      diffRows.map((r) => ({
        assetCode: r.asset_code ?? "ยังไม่ติดป้าย",
        name: r.name,
        location: r.location,
        bookCondition: conditionLookup.get(r.book_condition_id)?.name ?? "-",
        status: INSPECT_STATUS[inspectStatus(r)],
        actualCondition: r.actual_condition_id ? (conditionLookup.get(r.actual_condition_id)?.name ?? "-") : "-",
        note: r.note ?? "-",
      })),
    );
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `สรุปผลต่างตรวจสอบพัสดุ-ปีงบ${round!.fiscal_year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveNote() {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("report_note", reportNote);
      await saveAuditReportNote(roundId, formData);
      await toastSuccess("บันทึกข้อเสนอแนะเรียบร้อยแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitReport() {
    if (totals.pending > 0) {
      const ok = await confirmWarning({
        title: `ยังตรวจนับไม่ครบ (เหลือ ${totals.pending} รายการ) ยืนยันส่งรายงานเลยหรือไม่?`,
        confirmButtonText: "ส่งรายงาน",
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("report_note", reportNote);
      await submitAuditReport(roundId, formData);
      await toastSuccess("ส่งรายงานผลการตรวจสอบเรียบร้อยแล้ว");
      await reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledge() {
    setSaving(true);
    try {
      await acknowledgeAuditReport(roundId);
      await toastSuccess("รับทราบผลการตรวจสอบเรียบร้อยแล้ว");
      await reload();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    try {
      await reopenAuditRound(roundId);
      await toastSuccess("เปิดให้แก้ไขต่อได้แล้ว");
      await reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDeleteRound() {
    const ok = await confirmDelete({ title: `ลบรอบตรวจสอบปีงบ ${round!.fiscal_year}?` });
    if (!ok) return;
    try {
      await deleteAuditRound(roundId);
      await toastSuccess("ลบรอบตรวจสอบเรียบร้อยแล้ว");
      router.push("/asset-audits");
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  const sb = statusBadge(round.status);

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/asset-audits" className="text-sm text-navy-800 hover:underline">
            &larr; รอบตรวจสอบทั้งหมด
          </Link>
          <h1 className="page-title">ตรวจสอบพัสดุประจำปีงบประมาณ {round.fiscal_year}</h1>
          <p className="page-subtitle">
            เริ่มตรวจ {formatThaiDate(round.start_date)} · ครบกำหนด {formatThaiDate(round.due_date)} ·{" "}
            <span className={sb.cls}>{sb.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/asset-audits/${roundId}/pdf`} target="_blank" className="btn-secondary btn-sm">
            <PrinterIcon className="h-3.5 w-3.5" />
            พิมพ์รายงาน
          </a>
          {canManage && round.status !== "submitted" && round.status !== "acknowledged" && (
            <button type="button" onClick={handleDeleteRound} className="btn-danger btn-sm">
              ลบรอบตรวจสอบ
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        คณะผู้ตรวจสอบ: {inspectors.map((i) => i.full_name_snapshot).join(", ") || "-"}
      </p>

      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {[
          { key: "count" as const, label: "ตรวจนับ" },
          { key: "diff" as const, label: `สรุปผลต่าง (${diffRows.length})` },
          { key: "report" as const, label: "รายงานสรุป" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-navy-800 text-navy-800" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "count" && (
          <div>
            <div className="card mb-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="label">หมวดหมู่</label>
                  <select value={categoryFilter} onChange={(e) => updateFilter(setCategoryFilter, e.target.value)} className="input">
                    <option value={ALL}>ทั้งหมด</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">ผลตรวจนับ</label>
                  <select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)} className="input">
                    <option value={ALL}>ทั้งหมด</option>
                    {Object.entries(INSPECT_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">ค้นหา</label>
                  <div className="flex gap-2">
                    <input value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} placeholder="ชื่อ/รหัสครุภัณฑ์/สถานที่/สแกน QR" className="input" />
                    <QrScanButton onScan={(value) => updateFilter(setSearch, value)} />
                  </div>
                </div>
              </div>
            </div>

            <p className="mb-3 text-sm text-slate-500">
              พบ <span className="font-semibold text-slate-900">{filteredRows.length.toLocaleString("th-TH")}</span> รายการ
              จากทั้งหมด {totals.total.toLocaleString("th-TH")} รายการ — ตรวจแล้ว{" "}
              {(totals.match + totals.diff + totals.notFound).toLocaleString("th-TH")} ยังไม่ตรวจ {totals.pending.toLocaleString("th-TH")}
            </p>

            <div className="table-shell">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>รหัสครุภัณฑ์</th>
                    <th>ชื่อทรัพย์สิน</th>
                    <th>สถานที่</th>
                    <th className="text-center">สภาพตามบัญชี</th>
                    <th className="text-center">ผลตรวจนับ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => {
                    const st = inspectStatus(r);
                    const stCls = st === "match" ? "badge-emerald" : st === "pending" ? "badge-slate" : st === "diff" ? "badge-amber" : "badge-red";
                    const bookCondition = conditionLookup.get(r.book_condition_id);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{r.asset_code ?? "ยังไม่ติดป้าย"}</td>
                        <td>{r.name}</td>
                        <td>{r.location}</td>
                        <td className="text-center">
                          <span className={`badge-${bookCondition?.badge_color ?? "slate"}`}>{bookCondition?.name ?? "-"}</span>
                        </td>
                        <td className="text-center">
                          <span className={stCls}>{INSPECT_STATUS[st]}</span>
                        </td>
                        <td className="whitespace-nowrap text-right">
                          <ResultModal
                            row={r}
                            roundId={roundId}
                            conditions={conditions}
                            conditionLookup={conditionLookup}
                            canEdit={canEditResults}
                            onSaved={reload}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        ไม่พบรายการที่ตรงกับตัวกรอง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {filteredRows.length > 0 && totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-sm">
                  <span className="text-slate-500">
                    หน้า {currentPage} จาก {totalPages} ({filteredRows.length.toLocaleString("th-TH")} รายการ)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "diff" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                รายการที่ตรวจไม่พบหรือสภาพต่างจากบัญชี {diffRows.length.toLocaleString("th-TH")} รายการ
              </p>
              <button type="button" onClick={handleExportDiff} className="btn-secondary btn-sm">
                <ExcelFileIcon className="h-3.5 w-3.5" />
                ส่งออก Excel
              </button>
            </div>
            <div className="table-shell">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>รหัสครุภัณฑ์</th>
                    <th>ชื่อทรัพย์สิน</th>
                    <th>สถานที่ตามทะเบียน</th>
                    <th className="text-center">สภาพตามบัญชี</th>
                    <th className="text-center">ผลตรวจนับ</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.map((r) => {
                    const st = inspectStatus(r);
                    const bookCondition = conditionLookup.get(r.book_condition_id);
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{r.asset_code ?? "ยังไม่ติดป้าย"}</td>
                        <td>{r.name}</td>
                        <td>{r.location}</td>
                        <td className="text-center">
                          <span className={`badge-${bookCondition?.badge_color ?? "slate"}`}>{bookCondition?.name ?? "-"}</span>
                        </td>
                        <td className="text-center">
                          <span className={st === "diff" ? "badge-amber" : "badge-red"}>{INSPECT_STATUS[st]}</span>
                        </td>
                        <td>{r.note ?? "-"}</td>
                      </tr>
                    );
                  })}
                  {diffRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        ยังไม่พบรายการที่มีผลต่างจากบัญชี
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "report" && (
          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">{totals.total}</p>
                <p className="text-xs text-slate-500">รายการทั้งหมด</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-2xl font-semibold text-emerald-700">{totals.match}</p>
                <p className="text-xs text-slate-500">พบตรงบัญชี</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-2xl font-semibold text-amber-700">{totals.diff}</p>
                <p className="text-xs text-slate-500">สภาพต่างจากบัญชี</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 text-center">
                <p className="text-2xl font-semibold text-red-700">{totals.notFound}</p>
                <p className="text-xs text-slate-500">ตรวจไม่พบ</p>
              </div>
            </div>

            <div>
              <label className="label">สรุปผล/ข้อเสนอแนะ (สำหรับรายงานเสนอผู้แต่งตั้ง)</label>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                readOnly={!canManage}
                rows={5}
                className="input"
              />
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleSaveNote} disabled={saving} className="btn-secondary btn-sm">
                  บันทึกข้อเสนอแนะ
                </button>
                {round.status !== "submitted" && round.status !== "acknowledged" ? (
                  <button type="button" onClick={handleSubmitReport} disabled={saving} className="btn-primary btn-sm">
                    ส่งรายงานผลการตรวจสอบ
                  </button>
                ) : (
                  <button type="button" onClick={handleReopen} className="btn-secondary btn-sm">
                    เปิดให้แก้ไขต่อ
                  </button>
                )}
              </div>
            )}
            {isDirector && round.status === "submitted" && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleAcknowledge} disabled={saving} className="btn-primary btn-sm">
                  รับทราบผลการตรวจสอบ
                </button>
              </div>
            )}
            {round.submitted_at && (
              <p className="text-xs text-slate-500">ส่งรายงานเมื่อ {formatThaiDate(round.submitted_at)}</p>
            )}
            {round.acknowledged_at && (
              <p className="text-xs text-slate-500">รับทราบผลเมื่อ {formatThaiDate(round.acknowledged_at)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
