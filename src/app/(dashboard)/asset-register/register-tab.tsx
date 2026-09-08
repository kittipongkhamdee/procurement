"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, toastError, toastSuccess, confirmDelete } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ToggleSwitch } from "@/components/toggle-switch";
import { PencilIcon, PlusIcon, PrinterIcon, TagIcon } from "@/components/icons";
import { compressPhotoFile } from "@/lib/image-resize";
import { QrScanButton } from "./qr-scan-button";
import {
  createAssetRepair,
  deleteAssetItem,
  deleteAssetRepair,
  generateAssetCode,
  updateAssetItemStatus,
  upsertAssetItem,
} from "./actions";

async function uploadAssetPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const res = await fetch("/api/asset-photo-upload", { method: "POST", body: formData });
  let body: { path?: string; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    // เซิร์ฟเวอร์อาจตอบกลับไม่ใช่ JSON (เช่น 413) — ใช้ข้อความสำรองด้านล่างแทน
  }
  if (!res.ok || !body.path) {
    throw new Error(body.error || "อัปโหลดรูปภาพไม่สำเร็จ");
  }
  return body.path;
}

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
  sequence_no: string | null;
  doc_ref: string | null;
  condition: string;
  acquired_date: string | null;
  acquired_year: number | null;
  budget_source_id: string | null;
  price: number | null;
  photo_path: string | null;
  status: string;
  reject_reason: string | null;
  vendor_name: string | null;
  vendor_address: string | null;
  vendor_phone: string | null;
  acquisition_method_id: string | null;
  item_type_id: string | null;
  model: string | null;
  spec: string | null;
};

type ItemType = Option & { category_id: string };

type Repair = {
  id: string;
  repaired_date: string;
  description: string;
  amount: number | null;
  note: string | null;
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
  acquisitionMethods,
  itemTypes,
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
  acquisitionMethods: Option[];
  itemTypes: ItemType[];
  rounds: { id: string; year: number; name: string }[];
  defaultRoundId: string;
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const assetCodeInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // การแก้ไขรูปยังไม่อัปโหลด/ลบจริงจนกว่าจะกดบันทึกฟอร์ม — เก็บไว้เป็น state ระหว่างนั้นก่อน
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // ต้องเป็น state (ไม่ใช่ uncontrolled) เพื่อกรองตัวเลือก "ชนิดครุภัณฑ์" ตามหมวดหมู่ที่เลือกอยู่แบบ real-time
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [generatingCode, setGeneratingCode] = useState(false);
  // ประวัติการซ่อมบำรุงรักษาทรัพย์สิน — พิมพ์เป็นตารางหน้า 2 ของทะเบียนคุมทรัพย์สิน มีเฉพาะรายการที่
  // บันทึกไว้แล้ว (id มีค่า) เท่านั้น เพราะผูกกับ item_id
  const repairFormRef = useRef<HTMLFormElement>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [savingRepair, setSavingRepair] = useState(false);

  async function loadRepairs() {
    if (!item) {
      setRepairs([]);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("asset_repairs")
      .select("id, repaired_date, description, amount, note")
      .eq("item_id", item.id)
      .order("repaired_date", { ascending: true });
    setRepairs(data ?? []);
  }

  async function handleOpen() {
    setPhotoUrl(null);
    setPendingPhotoFile(null);
    setPendingPreviewUrl(null);
    setPhotoRemoved(false);
    setRejecting(false);
    setRejectReason("");
    setCategoryId(item?.category_id ?? "");
    await loadRepairs();
    if (item?.photo_path) {
      const supabase = createClient();
      const { data } = await supabase.storage.from("asset-photos").createSignedUrl(item.photo_path, 3600);
      if (data?.signedUrl) setPhotoUrl(data.signedUrl);
    }
  }

  async function handleAddRepair(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!item) return;
    setSavingRepair(true);
    try {
      await createAssetRepair(item.id, new FormData(e.currentTarget));
      repairFormRef.current?.reset();
      await loadRepairs();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSavingRepair(false);
    }
  }

  async function handleDeleteRepair(id: string) {
    const confirmed = await confirmDelete({ title: "ลบประวัติการซ่อมนี้?" });
    if (!confirmed) return;
    try {
      await deleteAssetRepair(id);
      await loadRepairs();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleGenerateCode() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const cid = String(fd.get("category_id") ?? "");
    const tid = String(fd.get("item_type_id") ?? "");
    const acquiredDate = String(fd.get("acquired_date") ?? "") || null;
    if (!cid || !tid) {
      await toastError("กรุณาเลือกหมวดหมู่และชนิดครุภัณฑ์ก่อนสร้างเลขอัตโนมัติ");
      return;
    }
    setGeneratingCode(true);
    try {
      const code = await generateAssetCode(cid, tid, acquiredDate);
      if (assetCodeInputRef.current) assetCodeInputRef.current.value = code;
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setGeneratingCode(false);
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPhotoFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setPhotoRemoved(false);
  }

  function handleRemovePhoto() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPhotoFile(null);
    setPendingPreviewUrl(null);
    setPhotoRemoved(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      if (pendingPhotoFile) {
        const compressed = await compressPhotoFile(pendingPhotoFile);
        const path = await uploadAssetPhoto(compressed);
        formData.set("photo_path", path);
      } else if (photoRemoved) {
        formData.set("photo_path", "");
      }
      await upsertAssetItem(item?.id ?? null, formData);
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
      {canManage ? (
        <div className="mb-4">
          <label className="label">รูปภาพ</label>
          <div className="flex flex-wrap items-start gap-3">
            {pendingPreviewUrl || (!photoRemoved && photoUrl) ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก signed URL ชั่วคราว/พรีวิวไฟล์ในเครื่อง ไม่เหมาะกับ next/image ที่ต้อง whitelist โดเมน */}
                <img
                  src={pendingPreviewUrl ?? photoUrl ?? ""}
                  alt={item?.name ?? ""}
                  className="max-h-48 w-48 rounded-lg border border-slate-200 object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 hover:bg-white"
                >
                  ลบรูป
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">ไม่มีรูปภาพ</p>
            )}
            <button type="button" onClick={() => photoInputRef.current?.click()} className="btn-secondary btn-sm self-start">
              {pendingPreviewUrl || (!photoRemoved && photoUrl) ? "เปลี่ยนรูป" : "เพิ่มรูป"}
            </button>
            <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn-secondary btn-sm self-start">
              ถ่ายรูป
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            {/* capture="environment" เปิดกล้องหลังของมือถือ/แท็บเล็ตโดยตรงแทนที่จะเปิดคลังรูปให้เลือก
                (เบราว์เซอร์เดสก์ท็อปจะเมิน attribute นี้แล้ว fallback ไปเปิด dialog เลือกไฟล์ตามปกติ) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>
        </div>
      ) : (
        photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- รูปจาก signed URL ชั่วคราว ไม่เหมาะกับ next/image ที่ต้อง whitelist โดเมน
          <img src={photoUrl} alt={item?.name ?? ""} className="mb-4 max-h-64 w-full rounded-lg object-contain" />
        )
      )}

      {item && !canManage ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-slate-400">รหัสครุภัณฑ์</dt>
            <dd>{item.asset_code ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">ที่เอกสาร</dt>
            <dd>{item.doc_ref ?? "-"}</dd>
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
            <dt className="text-slate-400">วัน/เดือน/ปีที่ได้มา</dt>
            <dd>{item.acquired_date ? formatThaiDate(item.acquired_date) : "-"}</dd>
          </div>
          {item.reject_reason && (
            <div className="col-span-2">
              <dt className="text-slate-400">เหตุผลที่ไม่อนุมัติ</dt>
              <dd className="whitespace-pre-line text-red-600">{item.reject_reason}</dd>
            </div>
          )}
        </dl>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
            <div className="sm:col-span-2">
              <label className="label">รหัสครุภัณฑ์</label>
              <div className="flex gap-2">
                <input ref={assetCodeInputRef} name="asset_code" defaultValue={item?.asset_code ?? ""} className="input" />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="btn-secondary btn-sm shrink-0 disabled:opacity-50"
                >
                  {generatingCode ? "กำลังสร้าง..." : "สร้างเลขอัตโนมัติ"}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">ที่เอกสาร</label>
              <input name="doc_ref" defaultValue={item?.doc_ref ?? ""} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">ชื่อทรัพย์สิน</label>
              <input name="name" defaultValue={item?.name ?? ""} required className="input" />
            </div>
            <div>
              <label className="label">หมวดหมู่</label>
              <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
                <option value="">ไม่ระบุ</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ชนิดครุภัณฑ์</label>
              <select name="item_type_id" defaultValue={item?.item_type_id ?? ""} className="input">
                <option value="">ไม่ระบุ</option>
                {itemTypes
                  .filter((t) => t.category_id === categoryId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
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
              <label className="label">วัน/เดือน/ปีที่ได้มา</label>
              <ThaiDatePicker name="acquired_date" defaultValue={item?.acquired_date ?? null} />
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
              <select name="acquisition_method_id" defaultValue={item?.acquisition_method_id ?? ""} className="input">
                <option value="">ไม่ระบุ</option>
                {acquisitionMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
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

      {/* ประวัติการซ่อมบำรุงรักษาทรัพย์สิน — พิมพ์เป็นตารางหน้า 2 ของทะเบียนคุมทรัพย์สิน (ตามแบบฟอร์ม
          มาตรฐาน สพฐ.) มีให้เฉพาะรายการที่บันทึกไว้ในระบบแล้วเท่านั้น (ผูกกับ item_id) */}
      {item && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-navy-900">ประวัติการซ่อมบำรุงรักษาทรัพย์สิน</p>
          {repairs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead>
                  <tr>
                    <th>ครั้งที่</th>
                    <th>วัน/เดือน/ปี</th>
                    <th>รายการ</th>
                    <th className="text-right">จำนวนเงิน</th>
                    <th>หมายเหตุ</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{formatThaiDate(r.repaired_date)}</td>
                      <td>{r.description}</td>
                      <td className="text-right">{r.amount != null ? formatBaht(r.amount) : "-"}</td>
                      <td>{r.note ?? "-"}</td>
                      {canManage && (
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDeleteRepair(r.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            ลบ
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">ยังไม่มีประวัติการซ่อม</p>
          )}
          {canManage && (
            <form ref={repairFormRef} onSubmit={handleAddRepair} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div>
                <label className="label">วัน/เดือน/ปีที่ซ่อม</label>
                <ThaiDatePicker name="repaired_date" defaultValue={null} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">รายการซ่อม</label>
                <input name="description" required className="input" />
              </div>
              <div>
                <label className="label">จำนวนเงิน</label>
                <input name="amount" type="number" step="0.01" className="input" />
              </div>
              <div className="sm:col-span-3">
                <label className="label">หมายเหตุ</label>
                <input name="note" className="input" />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={savingRepair} className="btn-secondary btn-sm w-full disabled:opacity-50">
                  {savingRepair ? "กำลังบันทึก..." : "เพิ่มรายการซ่อม"}
                </button>
              </div>
            </form>
          )}
        </div>
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
  acquisitionMethods,
  itemTypes,
  onChanged,
}: {
  canManage: boolean;
  rounds: { id: string; year: number; name: string; is_open: boolean }[];
  categories: Option[];
  buildings: Option[];
  units: Option[];
  budgetSources: Option[];
  acquisitionMethods: Option[];
  itemTypes: ItemType[];
  onChanged: () => void;
}) {
  const [items, setItems] = useState<AssetItem[] | null>(null);
  const [roundFilter, setRoundFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [conditionFilter, setConditionFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // สวิตช์คุมว่าจะพิมพ์รูปภาพ/QR Code ในทะเบียนคุมทรัพย์สินฉบับเต็มหรือไม่ (ส่งเป็น query string
  // ไปยัง route พิมพ์ PDF ของแต่ละรายการ) — ไม่ใช่ค่าที่บันทึกถาวร แค่คุมการพิมพ์รอบนี้เท่านั้น
  const [showPhotoInPdf, setShowPhotoInPdf] = useState(true);
  const [showQrInPdf, setShowQrInPdf] = useState(true);
  const pageSize = 50;

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("asset_items")
      .select(
        "id, round_id, building, floor, room, category_id, item_type_id, name, quantity, unit, asset_code, sequence_no, doc_ref, condition, acquired_date, acquired_year, budget_source_id, price, photo_path, status, reject_reason, vendor_name, vendor_address, vendor_phone, acquisition_method_id, model, spec",
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
      // รวม id ไว้ในช่องค้นหาด้วย — ค่าที่เข้ารหัสใน QR Code เป็น asset_code ถ้ามี ไม่งั้น fallback
      // เป็น id (ดู build-asset-register-pdf.tsx/build-asset-tag-pdf.tsx) สแกนแล้ววางค่าตรงนี้ได้เลย
      const hay = `${it.name} ${it.asset_code ?? ""} ${it.building} ${it.room} ${it.id}`.toLowerCase();
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
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="ชื่อ/รหัสครุภัณฑ์/สถานที่/สแกน QR"
                className="input"
              />
              <QrScanButton onScan={(value) => updateFilter(setSearch, value)} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-3">
          <span className="text-xs font-medium text-slate-500">การพิมพ์ทะเบียนคุมทรัพย์สิน (PDF):</span>
          <ToggleSwitch checked={showPhotoInPdf} onChange={() => setShowPhotoInPdf((v) => !v)} labelOn="แสดงรูปภาพ" labelOff="ซ่อนรูปภาพ" />
          <ToggleSwitch checked={showQrInPdf} onChange={() => setShowQrInPdf((v) => !v)} labelOn="แสดง QR Code" labelOff="ซ่อน QR Code" />
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
            acquisitionMethods={acquisitionMethods}
            itemTypes={itemTypes}
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
                      <a
                        href={`/asset-register/${it.id}/pdf?photo=${showPhotoInPdf ? 1 : 0}&qr=${showQrInPdf ? 1 : 0}`}
                        target="_blank"
                        className="btn-secondary btn-sm"
                      >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        พิมพ์
                      </a>
                      <a href={`/asset-register/${it.id}/tag`} target="_blank" className="btn-secondary btn-sm">
                        <TagIcon className="h-3.5 w-3.5" />
                        สติกเกอร์
                      </a>
                      <ItemModal
                        item={it}
                        canManage={canManage}
                        categories={categories}
                        buildings={buildings}
                        units={units}
                        budgetSources={budgetSources}
                        acquisitionMethods={acquisitionMethods}
                        itemTypes={itemTypes}
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
