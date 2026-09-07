"use client";

import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { ToggleSwitch } from "@/components/toggle-switch";
import { CloseIcon } from "@/components/icons";
import { useState } from "react";
import {
  createAssetAcquisitionMethod,
  createAssetBudgetSource,
  createAssetBuilding,
  createAssetCategory,
  createAssetItemType,
  createAssetUnit,
  deleteAssetAcquisitionMethod,
  deleteAssetBudgetSource,
  deleteAssetBuilding,
  deleteAssetCategory,
  deleteAssetItemType,
  deleteAssetUnit,
  toggleAssetAcquisitionMethodActive,
  toggleAssetBudgetSourceActive,
  toggleAssetBuildingActive,
  toggleAssetCategoryActive,
  toggleAssetItemTypeActive,
  toggleAssetUnitActive,
  updateAssetAcquisitionMethodName,
  updateAssetBudgetSourceName,
  updateAssetBuildingName,
  updateAssetCategory,
  updateAssetItemType,
  updateAssetUnitName,
} from "./actions";

type Lookup = { id: string; name: string; is_active: boolean };
type Category = Lookup & {
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
  type_code: string | null;
};
type ItemType = Lookup & { category_id: string; code: string };

// รายการหมวดหมู่/สถานที่/หน่วยนับ/แหล่งงบประมาณ ทั้ง 4 ชุดใช้โครงเดียวกัน (id/name/is_active) —
// รวมเป็น component เดียวใช้ซ้ำ 3 ครั้ง (buildings/units/budget sources) ยกเว้นหมวดหมู่ที่มีฟิลด์
// เพิ่ม (อายุการใช้งาน/อัตราค่าเสื่อม) แยกเป็น CategoryList ต่างหาก
function LookupList({
  title,
  placeholder,
  rows,
  canManage,
  onCreate,
  onRename,
  onToggle,
  onDelete,
  onChanged,
}: {
  title: string;
  placeholder: string;
  rows: Lookup[];
  canManage: boolean;
  onCreate: (formData: FormData) => Promise<void>;
  onRename: (id: string, formData: FormData) => Promise<void>;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onChanged: () => void;
}) {
  async function handleRenameBlur(id: string, currentName: string, e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name || name === currentName) {
      e.target.value = currentName;
      return;
    }
    const formData = new FormData();
    formData.set("name", name);
    try {
      await onRename(id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      e.target.value = currentName;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await onToggle(id, isActive);
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบ "${name}"?` });
    if (!ok) return;
    try {
      await onDelete(id);
      await toastSuccess("ลบเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await onCreate(formData);
      await toastSuccess("เพิ่มเรียบร้อยแล้ว");
      form.reset();
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  {canManage ? (
                    <input defaultValue={r.name} onBlur={(e) => handleRenameBlur(r.id, r.name, e)} className="input" />
                  ) : (
                    r.name
                  )}
                </td>
                <td className="w-40 text-center">
                  {canManage ? (
                    <ToggleSwitch checked={r.is_active} onChange={() => handleToggle(r.id, r.is_active)} />
                  ) : (
                    <span className={r.is_active ? "badge-emerald" : "badge-slate"}>
                      {r.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="whitespace-nowrap px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.name)}
                      className="icon-btn-danger"
                      aria-label="ลบ"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canManage && (
        <form onSubmit={handleCreate} className="flex gap-3">
          <input name="name" placeholder={placeholder} required className="input" />
          <button type="submit" className="btn-primary shrink-0">
            เพิ่ม
          </button>
        </form>
      )}
    </div>
  );
}

function CategoryList({
  categories,
  canManage,
  onChanged,
}: {
  categories: Category[];
  canManage: boolean;
  onChanged: () => void;
}) {
  async function handleSaveBlur(
    id: string,
    field: "useful_life_years" | "depreciation_rate_percent" | "type_code",
    category: Category,
    e: React.FocusEvent<HTMLInputElement>,
  ) {
    const value = e.target.value;
    const formData = new FormData();
    formData.set("name", category.name);
    formData.set("useful_life_years", field === "useful_life_years" ? value : String(category.useful_life_years ?? ""));
    formData.set(
      "depreciation_rate_percent",
      field === "depreciation_rate_percent" ? value : String(category.depreciation_rate_percent ?? ""),
    );
    formData.set("type_code", field === "type_code" ? value : category.type_code ?? "");
    try {
      await updateAssetCategory(id, formData);
      await toastSuccess("บันทึกเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleRenameBlur(category: Category, e: React.FocusEvent<HTMLInputElement>) {
    const name = e.target.value.trim();
    if (!name || name === category.name) {
      e.target.value = category.name;
      return;
    }
    const formData = new FormData();
    formData.set("name", name);
    formData.set("useful_life_years", String(category.useful_life_years ?? ""));
    formData.set("depreciation_rate_percent", String(category.depreciation_rate_percent ?? ""));
    formData.set("type_code", category.type_code ?? "");
    try {
      await updateAssetCategory(category.id, formData);
      await toastSuccess("บันทึกชื่อเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      e.target.value = category.name;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleAssetCategoryActive(id, isActive);
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบหมวดหมู่ "${name}"?` });
    if (!ok) return;
    try {
      await deleteAssetCategory(id);
      await toastSuccess("ลบเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createAssetCategory(formData);
      await toastSuccess("เพิ่มหมวดหมู่เรียบร้อยแล้ว");
      form.reset();
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">หมวดหมู่ครุภัณฑ์</div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th>ชื่อหมวดหมู่</th>
              <th className="whitespace-nowrap text-right">รหัสประเภท</th>
              <th className="whitespace-nowrap text-right">อายุการใช้งาน (ปี)</th>
              <th className="whitespace-nowrap text-right">อัตราค่าเสื่อม (%)</th>
              <th className="text-center">สถานะ</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2">
                  {canManage ? (
                    <input defaultValue={c.name} onBlur={(e) => handleRenameBlur(c, e)} className="input" />
                  ) : (
                    c.name
                  )}
                </td>
                <td className="w-24">
                  {canManage ? (
                    <input
                      defaultValue={c.type_code ?? ""}
                      placeholder="เช่น 20"
                      onBlur={(e) => handleSaveBlur(c.id, "type_code", c, e)}
                      className="input text-right"
                    />
                  ) : (
                    <span className="block text-right tabular-nums">{c.type_code ?? "-"}</span>
                  )}
                </td>
                <td className="w-32">
                  {canManage ? (
                    <input
                      type="number"
                      defaultValue={c.useful_life_years ?? ""}
                      onBlur={(e) => handleSaveBlur(c.id, "useful_life_years", c, e)}
                      className="input text-right"
                    />
                  ) : (
                    <span className="block text-right tabular-nums">{c.useful_life_years ?? "-"}</span>
                  )}
                </td>
                <td className="w-32">
                  {canManage ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={c.depreciation_rate_percent ?? ""}
                      onBlur={(e) => handleSaveBlur(c.id, "depreciation_rate_percent", c, e)}
                      className="input text-right"
                    />
                  ) : (
                    <span className="block text-right tabular-nums">{c.depreciation_rate_percent ?? "-"}</span>
                  )}
                </td>
                <td className="text-center">
                  {canManage ? (
                    <ToggleSwitch checked={c.is_active} onChange={() => handleToggle(c.id, c.is_active)} />
                  ) : (
                    <span className={c.is_active ? "badge-emerald" : "badge-slate"}>
                      {c.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="whitespace-nowrap px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id, c.name)}
                      className="icon-btn-danger"
                      aria-label="ลบ"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  ยังไม่มีหมวดหมู่
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canManage && (
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
          <input name="name" placeholder="ชื่อหมวดหมู่" required className="input flex-1" />
          <input name="type_code" placeholder="รหัสประเภท เช่น 20" className="input w-32" />
          <input name="useful_life_years" type="number" placeholder="อายุการใช้งาน (ปี)" className="input w-44" />
          <input
            name="depreciation_rate_percent"
            type="number"
            step="0.01"
            placeholder="อัตราค่าเสื่อม (%)"
            className="input w-44"
          />
          <button type="submit" className="btn-primary shrink-0">
            เพิ่ม
          </button>
        </form>
      )}
    </div>
  );
}

// ชนิดครุภัณฑ์ (เช่น "โต๊ะทำงาน"=01, "เก้าอี้"=02) แยกตามหมวดหมู่ — ใช้กำหนดรหัสชนิด 2 หลักหลังจุด
// ตอนกดสร้างเลขครุภัณฑ์อัตโนมัติในฟอร์มบันทึกรายการ (รหัสประเภทของหมวดหมู่ + รหัสชนิดนี้)
function ItemTypeList({
  categories,
  itemTypes,
  canManage,
  onChanged,
}: {
  categories: Lookup[];
  itemTypes: ItemType[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const filtered = itemTypes.filter((t) => t.category_id === categoryId);

  async function handleSaveBlur(
    id: string,
    field: "name" | "code",
    itemType: ItemType,
    e: React.FocusEvent<HTMLInputElement>,
  ) {
    const value = e.target.value.trim();
    if (!value) {
      e.target.value = field === "name" ? itemType.name : itemType.code;
      return;
    }
    const formData = new FormData();
    formData.set("name", field === "name" ? value : itemType.name);
    formData.set("code", field === "code" ? value : itemType.code);
    try {
      await updateAssetItemType(id, formData);
      await toastSuccess("บันทึกเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      e.target.value = field === "name" ? itemType.name : itemType.code;
      await toastError(errorMessage(err));
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleAssetItemTypeActive(id, isActive);
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmDelete({ title: `ลบชนิดครุภัณฑ์ "${name}"?` });
    if (!ok) return;
    try {
      await deleteAssetItemType(id);
      await toastSuccess("ลบเรียบร้อยแล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("category_id", categoryId);
    try {
      await createAssetItemType(formData);
      await toastSuccess("เพิ่มเรียบร้อยแล้ว");
      form.reset();
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return (
    <div className="card">
      <div className="card-title">ชนิดครุภัณฑ์ (ตามหมวดหมู่)</div>
      <div className="mb-4">
        <label className="label">หมวดหมู่</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="table-shell mb-4">
        <table className="table-base">
          <thead>
            <tr>
              <th className="whitespace-nowrap w-24">รหัสชนิด</th>
              <th>ชื่อชนิดครุภัณฑ์</th>
              <th className="text-center">สถานะ</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  {canManage ? (
                    <input defaultValue={t.code} onBlur={(e) => handleSaveBlur(t.id, "code", t, e)} className="input text-right" />
                  ) : (
                    <span className="block text-right tabular-nums">{t.code}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {canManage ? (
                    <input defaultValue={t.name} onBlur={(e) => handleSaveBlur(t.id, "name", t, e)} className="input" />
                  ) : (
                    t.name
                  )}
                </td>
                <td className="text-center">
                  {canManage ? (
                    <ToggleSwitch checked={t.is_active} onChange={() => handleToggle(t.id, t.is_active)} />
                  ) : (
                    <span className={t.is_active ? "badge-emerald" : "badge-slate"}>
                      {t.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="whitespace-nowrap px-4 text-right">
                    <button type="button" onClick={() => handleDelete(t.id, t.name)} className="icon-btn-danger" aria-label="ลบ">
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty">
                  หมวดหมู่นี้ยังไม่มีชนิดครุภัณฑ์
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canManage && categoryId && (
        <form onSubmit={handleCreate} className="flex gap-3">
          <input name="code" placeholder="รหัสชนิด เช่น 01" required className="input w-32" />
          <input name="name" placeholder="ชื่อชนิดครุภัณฑ์ เช่น โต๊ะทำงาน" required className="input flex-1" />
          <button type="submit" className="btn-primary shrink-0">
            เพิ่ม
          </button>
        </form>
      )}
    </div>
  );
}

export function MasterDataTab({
  canManage,
  categories,
  buildings,
  units,
  budgetSources,
  acquisitionMethods,
  itemTypes,
  onChanged,
}: {
  canManage: boolean;
  categories: Category[];
  buildings: Lookup[];
  units: Lookup[];
  budgetSources: Lookup[];
  acquisitionMethods: Lookup[];
  itemTypes: ItemType[];
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <CategoryList categories={categories} canManage={canManage} onChanged={onChanged} />
      <ItemTypeList categories={categories} itemTypes={itemTypes} canManage={canManage} onChanged={onChanged} />
      <LookupList
        title="อาคาร/สถานที่"
        placeholder="ชื่ออาคาร เช่น อาคาร 1"
        rows={buildings}
        canManage={canManage}
        onCreate={createAssetBuilding}
        onRename={updateAssetBuildingName}
        onToggle={toggleAssetBuildingActive}
        onDelete={deleteAssetBuilding}
        onChanged={onChanged}
      />
      <LookupList
        title="หน่วยนับ"
        placeholder="หน่วยนับ เช่น ชิ้น, ชุด, ตัว"
        rows={units}
        canManage={canManage}
        onCreate={createAssetUnit}
        onRename={updateAssetUnitName}
        onToggle={toggleAssetUnitActive}
        onDelete={deleteAssetUnit}
        onChanged={onChanged}
      />
      <LookupList
        title="แหล่งงบประมาณ"
        placeholder="ชื่อแหล่งงบประมาณ"
        rows={budgetSources}
        canManage={canManage}
        onCreate={createAssetBudgetSource}
        onRename={updateAssetBudgetSourceName}
        onToggle={toggleAssetBudgetSourceActive}
        onDelete={deleteAssetBudgetSource}
        onChanged={onChanged}
      />
      <LookupList
        title="วิธีการได้มา"
        placeholder="วิธีการได้มา เช่น จัดซื้อ, บริจาค"
        rows={acquisitionMethods}
        canManage={canManage}
        onCreate={createAssetAcquisitionMethod}
        onRename={updateAssetAcquisitionMethodName}
        onToggle={toggleAssetAcquisitionMethodActive}
        onDelete={deleteAssetAcquisitionMethod}
        onChanged={onChanged}
      />
    </div>
  );
}
