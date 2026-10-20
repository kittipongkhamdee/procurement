"use client";

// ตั้งค่าบัญชีรับ-จ่ายเงิน — ประเภทเงิน (แทนชีต M1) / สมุดบัญชีเงินฝาก / ยอดยกมาต้นปีงบ / ผู้ลงนามรายงานเงินคงเหลือประจำวัน
// แก้ได้เฉพาะเจ้าหน้าที่การเงิน/แอดมิน

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { confirmDelete, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { FIN_SIGNER_KEYS, fiscalYearOf, type FinAccount, type MoneyType } from "@/lib/finance-ledger";
import { deleteAccount, deleteMoneyType, saveAccount, saveMoneyType, saveOpenings, saveSigners } from "../actions";

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MoneyTypeForm({ item, accounts, categories, onSaved }: { item?: MoneyType; accounts: FinAccount[]; categories: string[]; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await saveMoneyType(item?.id ?? null, new FormData(e.currentTarget));
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("บันทึกแล้ว");
    ref.current?.close();
    onSaved();
  }
  return (
    <Modal
      ref={ref}
      title={item ? "แก้ไขประเภทเงิน" : "เพิ่มประเภทเงิน"}
      lazy
      trigger={
        item ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="btn-primary btn-sm inline-flex items-center gap-1">
            <PlusIcon className="h-3.5 w-3.5" />
            เพิ่มประเภทเงิน
          </span>
        )
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">
            ชื่อประเภทเงิน <span className="text-red-600">*</span>
          </label>
          <input name="name" defaultValue={item?.name ?? ""} required className="input w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">หมวด (ในรายงานเงินคงเหลือประจำวัน)</label>
          <input name="category" list="fin-categories" defaultValue={item?.category ?? ""} placeholder="เช่น เงินอุดหนุนเรียนฟรี 15 ปี" className="input w-full" />
          <datalist id="fin-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">ประเภทที่หมวดเดียวกันจะแสดงรวมกลุ่มกันในรายงาน — ว่างไว้ = แสดงเป็นหมวดของตัวเอง</p>
        </div>
        <div>
          <label className="label">สมุดบัญชีเงินฝาก</label>
          <select name="account_id" defaultValue={item?.account_id ?? ""} className="input w-full">
            <option value="">— ไม่ระบุ —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ลำดับ</label>
          <input name="sort_order" type="number" defaultValue={item?.sort_order ?? 99} className="input w-full text-right" />
        </div>
        <div>
          <label className="label">สถานะ</label>
          <select name="is_active" defaultValue={item?.is_active === false ? "false" : "true"} className="input w-full">
            <option value="true">ใช้งาน</option>
            <option value="false">ปิดใช้งาน (ไม่แสดงในฟอร์มบันทึก)</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary">
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AccountForm({ item, onSaved }: { item?: FinAccount; onSaved: () => void }) {
  const ref = useRef<ModalHandle>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await saveAccount(item?.id ?? null, new FormData(e.currentTarget));
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("บันทึกแล้ว");
    ref.current?.close();
    onSaved();
  }
  return (
    <Modal
      ref={ref}
      title={item ? "แก้ไขสมุดบัญชี" : "เพิ่มสมุดบัญชี"}
      lazy
      trigger={
        item ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="btn-primary btn-sm inline-flex items-center gap-1">
            <PlusIcon className="h-3.5 w-3.5" />
            เพิ่มสมุดบัญชี
          </span>
        )
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">
            ชื่อบัญชี <span className="text-red-600">*</span>
          </label>
          <input name="name" defaultValue={item?.name ?? ""} required className="input w-full" />
        </div>
        <div>
          <label className="label">ธนาคาร</label>
          <input name="bank_name" defaultValue={item?.bank_name ?? ""} placeholder="เช่น ธนาคารกรุงไทย สาขา..." className="input w-full" />
        </div>
        <div>
          <label className="label">เลขที่บัญชี</label>
          <input name="account_no" defaultValue={item?.account_no ?? ""} className="input w-full" />
        </div>
        <div>
          <label className="label">ลำดับ</label>
          <input name="sort_order" type="number" defaultValue={item?.sort_order ?? 99} className="input w-full text-right" />
        </div>
        <div>
          <label className="label">สถานะ</label>
          <select name="is_active" defaultValue={item?.is_active === false ? "false" : "true"} className="input w-full">
            <option value="true">ใช้งาน</option>
            <option value="false">ปิดใช้งาน</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" className="btn-primary">
            บันทึก
          </button>
        </div>
      </form>
    </Modal>
  );
}

type OpeningInput = { cash: string; bank: string; gov: string };

export default function LedgerSettingsPage() {
  const { role, loading } = useAuth();
  const canWrite = role === "admin" || role === "finance_officer";
  const [types, setTypes] = useState<MoneyType[] | null>(null);
  const [accounts, setAccounts] = useState<FinAccount[]>([]);
  const [fy, setFy] = useState(fiscalYearOf(todayLocal()));
  const [openings, setOpenings] = useState<Record<string, OpeningInput>>({});
  const [signers, setSigners] = useState<Record<string, string>>({});
  const [savingOpen, setSavingOpen] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: mt }, { data: ac }, { data: op }, { data: st }] = await Promise.all([
      supabase.from("fin_money_types").select("id, name, category, account_id, sort_order, is_active").order("sort_order"),
      supabase.from("fin_accounts").select("id, name, bank_name, account_no, sort_order, is_active").order("sort_order"),
      supabase.from("fin_opening_balances").select("money_type_id, cash, bank, gov").eq("fiscal_year", fy),
      supabase.from("fin_settings").select("key, value"),
    ]);
    setTypes((mt ?? []) as MoneyType[]);
    setAccounts((ac ?? []) as FinAccount[]);
    const o: Record<string, OpeningInput> = {};
    for (const r of op ?? []) o[r.money_type_id] = { cash: String(Number(r.cash)), bank: String(Number(r.bank)), gov: String(Number(r.gov)) };
    setOpenings(o);
    setSigners(Object.fromEntries((st ?? []).map((s) => [s.key, s.value ?? ""])));
  }, [fy]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (loading || types === null) return <PageLoadingSkeleton />;
  if (!canWrite)
    return (
      <div className="card text-sm text-slate-600">
        หน้านี้สำหรับเจ้าหน้าที่การเงินหรือผู้ดูแลระบบ —{" "}
        <Link href="/finance/ledger" className="font-semibold text-navy-800 underline">
          กลับบัญชีรับ-จ่ายเงิน
        </Link>
      </div>
    );

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categories = Array.from(new Set(types.map((t) => t.category).filter((c): c is string => !!c)));
  const setOpen = (id: string, k: keyof OpeningInput, v: string) => setOpenings((o) => ({ ...o, [id]: { ...(o[id] ?? { cash: "", bank: "", gov: "" }), [k]: v } }));

  async function removeType(t: MoneyType) {
    if (!(await confirmDelete({ title: `ลบประเภทเงิน "${t.name}"?` }))) return;
    const res = await deleteMoneyType(t.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }
  async function removeAccount(a: FinAccount) {
    if (!(await confirmDelete({ title: `ลบสมุดบัญชี "${a.name}"?`, text: "ประเภทเงินที่ผูกกับบัญชีนี้จะไม่มีสมุดบัญชี" }))) return;
    const res = await deleteAccount(a.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }
  async function submitOpenings() {
    setSavingOpen(true);
    try {
      const rows = (types ?? []).map((t) => ({
        money_type_id: t.id,
        cash: Number(openings[t.id]?.cash) || 0,
        bank: Number(openings[t.id]?.bank) || 0,
        gov: Number(openings[t.id]?.gov) || 0,
      }));
      const res = await saveOpenings(fy, rows);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess(`บันทึกยอดยกมาปีงบ ${fy} แล้ว`);
      reload();
    } finally {
      setSavingOpen(false);
    }
  }
  async function submitSigners(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const res = await saveSigners(new FormData(e.currentTarget));
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("บันทึกผู้ลงนามแล้ว");
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <Link href="/finance/ledger" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
            <ChevronLeftIcon className="h-4 w-4" />
            บัญชีรับ-จ่ายเงิน
          </Link>
          <h1 className="page-title">ตั้งค่าบัญชีรับ-จ่ายเงิน</h1>
          <p className="page-subtitle">ประเภทเงิน · สมุดบัญชีเงินฝาก · ยอดยกมาต้นปีงบประมาณ · ผู้ลงนามรายงาน</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title mb-0">ประเภทเงิน ({types.length})</div>
          <MoneyTypeForm accounts={accounts} categories={categories} onSaved={reload} />
        </div>
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ประเภทเงิน</th>
              <th>หมวด</th>
              <th>สมุดบัญชี</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td>{t.sort_order}</td>
                <td>{t.name}</td>
                <td className="text-slate-600">{t.category ?? "-"}</td>
                <td className="text-slate-600">{t.account_id ? accountName.get(t.account_id) : "-"}</td>
                <td>{t.is_active ? <span className="badge-emerald !text-sm">ใช้งาน</span> : <span className="badge-slate !text-sm">ปิดใช้งาน</span>}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1">
                    <MoneyTypeForm item={t} accounts={accounts} categories={categories} onSaved={reload} />
                    <button type="button" onClick={() => removeType(t)} title="ลบ" className="btn-danger btn-sm">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title mb-0">สมุดบัญชีเงินฝาก ({accounts.length})</div>
          <AccountForm onSaved={reload} />
        </div>
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ชื่อบัญชี</th>
              <th>ธนาคาร</th>
              <th>เลขที่บัญชี</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.sort_order}</td>
                <td>
                  {a.name} {!a.is_active && <span className="badge-slate !text-sm">ปิดใช้งาน</span>}
                </td>
                <td className="text-slate-600">{a.bank_name ?? "-"}</td>
                <td className="text-slate-600">{a.account_no ?? "-"}</td>
                <td className="whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1">
                    <AccountForm item={a} onSaved={reload} />
                    <button type="button" onClick={() => removeAccount(a)} title="ลบ" className="btn-danger btn-sm">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title mb-0">ยอดยกมาต้นปีงบประมาณ</div>
          <select value={fy} onChange={(e) => setFy(Number(e.target.value))} className="input w-auto" aria-label="ปีงบประมาณ">
            {[fiscalYearOf(todayLocal()) + 1, fiscalYearOf(todayLocal()), fiscalYearOf(todayLocal()) - 1].map((y) => (
              <option key={y} value={y}>
                ปีงบประมาณ {y}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 text-sm text-slate-500">ยอดคงเหลือ ณ 1 ตุลาคม (ต้นปีงบ) ของแต่ละประเภทเงิน — เริ่มปีใหม่ทั้งหมดใส่ 0 ได้</p>
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>ประเภทเงิน</th>
              <th className="text-right">เงินสด</th>
              <th className="text-right">เงินฝากธนาคาร</th>
              <th className="text-right">เงินฝากส่วนราชการ</th>
            </tr>
          </thead>
          <tbody>
            {types
              .filter((t) => t.is_active || openings[t.id])
              .map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  {(["cash", "bank", "gov"] as const).map((k) => (
                    <td key={k} className="w-40">
                      <input type="number" step="0.01" value={openings[t.id]?.[k] ?? ""} onChange={(e) => setOpen(t.id, k, e.target.value)} placeholder="0.00" className="input w-full text-right" aria-label={`${t.name} ${k}`} />
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={submitOpenings} disabled={savingOpen} className="btn-primary">
            {savingOpen ? "กำลังบันทึก..." : `บันทึกยอดยกมาปีงบ ${fy}`}
          </button>
        </div>
      </div>

      <form onSubmit={submitSigners} className="card">
        <div className="card-title">ผู้ลงนามรายงานเงินคงเหลือประจำวัน</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIN_SIGNER_KEYS.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-100 p-3 sm:col-span-2 sm:grid-cols-2">
              <p className="text-sm font-semibold text-slate-700 sm:col-span-2">{label}</p>
              <input name={`${key}_name`} defaultValue={signers[`${key}_name`] ?? ""} placeholder="ชื่อ-สกุล" className="input w-full" />
              <input name={`${key}_position`} defaultValue={signers[`${key}_position`] ?? ""} placeholder="ตำแหน่ง" className="input w-full" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" className="btn-primary">
            บันทึกผู้ลงนาม
          </button>
        </div>
      </form>
    </div>
  );
}
