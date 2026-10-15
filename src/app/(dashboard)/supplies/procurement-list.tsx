"use client";

// งานซื้อ / งานจ้าง — รายการบันทึกรายงานขอซื้อ/ขอจ้าง (ตาราง proc_purchase_requests ชุดเดียวกับ "รายการขอซื้อ-ขอจ้าง")
// เพิ่ม/แก้ไขผ่าน popup, พิมพ์ชุดเอกสาร ๘ แผ่นทั้งชุด หรือเลือกพิมพ์แยกทีละแผ่น (/supplies/procurement/[id]/pdf?sheets=n)
// การ์ดสำหรับพื้นที่แคบ / ตารางสำหรับพื้นที่กว้าง (@container แพทเทิร์นเดียวกับงานสัญญา)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { EMPTY_ITEM_ROW, ItemRowsEditor, itemRowsTotal, type ItemRow } from "@/components/item-rows-editor";
import { loadItemSuggestions, loadUnitSuggestions, type ItemDefaults } from "@/lib/unit-suggestions";
import { procurementSheets } from "@/lib/pdf/procurement-sheets";
import { createProcurement, deleteProcurement, updateProcurement } from "./procurement-actions";

export type ProcurementType = "ซื้อ" | "จ้าง";

type Request = {
  id: string;
  doc_no: string;
  record_date: string;
  delivery_date: string;
  order_date: string | null;
  delivered_date: string | null;
  inspected_date: string | null;
  report_date: string | null;
  admin_group: string | null;
  project_id: string | null;
  activity_id: string | null;
  item_name: string | null;
  reason: string | null;
  vendor_id: string | null;
  inspector_name: string | null;
  inspector_position: string | null;
  penalty_rate: number | null;
  order_signer: string | null;
  amount: number;
  plan_projects: { name: string } | null;
  plan_activities: { name: string } | null;
  proc_vendors: { name: string } | null;
};
type Option = { id: string; name: string };
type Activity = { id: string; name: string | null; project_id: string };
type ItemSuggestions = { names: string[]; units: string[]; defaults: Record<string, ItemDefaults> };
type Lookups = { projects: Option[]; activities: Activity[]; groups: Option[]; vendors: Option[]; teachers: string[]; positions: Record<string, string> };

// ตำแหน่งผู้ตรวจรับ — ระบบจำตำแหน่งที่เลือกไว้กับชื่อครู (proc_teacher_positions) แล้วเติมให้ครั้งต่อไป
// พิมพ์ในเอกสารเป็น "ตำแหน่ง <ค่าที่เลือก>" เช่น "ตำแหน่ง ครู วิทยฐานะครูชำนาญการ"
const POSITIONS = [
  "ครูผู้ช่วย",
  "ครู",
  "ครู วิทยฐานะครูชำนาญการ",
  "ครู วิทยฐานะครูชำนาญการพิเศษ",
  "ครู วิทยฐานะครูเชี่ยวชาญ",
  "ครู วิทยฐานะครูเชี่ยวชาญพิเศษ",
];

const TERMS: Record<ProcurementType, { party: string; item: string; reason: string; penalty: number }> = {
  ซื้อ: { party: "ผู้ขาย", item: "พัสดุที่จะซื้อ", reason: "ใช้ในการ...", penalty: 0.2 },
  จ้าง: { party: "ผู้รับจ้าง", item: "งานที่จะจ้าง", reason: "...", penalty: 0.1 },
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pdfHref(id: string, sheet?: number) {
  return `/supplies/procurement/${id}/pdf${sheet ? `?sheets=${sheet}` : ""}`;
}

function ProcurementModal({
  type,
  request,
  lookups,
  itemSuggestions,
  suggestedNo,
  onSaved,
}: {
  type: ProcurementType;
  request: Request | null;
  lookups: Lookups;
  itemSuggestions: ItemSuggestions | null;
  suggestedNo: string;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const terms = TERMS[type];
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState(request?.project_id ?? "");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM_ROW }]);
  const [itemsLoaded, setItemsLoaded] = useState(!request);
  const [recordDate, setRecordDate] = useState<string | null>(request?.record_date ?? null);
  const [deliveryDate, setDeliveryDate] = useState<string | null>(request?.delivery_date ?? null);
  const [inspectorPosition, setInspectorPosition] = useState(request?.inspector_position ?? "");
  const total = itemRowsTotal(items);
  const days = recordDate && deliveryDate && deliveryDate >= recordDate ? Math.round((Date.parse(deliveryDate) - Date.parse(recordDate)) / 86_400_000) + 1 : null;

  // โครงการเดิมที่ไม่อยู่ในปีปัจจุบัน — ให้ยังเลือกค้างไว้ได้ตอนแก้ไข
  const projectOptions =
    request?.project_id && !lookups.projects.some((p) => p.id === request.project_id)
      ? [{ id: request.project_id, name: request.plan_projects?.name ?? "(โครงการปีก่อน)" }, ...lookups.projects]
      : lookups.projects;
  const activityOptions = lookups.activities.filter((a) => a.project_id === projectId && a.name);

  function loadItems() {
    if (itemsLoaded || !request) return;
    setItemsLoaded(true);
    createClient()
      .from("proc_purchase_items")
      .select("name, qty, unit, unit_price")
      .eq("purchase_request_id", request.id)
      .order("seq")
      .then(({ data }) => {
        if (data && data.length > 0)
          setItems(
            data.map((r) => ({
              name: r.name ?? "",
              qty: r.qty != null ? String(r.qty) : "",
              unit: r.unit ?? "",
              unitPrice: r.unit_price != null ? String(r.unit_price) : "",
              note: "",
            })),
          );
      });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const filled = items.filter((r) => r.name.trim());
    if (filled.length === 0 || total <= 0) {
      await toastError("กรุณากรอกรายการอย่างน้อย 1 รายการ และยอดรวมต้องมากกว่า 0");
      return;
    }
    const formData = new FormData(form);
    formData.set("items_json", JSON.stringify(filled));
    setSaving(true);
    try {
      const res = request ? await updateProcurement(request.id, formData) : await createProcurement(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!request) {
        form.reset();
        setItems([{ ...EMPTY_ITEM_ROW }]);
        setProjectId("");
        setRecordDate(null);
        setDeliveryDate(null);
      }
      await toastSuccess(request ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกเรียบร้อยแล้ว");
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
      title={request ? `แก้ไขรายงานขอ${type} ${request.doc_no}` : `บันทึกรายงานขอ${type}ใหม่`}
      wide
      lazy
      onOpenChange={(open) => open && loadItems()}
      trigger={
        request ? (
          <span className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            แก้ไข
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกรายงานขอ{type}
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="doc_type" value={type} />
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">บันทึกข้อความ</legend>
          <div>
            <label className="label">
              เลขที่ <span className="text-red-600">*</span>
            </label>
            <input name="doc_no" key={request?.id ?? suggestedNo} defaultValue={request?.doc_no ?? suggestedNo} required className="input w-full" />
          </div>
          <div>
            <label className="label">
              วันที่บันทึกข้อความ <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="record_date" value={recordDate} onChange={(iso) => setRecordDate(iso)} />
          </div>
          <div>
            <label className="label">กลุ่มสาระ/ฝ่าย</label>
            <select name="admin_group" defaultValue={request?.admin_group ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {request?.admin_group && !lookups.groups.some((g) => g.name === request.admin_group) && (
                <option value={request.admin_group}>{request.admin_group}</option>
              )}
              {lookups.groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">โครงการ</label>
            <select name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">กิจกรรม</label>
            <select name="activity_id" key={projectId} defaultValue={request?.project_id === projectId ? (request?.activity_id ?? "") : ""} disabled={!projectId} className="input w-full">
              <option value="">{projectId ? "-- ไม่ระบุ --" : "-- เลือกโครงการก่อน --"}</option>
              {activityOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              {terms.item} (ชื่อเรื่อง) <span className="text-red-600">*</span>
            </label>
            <input name="item_name" defaultValue={request?.item_name ?? ""} required placeholder={type === "ซื้อ" ? "เช่น เสารั้ว" : "เช่น ซ่อมแซมหลังคาโรงอาหาร"} className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">เพื่อ (เหตุผลและความจำเป็น)</label>
            <input name="reason" defaultValue={request?.reason ?? ""} placeholder={terms.reason} className="input w-full" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-800">รายการ</legend>
          <ItemRowsEditor
            rows={items}
            onChange={setItems}
            idPrefix={`proc-${type}-${request?.id ?? "new"}`}
            nameSuggestions={itemSuggestions?.names}
            unitSuggestions={itemSuggestions?.units}
            itemDefaults={itemSuggestions?.defaults}
          />
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">{terms.party} / การส่งมอบ</legend>
          <div className="sm:col-span-2">
            <label className="label">{terms.party} (ร้านค้า)</label>
            <select name="vendor_id" defaultValue={request?.vendor_id ?? ""} className="input w-full">
              <option value="">-- เลือกจากรายชื่อร้านค้า/ผู้ขาย --</option>
              {lookups.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">เพิ่มร้านค้าใหม่ได้ที่เมนู ข้อมูลตั้งต้น → ร้านค้า/ผู้ขาย</p>
          </div>
          <div>
            <label className="label">
              ครบกำหนดส่งมอบ <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="delivery_date" value={deliveryDate} onChange={(iso) => setDeliveryDate(iso)} />
            {days != null && <p className="mt-1 text-xs text-slate-500">กำหนดส่งมอบภายใน {days} วัน</p>}
          </div>
          <div>
            <label className="label">ค่าปรับต่อวัน (ร้อยละ)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="penalty_rate" defaultValue={request?.penalty_rate ?? terms.penalty} className="input w-full text-right" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">ผู้ลงนามใบสั่ง{type}</label>
            <select name="order_signer" defaultValue={request?.order_signer ?? "head"} className="input w-full">
              <option value="head">หัวหน้าเจ้าหน้าที่</option>
              <option value="director">ผู้อำนวยการโรงเรียน</option>
            </select>
          </div>
          <div>
            <label className="label">ผู้ตรวจรับพัสดุ</label>
            <input
              name="inspector_name"
              list={`proc-teachers-${type}`}
              defaultValue={request?.inspector_name ?? ""}
              onChange={(e) => {
                const pos = lookups.positions[e.target.value.trim()];
                if (pos) setInspectorPosition(pos);
              }}
              className="input w-full"
            />
            <datalist id={`proc-teachers-${type}`}>
              {lookups.teachers.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label">ตำแหน่งผู้ตรวจรับ</label>
            <select name="inspector_position" value={inspectorPosition} onChange={(e) => setInspectorPosition(e.target.value)} className="input w-full">
              <option value="">-- เลือกตำแหน่ง --</option>
              {inspectorPosition && !POSITIONS.includes(inspectorPosition) && <option value={inspectorPosition}>{inspectorPosition}</option>}
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-semibold text-navy-800">วันที่แต่ละขั้นตอน</legend>
          <p className="text-xs text-slate-500 sm:col-span-2">ไม่บังคับ — กรอกเมื่อถึงขั้นนั้น ถ้าเว้นว่าง เอกสารจะใช้วันที่บันทึกข้อความ · ส่งมอบช้ากว่าวันครบกำหนด ระบบคำนวณค่าปรับในใบตรวจรับให้อัตโนมัติ</p>
          <div>
            <label className="label">วันสั่ง{type} (ลงนามใบสั่ง{type})</label>
            <ThaiDatePicker name="order_date" defaultValue={request?.order_date ?? null} />
          </div>
          <div>
            <label className="label">วันส่งมอบ{type === "จ้าง" ? "งาน" : "พัสดุ"}</label>
            <ThaiDatePicker name="delivered_date" defaultValue={request?.delivered_date ?? null} />
          </div>
          <div>
            <label className="label">วันตรวจรับ</label>
            <ThaiDatePicker name="inspected_date" defaultValue={request?.inspected_date ?? null} />
          </div>
          <div>
            <label className="label">วันรายงานผลการตรวจรับ / ขอเบิกจ่าย</label>
            <ThaiDatePicker name="report_date" defaultValue={request?.report_date ?? null} />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">
            วงเงินที่ขอ{type} <span className="text-base font-semibold text-slate-900">{formatBaht(total)}</span> บาท
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

const PAGE_SIZE = 20;

/** รายละเอียดรายการ — โหลดตารางรายการเมื่อเปิด */
function DetailModal({ type, request: r }: { type: ProcurementType; request: Request }) {
  const [items, setItems] = useState<{ name: string | null; qty: number | null; unit: string | null; unit_price: number | null; total: number | null }[] | null>(null);
  function load() {
    if (items) return;
    createClient()
      .from("proc_purchase_items")
      .select("name, qty, unit, unit_price, total")
      .eq("purchase_request_id", r.id)
      .order("seq")
      .then(({ data }) => setItems(data ?? []));
  }
  const rows: [string, string][] = [
    ["เลขที่", r.doc_no],
    ["วันที่บันทึกข้อความ", formatThaiDate(r.record_date)],
    [TERMS[type].item, r.item_name ?? "-"],
    ["เพื่อ", r.reason ?? "-"],
    ["กลุ่มสาระ/ฝ่าย", r.admin_group ?? "-"],
    ["โครงการ", r.plan_projects?.name ?? "-"],
    ["กิจกรรม", r.plan_activities?.name ?? "-"],
    [TERMS[type].party, r.proc_vendors?.name ?? "-"],
    [`วันสั่ง${type}`, r.order_date ? formatThaiDate(r.order_date) : "-"],
    ["ครบกำหนดส่งมอบ", formatThaiDate(r.delivery_date)],
    ["วันส่งมอบ", r.delivered_date ? formatThaiDate(r.delivered_date) : "-"],
    ["วันตรวจรับ", r.inspected_date ? formatThaiDate(r.inspected_date) : "-"],
    ["วันรายงานผล", r.report_date ? formatThaiDate(r.report_date) : "-"],
    ["ค่าปรับต่อวัน", r.penalty_rate != null ? `ร้อยละ ${r.penalty_rate}` : "-"],
    ["ผู้ตรวจรับพัสดุ", [r.inspector_name, r.inspector_position].filter(Boolean).join(" · ") || "-"],
    [`ผู้ลงนามใบสั่ง${type}`, r.order_signer === "director" ? "ผู้อำนวยการโรงเรียน" : "หัวหน้าเจ้าหน้าที่"],
    [`วงเงินที่ขอ${type}`, `${formatBaht(Number(r.amount))} บาท`],
  ];
  return (
    <Modal
      title={`รายงานขอ${type} ${r.doc_no}`}
      wide
      lazy
      onOpenChange={(open) => open && load()}
      trigger={
        <span className="btn-secondary btn-sm">
          <SearchIcon className="h-3.5 w-3.5" />
          รายละเอียด
        </span>
      }
    >
      <dl className="divide-y divide-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-3 sm:gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-slate-900 sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-semibold text-navy-800">รายการ</h3>
      {items === null ? (
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">ไม่มีรายการ</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2">ที่</th>
                <th className="px-2 py-2 text-left">รายการ</th>
                <th className="px-2 py-2 text-right">จำนวน</th>
                <th className="px-2 py-2 text-right">ราคา/หน่วย</th>
                <th className="px-2 py-2 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-center text-slate-400">{i + 1}</td>
                  <td className="px-2 py-1">{it.name}</td>
                  <td className="px-2 py-1 text-right">
                    {it.qty ?? "-"} {it.unit ?? ""}
                  </td>
                  <td className="px-2 py-1 text-right">{it.unit_price != null ? formatBaht(Number(it.unit_price)) : "-"}</td>
                  <td className="px-2 py-1 text-right">{it.total != null ? formatBaht(Number(it.total)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/** เลือกพิมพ์แยกทีละแผ่น */
function SheetsModal({ type, request }: { type: ProcurementType; request: Request }) {
  return (
    <Modal
      title={`พิมพ์แยกแผ่น — ${request.doc_no}`}
      lazy
      trigger={
        <span className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          แยกแผ่น
        </span>
      }
    >
      <div className="grid gap-2">
        {procurementSheets(type).map((s) => (
          <a key={s.no} href={pdfHref(request.id, s.no)} target="_blank" rel="noopener" className="btn-secondary justify-start">
            <PrinterIcon className="h-4 w-4" />
            แผ่นที่ {s.no} · {s.label}
          </a>
        ))}
        <a href={pdfHref(request.id)} target="_blank" rel="noopener" className="btn-primary justify-center">
          <PrinterIcon className="h-4 w-4" />
          พิมพ์ทั้งชุด ({procurementSheets(type).length} แผ่น)
        </a>
      </div>
    </Modal>
  );
}

export function ProcurementList({ type, title, subtitle }: { type: ProcurementType; title: string; subtitle: string }) {
  const { isAdmin, isProcStaff } = useAuth();
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lookups, setLookups] = useState<Lookups>({ projects: [], activities: [], groups: [], vendors: [], teachers: [], positions: {} });
  const [itemSuggestions, setItemSuggestions] = useState<ItemSuggestions | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [allDocNos, setAllDocNos] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    setFiscalYear(currentYear?.year ?? null);
    // แสดงเฉพาะรายการของปีงบประมาณปัจจุบันที่ตั้งไว้ (1 ต.ค. – 30 ก.ย.)
    let listQuery = supabase
      .from("proc_purchase_requests")
      .select(
        "id, doc_no, record_date, delivery_date, order_date, delivered_date, inspected_date, report_date, admin_group, project_id, activity_id, item_name, reason, vendor_id, inspector_name, inspector_position, penalty_rate, order_signer, amount, plan_projects(name), plan_activities(name), proc_vendors(name)",
      )
      .eq("doc_type", type);
    if (currentYear) {
      const ce = currentYear.year - 543;
      listQuery = listQuery.gte("record_date", `${ce - 1}-10-01`).lte("record_date", `${ce}-09-30`);
    }
    const [{ data, error }, { data: nos }, { data: projects }, { data: activities }, { data: groups }, { data: vendors }, { data: teachers }, { data: positions }] = await Promise.all([
      listQuery.order("record_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("proc_purchase_requests").select("doc_no"),
      currentYear
        ? supabase.from("plan_projects").select("id, name").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] as Option[] }),
      supabase.from("plan_activities").select("id, name, project_id").order("sort_order"),
      supabase.from("plan_admin_groups").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_vendors").select("id, name").order("name"),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_teacher_positions").select("teacher_name, position"),
    ]);
    setError(error?.message ?? null);
    setRequests((data as unknown as Request[]) ?? []);
    setAllDocNos((nos ?? []).map((r) => r.doc_no));
    setLookups({
      projects: projects ?? [],
      activities: (activities as Activity[]) ?? [],
      groups: groups ?? [],
      vendors: vendors ?? [],
      teachers: (teachers ?? []).map((t) => t.name),
      positions: Object.fromEntries((positions ?? []).map((p) => [p.teacher_name, p.position])),
    });
  }, [type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const supabase = createClient();
    Promise.all([loadItemSuggestions(supabase), loadUnitSuggestions(supabase)]).then(([items, units]) =>
      setItemSuggestions({ names: items.names, units, defaults: items.defaults }),
    );
  }, [reload]);

  // เลขที่ถัดไป <ลำดับที่>/<ปีงบประมาณ> — ลำดับเดียวกันทั้งงานซื้อและงานจ้าง (แก้เองได้)
  const nextDocNo = useMemo(() => {
    if (!fiscalYear) return "";
    const suffix = `/${fiscalYear}`;
    const max = allDocNos.reduce((m, raw) => {
      const no = raw.trim();
      if (!no.endsWith(suffix)) return m;
      const n = Number(no.slice(0, -suffix.length));
      return Number.isInteger(n) && n > m ? n : m;
    }, 0);
    return `${max + 1}${suffix}`;
  }, [allDocNos, fiscalYear]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!requests || !q) return requests ?? [];
    return requests.filter((r) => [r.doc_no, r.item_name, r.proc_vendors?.name, r.plan_projects?.name].some((v) => v?.toLowerCase().includes(q)));
  }, [requests, query]);
  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  // แสดงทีละ PAGE_SIZE รายการ กด "โหลดเพิ่ม" เพื่อดูต่อ (เปลี่ยนคำค้นแล้วเริ่มนับใหม่)
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = filtered.slice(0, shown);

  async function handleDelete(r: Request) {
    const ok = await confirmDelete({ title: `ลบรายงานขอ${type} ${r.doc_no}?`, text: r.item_name ?? "" });
    if (!ok) return;
    const res = await deleteProcurement(r.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  function actions(r: Request) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a href={pdfHref(r.id)} target="_blank" rel="noopener" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์ทั้งชุด
        </a>
        <DetailModal type={type} request={r} />
        <SheetsModal type={type} request={r} />
        {isProcStaff && (
          <ProcurementModal type={type} request={r} lookups={lookups} itemSuggestions={itemSuggestions} suggestedNo="" onSaved={reload} />
        )}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(r)} className="btn-danger btn-sm">
            <TrashIcon className="h-3.5 w-3.5" />
            ลบ
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">
            {subtitle}
            {fiscalYear ? ` · ปีงบประมาณ ${fiscalYear}` : ""}
          </p>
        </div>
        {isProcStaff && (
          <ProcurementModal type={type} request={null} lookups={lookups} itemSuggestions={itemSuggestions} suggestedNo={nextDocNo} onSaved={reload} />
        )}
      </div>

      {requests === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(PAGE_SIZE);
                }}
                placeholder={`ค้นหาเลขที่ รายการ ${TERMS[type].party} โครงการ`} className="input w-full pl-9" />
            </div>
            <p className="text-sm text-slate-500">
              {filtered.length} รายการ · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

            {/* พื้นที่แคบ: การ์ด */}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {visible.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{r.doc_no}</span>
                    <span className="text-sm text-slate-700">{r.item_name}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">{r.proc_vendors?.name ?? `ยังไม่ระบุ${TERMS[type].party}`}</p>
                  <p className="text-xs text-slate-500">{r.plan_projects?.name ?? "ไม่ระบุโครงการ"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    บันทึก {formatThaiDate(r.record_date)} · ส่งมอบ {formatThaiDate(r.delivery_date)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatBaht(Number(r.amount))} บาท</p>
                  <div className="mt-2">{actions(r)}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}</p>}
            </div>

            {/* พื้นที่กว้าง: ตาราง */}
            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>วันที่บันทึก</th>
                  <th>รายการ</th>
                  <th>{TERMS[type].party}</th>
                  <th>ครบกำหนดส่งมอบ</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-900">{r.doc_no}</td>
                    <td>{formatThaiDate(r.record_date)}</td>
                    <td>
                      <div>{r.item_name}</div>
                      <div className="text-sm text-slate-500">{r.plan_projects?.name ?? ""}</div>
                    </td>
                    <td>{r.proc_vendors?.name ?? "-"}</td>
                    <td>{formatThaiDate(r.delivery_date)}</td>
                    <td className="text-right font-semibold text-slate-900">{formatBaht(Number(r.amount))}</td>
                    <td className="text-right">{actions(r)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > shown && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="btn-secondary">
                  โหลดเพิ่ม (แสดง {shown} จาก {filtered.length} รายการ)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
