"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess, confirmDelete } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { PencilIcon, PlusIcon, PrinterIcon } from "@/components/icons";
import { deleteAssetItem, updateAssetItemStatus, upsertAssetItem } from "./actions";

type Option = { id: string; name: string };

type AssetItem = {
  id: string;
  round_id: string;
  building: string;
  floor: string | null;
  room: string;
  category_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  asset_code: string | null;
  condition: string;
  note: string | null;
  acquired_year: number | null;
  budget_source_id: string | null;
  price: number | null;
  photo_path: string | null;
  status: string;
  reject_reason: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  acquisition_method: string | null;
  model: string | null;
  spec: string | null;
};

const ALL = "__all__";

function formatBaht(n: number | null) {
  if (n == null) return "-";
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

function statusBadge(status: string) {
  if (status === "approved") return { cls: "badge-emerald", label: "อนุมัติแล้ว" };
  if (status === "rejected") return { cls: "badge-red", label: "ไม่อนุมัติ" };
  if (status === "submitted") return { cls: "badge-amber", label: "รอตรวจสอบ" };
  return { cls: "badge-slate", label: "แบบร่าง" };
}

function conditionBadge(condition: string) {
  if (condition === "usable") return { cls: "badge-emerald", label: "ใช้งานได้" };
  if (condition === "damaged") return { cls: "badge-amber", label: "ชำรุด" };
  return { cls: "badge-red", label: "จำหน่าย" };
}

function ItemModal({
  item,
  canManage,
  categories,
  buildings,
  units,
  budgetSources,
  rounds,
  defaultRoundId,
  onSaved,
}: {
  item: AssetItem | null;
  canManage: boolean;
  categories: Option[];
  buildings: Option[];
  units: Option[];
  budgetSources: Option[];
  rounds: { id: string; year: number; name: string }[];
  defaultRoundId: string;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleOpen() {
    setPhotoUrl(null);
    setRejecting(false);
    setRejectReason("");
    if (item?.photo_path) {
      const supabase = createClient();
      const { data } = await supabase.storage.from("asset-photos").createSignedUrl(item.photo_path, 3600);
      if (data?.signedUrl) setPhotoUrl(data.signedUrl);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await upsertAssetItem(item?.id ?? null, new FormData(e.currentTarget));
      await toastSuccess(item ? "บันทึกการแก้ไขแล้ว" : "เพิ่มรายการทรัพย์สินแล้ว");
      onSaved();
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!item) return;
    try {
      await updateAssetItemStatus(item.id, "approved");
      await toastSuccess("อนุมัติรายการแล้ว");
      onSaved();
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleReject() {
    if (!item) return;
    if (!rejectReason.trim()) return;
    try {
      await updateAssetItemStatus(item.id, "rejected", rejectReason);
      await toastSuccess("บันทึกไม่อนุมัติแล้ว");
      onSaved();
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete() {
    if (!item) return;
    const ok = await confirmDelete({ title: `ลบรายการ "${item.name}"?` });
    if (!ok) return;
    try {
      await deleteAssetItem(item.id);
      await toastSuccess("ลบรายการแล้ว");
      onSaved();
      modalRef.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <Modal
      ref={modalRef}
      title={item ? "รายละเอียดทรัพย์สิน" : "เพิ่มรายการทรัพย์สินใหม่"}
      wide
      trigger={
        item ? (
          <span
            onClick={handleOpen}
            className="inline-flex items-center gap-1 text-sm font-medium text-navy-800 hover:underline"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            {canManage ? "แก้ไข" : "ดูรายละเอียด"}
          </span>
        ) : (
          <span onClick={handleOpen} className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            เพิ่มรายการใหม่
          </span>
        )
      }
    >
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก signed URL ชั่วคราว ไม่เหมาะกับ next/image ที่ต้อง whitelist โดเมน
        <img src={photoUrl} alt={item?.name ?? ""} className="mb-4 max-h-64 w-full rounded-lg object-contain" />
      )}

      {item && !canManage ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-400">รหัสครุภัณฑ์</dt>
            <dd>{item.asset_code ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">ชื่อทรัพย์สิน</dt>
            <dd>{item.name}</dd>
          </div>
          <div>
            <dt className="text-slate-400">สถานที่</dt>
            <dd>
              {item.building} {item.floor ? `ชั้น ${item.floor}` : ""} ห้อง {item.room}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">จำนวน</dt>
            <dd>
              {item.quantity} {item.unit ?? ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">ราคา</dt>
            <dd>{formatBaht(item.price)} บาท</dd>
          </div>
          <div>
            <dt className="text-slate-400">ปีที่ได้มา</dt>
            <dd>{item.acquired_year ?? "-"}</dd>
          </div>
          {item.note && (
            <div className="col-span-2">
              <dt className="text-slate-400">หมายเหตุ</dt>
              <dd className="whitespace-pre-line">{item.note}</dd>
            </div>
          )}
          {item.reject_reason && (
            <div className="col-span-2">
              <dt className="text-slate-400">เหตุผลที่ไม่อนุมัติ</dt>
              <dd className="whitespace-pre-line text-red-600">{item.reject_reason}</dd>
            </div>
          )}
        </dl>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">รอบสำรวจ</label>
              <select name="round_id" defaultValue={item?.round_id ?? defaultRoundId} required className="input">
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.year} — {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">รหัสครุภัณฑ์</label>
              <input name="asset_code" defaultValue={item?.asset_code ?? ""} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อทรัพย์สิน</label>
              <input name="name" defaultValue={item?.name ?? ""} required className="input" />
            </div>
            <div>
              <label className="label">หมวดหมู่</label>
              <select name="category_id" defaultValue={item?.category_id ?? ""} className="input">
                <option value="">ไม่ระบุ</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">สภาพ</label>
              <select name="condition" defaultValue={item?.condition ?? "usable"} className="input">
                <option value="usable">ใช้งานได้</option>
                <option value="damaged">ชำรุด</option>
                <option value="disposal">จำหน่าย</option>
              </select>
            </div>
            <div>
              <label className="label">อาคาร</label>
              <input
                name="building"
                defaultValue={item?.building ?? ""}
                required
                list={`asset-buildings-${item?.id ?? "new"}`}
                className="input"
              />
              <datalist id={`asset-buildings-${item?.id ?? "new"}`}>
                {buildings.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">ชั้น</label>
              <input name="floor" defaultValue={item?.floor ?? ""} className="input" />
            </div>
            <div>
              <label className="label">ห้อง</label>
              <input name="room" defaultValue={item?.room ?? ""} required className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">จำนวน</label>
                <input name="quantity" type="number" min={1} defaultValue={item?.quantity ?? 1} required className="input" />
              </div>
              <div>
                <label className="label">หน่วยนับ</label>
                <input
                  name="unit"
                  defaultValue={item?.unit ?? ""}
                  list={`asset-units-${item?.id ?? "new"}`}
                  className="input"
                />
                <datalist id={`asset-units-${item?.id ?? "new"}`}>
                  {units.map((u) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className="label">ราคา (บาท)</label>
              <input name="price" type="number" step="0.01" defaultValue={item?.price ?? ""} className="input" />
            </div>
            <div>
              <label className="label">ปีที่ได้มา</label>
              <input name="acquired_year" type="number" defaultValue={item?.acquired_year ?? ""} className="input" />
            </div>
            <div>
              <label className="label">แหล่งงบประมาณ</label>
              <select name="budget_source_id" defaultValue={item?.budget_source_id ?? ""} className="input">
                <option value="">ไม่ระบุ</option>
                {budgetSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">วิธีการได้มา</label>
              <input name="acquisition_method" defaultValue={item?.acquisition_method ?? ""} className="input" />
            </div>
            <div>
              <label className="label">ยี่ห้อ/รุ่น</label>
              <input name="model" defaultValue={item?.model ?? ""} className="input" />
            </div>
            <div>
              <label className="label">คุณลักษณะ</label>
              <input name="spec" defaultValue={item?.spec ?? ""} className="input" />
            </div>
            <div>
              <label className="label">ชื่อผู้ขาย/ผู้รับจ้าง</label>
              <input name="vendor_name" defaultValue={item?.vendor_name ?? ""} className="input" />
            </div>
            <div>
              <label className="label">เบอร์โทรผู้ขาย</label>
              <input name="vendor_phone" defaultValue={item?.vendor_phone ?? ""} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ที่อยู่ผู้ขาย</label>
              <input name="vendor_address" defaultValue={item?.vendor_address ?? ""} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">หมายเหตุ</label>
              <textarea name="note" defaultValue={item?.note ?? ""} rows={2} className="input" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              {item && (
                <button type="button" onClick={handleDelete} className="btn-danger btn-sm">
                  ลบรายการ
                </button>
              )}
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      )}

      {item && canManage && item.status === "submitted" && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-navy-900">พิจารณารายการนี้</p>
          {!rejecting ? (
            <div className="flex gap-2">
              <button type="button" onClick={handleApprove} className="btn-primary btn-sm">
                อนุมัติ
              </button>
              <button type="button" onClick={() => setRejecting(true)} className="btn-danger btn-sm">
                ไม่อนุมัติ
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
                rows={2}
                className="input"
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleReject} disabled={!rejectReason.trim()} className="btn-danger btn-sm">
                  ยืนยันไม่อนุมัติ
                </button>
                <button type="button" onClick={() => setRejecting(false)} className="btn-secondary btn-sm">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function RegisterTab({
  canManage,
  rounds,
  categories,
  buildings,
  units,
  budgetSources,
  onChanged,
}: {
  canManage: boolean;
  rounds: { id: string; year: number; name: string; is_open: boolean }[];
  categories: Option[];
  buildings: Option[];
  units: Option[];
  budgetSources: Option[];
  onChanged: () => void;
}) {
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [roundFilter, setRoundFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [conditionFilter, setConditionFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("asset_items")
      .select(
        "id, round_id, building, floor, room, category_id, name, quantity, unit, asset_code, condition, note, acquired_year, budget_source_id, price, photo_path, status, reject_reason, vendor_name, vendor_address, vendor_phone, acquisition_method, model, spec",
      )
      .order("created_at", { ascending: false });
    setItems((data as unknown as AssetItem[]) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  function handleChanged() {
    reload();
    onChanged();
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const defaultRoundId = rounds.find((r) => r.is_open)?.id ?? rounds[0]?.id ?? "";

  const filtered = (items ?? []).filter((it) => {
    if (roundFilter !== ALL && it.round_id !== roundFilter) return false;
    if (categoryFilter !== ALL && it.category_id !== categoryFilter) return false;
    if (statusFilter !== ALL && it.status !== statusFilter) return false;
    if (conditionFilter !== ALL && it.condition !== conditionFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${it.name} ${it.asset_code ?? ""} ${it.building} ${it.room}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  if (items === null) return <p className="table-empty">กำลังโหลดข้อมูล...</p>;

  return (
    <div>
      <div className="card mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div>
            <label className="label">รอบสำรวจ</label>
            <select value={roundFilter} onChange={(e) => updateFilter(setRoundFilter, e.target.value)} className="input">
              <option value={ALL}>ทั้งหมด</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.year} — {r.name}
                </option>
              ))}
            </select>
          </div>
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
            <label className="label">สถานะ</label>
            <select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)} className="input">
              <option value={ALL}>ทั้งหมด</option>
              <option value="draft">แบบร่าง</option>
              <option value="submitted">รอตรวจสอบ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ไม่อนุมัติ</option>
            </select>
          </div>
          <div>
            <label className="label">สภาพ</label>
            <select value={conditionFilter} onChange={(e) => updateFilter(setConditionFilter, e.target.value)} className="input">
              <option value={ALL}>ทั้งหมด</option>
              <option value="usable">ใช้งานได้</option>
              <option value="damaged">ชำรุด</option>
              <option value="disposal">จำหน่าย</option>
            </select>
          </div>
          <div>
            <label className="label">ค้นหา</label>
            <input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="ชื่อ/รหัสครุภัณฑ์/สถานที่"
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          พบ <span className="font-semibold text-slate-900">{filtered.length.toLocaleString("th-TH")}</span> รายการ
          จากทั้งหมด {(items ?? []).length.toLocaleString("th-TH")} รายการ
        </p>
        {canManage && (
          <ItemModal
            item={null}
            canManage={canManage}
            categories={categories}
            buildings={buildings}
            units={units}
            budgetSources={budgetSources}
            rounds={rounds}
            defaultRoundId={defaultRoundId}
            onSaved={handleChanged}
          />
        )}
      </div>

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr>
              <th className="whitespace-nowrap">รหัสครุภัณฑ์</th>
              <th>ชื่อทรัพย์สิน</th>
              <th>หมวดหมู่</th>
              <th className="whitespace-nowrap">สถานที่</th>
              <th className="text-center">จำนวน</th>
              <th className="whitespace-nowrap text-right">ราคา (บาท)</th>
              <th className="text-center">สภาพ</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((it) => {
              const sb = statusBadge(it.status);
              const cb = conditionBadge(it.condition);
              return (
                <tr key={it.id}>
                  <td className="whitespace-nowrap">{it.asset_code ?? "-"}</td>
                  <td className="max-w-xs whitespace-normal break-words font-medium text-slate-900">{it.name}</td>
                  <td>{it.category_id ? (categoryName.get(it.category_id) ?? "-") : "-"}</td>
                  <td className="whitespace-nowrap">
                    {it.building} {it.floor ? `ชั้น ${it.floor}` : ""} {it.room}
                  </td>
                  <td className="text-center tabular-nums">
                    {it.quantity} {it.unit ?? ""}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatBaht(it.price)}</td>
                  <td className="text-center">
                    <span className={cb.cls}>{cb.label}</span>
                  </td>
                  <td className="text-center">
                    <span className={sb.cls}>{sb.label}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <a href={`/asset-register/${it.id}/pdf`} target="_blank" className="btn-secondary btn-sm">
                        <PrinterIcon className="h-3.5 w-3.5" />
                        พิมพ์
                      </a>
                      <ItemModal
                        item={it}
                        canManage={canManage}
                        categories={categories}
                        buildings={buildings}
                        units={units}
                        budgetSources={budgetSources}
                        rounds={rounds}
                        defaultRoundId={defaultRoundId}
                        onSaved={handleChanged}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="table-empty">
                  ไม่พบรายการที่ตรงกับตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filtered.length > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-sm">
            <span className="text-slate-500">
              หน้า {currentPage} จาก {totalPages} ({filtered.length.toLocaleString("th-TH")} รายการ)
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
  );
}
