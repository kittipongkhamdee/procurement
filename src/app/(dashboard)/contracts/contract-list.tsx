"use client";

// รายการสัญญาของประเภทหนึ่ง (จ้าง/ซื้อ/เช่า) — ใช้ซ้ำในหน้าย่อยของ "งานสัญญา" (/contracts/<ประเภท>)
// ดึงรายการสัญญาผ่าน browser Supabase client; เพิ่ม/แก้ไขผ่าน popup ฟอร์มเดียวกัน (ContractModal)
// การ์ดสำหรับพื้นที่แคบ / ตารางสำหรับพื้นที่กว้าง (@container แพทเทิร์นเดียวกับทะเบียนคุมทรัพย์สิน)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ThaiAddressInput } from "@/components/thai-address-input";
import Link from "next/link";
import { ChevronLeftIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { createContract, deleteContract, updateContract } from "./actions";

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Contract = {
  id: string;
  contract_no: string;
  contract_date: string;
  start_date: string | null;
  end_date: string | null;
  project_id: string | null;
  vendor_name: string;
  id_card: string | null;
  house_no: string | null;
  moo: string | null;
  tambon: string | null;
  amphoe: string | null;
  province: string | null;
  zipcode: string | null;
  phone: string | null;
  detail: string | null;
  budget: number | null;
  amount: number;
  guarantee_type: string | null;
  guarantee_amount: number | null;
  penalty_rate: number | null;
  inspector_name: string | null;
  note: string | null;
  plan_projects: { name: string } | null;
};
type Project = { id: string; name: string };

const GUARANTEE_TYPES = ["เงินสด", "เช็คธนาคาร", "หนังสือค้ำประกันของธนาคาร", "พันธบัตรรัฐบาล", "ไม่มีหลักประกัน"];

/** สถานะสัญญาจากวันสิ้นสุด: ยังไม่ระบุ / ยังไม่ครบกำหนด / ใกล้ครบ (≤7 วัน) / เลยกำหนด */
function contractStatus(endDate: string | null): { label: string; cls: string } {
  if (!endDate) return { label: "ไม่ระบุวันสิ้นสุด", cls: "badge-slate" };
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.round((Date.parse(endDate) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { label: `เลยกำหนด ${-days} วัน`, cls: "badge-red" };
  if (days <= 7) return { label: `เหลือ ${days} วัน`, cls: "badge-amber" };
  return { label: "อยู่ในสัญญา", cls: "badge-emerald" };
}

function ContractModal({
  type,
  contract,
  projects,
  teachers,
  onSaved,
}: {
  type: ContractType;
  contract: Contract | null;
  projects: Project[];
  teachers: string[];
  onSaved: () => void;
}) {
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  // โครงการเดิมของสัญญาที่ไม่อยู่ในรายการปีปัจจุบัน — ให้ยังเลือกค้างไว้ได้ตอนแก้ไข
  const projectOptions =
    contract?.project_id && !projects.some((p) => p.id === contract.project_id)
      ? [{ id: contract.project_id, name: contract.plan_projects?.name ?? "(โครงการปีก่อน)" }, ...projects]
      : projects;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    try {
      const formData = new FormData(form);
      const start = String(formData.get("start_date") ?? "");
      const end = String(formData.get("end_date") ?? "");
      if (start && end && end < start) {
        await toastError("วันสิ้นสุดสัญญาต้องไม่ก่อนวันเริ่มงาน");
        return;
      }
      const res = contract ? await updateContract(contract.id, formData) : await createContract(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!contract) form.reset();
      await toastSuccess(contract ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกสัญญาเรียบร้อยแล้ว");
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
      title={contract ? `แก้ไขสัญญา ${contract.contract_no}` : `บันทึกสัญญา${type}ใหม่`}
      wide
      lazy
      trigger={
        contract ? (
          <span className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            แก้ไข
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกสัญญาใหม่
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="contract_type" value={type} />
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ข้อมูลสัญญา</legend>
          <div>
            <label className="label">
              เลขที่สัญญา <span className="text-red-600">*</span>
            </label>
            <input name="contract_no" defaultValue={contract?.contract_no ?? ""} required className="input w-full" />
          </div>
          <div>
            <label className="label">
              วันที่ทำสัญญา <span className="text-red-600">*</span>
            </label>
            <ThaiDatePicker name="contract_date" defaultValue={contract?.contract_date ?? null} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">โครงการ</label>
            <select name="project_id" defaultValue={contract?.project_id ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">รายละเอียดงานจ้าง</label>
            <textarea name="detail" defaultValue={contract?.detail ?? ""} rows={3} className="input w-full" />
          </div>
          <div>
            <label className="label">วันเริ่มงาน</label>
            <ThaiDatePicker name="start_date" defaultValue={contract?.start_date ?? null} />
          </div>
          <div>
            <label className="label">วันสิ้นสุดสัญญา (ส่งมอบงาน)</label>
            <ThaiDatePicker name="end_date" defaultValue={contract?.end_date ?? null} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">ผู้รับจ้าง</legend>
          <div className="sm:col-span-2">
            <label className="label">
              ชื่อผู้รับจ้าง <span className="text-red-600">*</span>
            </label>
            <input name="vendor_name" defaultValue={contract?.vendor_name ?? ""} required className="input w-full" />
          </div>
          <div>
            <label className="label">เลขประจำตัวผู้เสียภาษี / บัตรประชาชน</label>
            <input name="id_card" defaultValue={contract?.id_card ?? ""} inputMode="numeric" className="input w-full" />
          </div>
          <div>
            <label className="label">โทรศัพท์</label>
            <input name="phone" defaultValue={contract?.phone ?? ""} inputMode="tel" className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="label">บ้านเลขที่</label>
              <input name="house_no" defaultValue={contract?.house_no ?? ""} className="input w-full" />
            </div>
            <div>
              <label className="label">หมู่ที่</label>
              <input name="moo" defaultValue={contract?.moo ?? ""} className="input w-full" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-slate-500">พิมพ์ตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์ แล้วเลือกจากรายการ ช่องที่เหลือจะเติมให้อัตโนมัติ</p>
            <ThaiAddressInput
              defaultValue={{ tambon: contract?.tambon, amphoe: contract?.amphoe, province: contract?.province, zipcode: contract?.zipcode }}
            />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy-800">เงินและเงื่อนไข</legend>
          <div>
            <label className="label">
              จำนวนเงินตามสัญญา (บาท) <span className="text-red-600">*</span>
            </label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="amount" defaultValue={contract?.amount ?? ""} required className="input w-full text-right font-semibold" />
          </div>
          <div>
            <label className="label">งบประมาณโครงการ (บาท)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="budget" defaultValue={contract?.budget ?? ""} className="input w-full text-right" />
          </div>
          <div>
            <label className="label">หลักประกันสัญญา</label>
            <select name="guarantee_type" defaultValue={contract?.guarantee_type ?? ""} className="input w-full">
              <option value="">-- ไม่ระบุ --</option>
              {GUARANTEE_TYPES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">จำนวนเงินหลักประกัน (บาท)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="guarantee_amount" defaultValue={contract?.guarantee_amount ?? ""} className="input w-full text-right" />
          </div>
          <div>
            <label className="label">ค่าปรับต่อวัน (ร้อยละของค่าจ้าง)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" name="penalty_rate" defaultValue={contract?.penalty_rate ?? ""} className="input w-full text-right" />
          </div>
          <div>
            <label className="label">ผู้ตรวจรับ</label>
            <input name="inspector_name" defaultValue={contract?.inspector_name ?? ""} list="contract-teacher-names" autoComplete="off" className="input w-full" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">หมายเหตุ</label>
            <textarea name="note" defaultValue={contract?.note ?? ""} rows={2} className="input w-full" />
          </div>
        </fieldset>
        <datalist id="contract-teacher-names">
          {teachers.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? "กำลังบันทึก..." : contract ? "บันทึกการแก้ไข" : "บันทึกสัญญา"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export type ContractType = "จ้าง" | "ซื้อ" | "เช่า";

export function ContractList({ type, title, subtitle }: { type: ContractType; title: string; subtitle: string }) {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: years } = await supabase.from("plan_budget_years").select("id, is_open, year").order("year", { ascending: false });
    const currentYear = years?.find((y) => y.is_open) ?? years?.[0] ?? null;
    const [{ data: contractsData, error }, { data: projectsData }, { data: teacherData }] = await Promise.all([
      supabase
        .from("proc_contracts")
        .select(
          "id, contract_no, contract_date, start_date, end_date, project_id, vendor_name, id_card, house_no, moo, tambon, amphoe, province, zipcode, phone, detail, budget, amount, guarantee_type, guarantee_amount, penalty_rate, inspector_name, note, plan_projects(name)",
        )
        .eq("contract_type", type)
        .order("contract_date", { ascending: false }),
      currentYear
        ? supabase.from("plan_projects").select("id, name").eq("budget_year_id", currentYear.id).order("sort_order")
        : Promise.resolve({ data: [] as Project[] }),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
    ]);
    setError(error?.message ?? null);
    setContracts((contractsData as unknown as Contract[]) ?? []);
    setProjects(projectsData ?? []);
    setTeachers((teacherData ?? []).map((t) => t.name));
  }, [type]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!contracts || !q) return contracts ?? [];
    return contracts.filter((c) =>
      [c.contract_no, c.vendor_name, c.plan_projects?.name, c.detail].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [contracts, query]);
  const total = filtered.reduce((sum, c) => sum + Number(c.amount), 0);

  async function handleDelete(c: Contract) {
    const ok = await confirmDelete({ title: `ลบสัญญา ${c.contract_no}?`, text: `ผู้รับจ้าง ${c.vendor_name}` });
    if (!ok) return;
    try {
      const res = await deleteContract(c.id);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      await toastSuccess("ลบสัญญาเรียบร้อยแล้ว");
      reload();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  function actions(c: Contract) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ContractModal type={type} contract={c} projects={projects} teachers={teachers} onSaved={reload} />
        <button type="button" onClick={() => handleDelete(c)} className="btn-danger btn-sm">
          <TrashIcon className="h-3.5 w-3.5" />
          ลบ
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/contracts" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
            <ChevronLeftIcon className="h-4 w-4" />
            งานสัญญา
          </Link>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <ContractModal type={type} contract={null} projects={projects} teachers={teachers} onSaved={reload} />
      </div>

      {contracts === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาเลขที่สัญญา ผู้รับจ้าง โครงการ"
                className="input w-full pl-9"
              />
            </div>
            <p className="text-sm text-slate-500">
              {filtered.length} สัญญา · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}

            {/* พื้นที่แคบ: การ์ด */}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((c) => {
                const st = contractStatus(c.end_date);
                return (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{c.contract_no}</span>
                      <span className={st.cls}>{st.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{c.vendor_name}</p>
                    <p className="text-xs text-slate-500">{c.plan_projects?.name ?? "ไม่ระบุโครงการ"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      ทำสัญญา {formatThaiDate(c.contract_date)}
                      {c.end_date ? ` · สิ้นสุด ${formatThaiDate(c.end_date)}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatBaht(Number(c.amount))} บาท</p>
                    <div className="mt-2">{actions(c)}</div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบสัญญาที่ค้นหา" : "ยังไม่มีข้อมูล"}</p>}
            </div>

            {/* พื้นที่กว้าง: ตาราง */}
            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>เลขที่สัญญา</th>
                  <th>วันที่ทำสัญญา</th>
                  <th>โครงการ</th>
                  <th>ผู้รับจ้าง</th>
                  <th>สิ้นสุดสัญญา</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = contractStatus(c.end_date);
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-slate-900">{c.contract_no}</td>
                      <td>{formatThaiDate(c.contract_date)}</td>
                      <td>{c.plan_projects?.name ?? "-"}</td>
                      <td>{c.vendor_name}</td>
                      <td>
                        <div>{c.end_date ? formatThaiDate(c.end_date) : "-"}</div>
                        <span className={`${st.cls} text-sm`}>{st.label}</span>
                      </td>
                      <td className="text-right font-semibold text-slate-900">{formatBaht(Number(c.amount))}</td>
                      <td className="text-right">{actions(c)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {query ? "ไม่พบสัญญาที่ค้นหา" : "ยังไม่มีข้อมูล"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
