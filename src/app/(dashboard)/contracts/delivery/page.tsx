"use client";

// ส่งมอบตามสัญญา — บันทึกการส่งมอบ/ตรวจรับแต่ละงวดของสัญญาจ้างและสัญญาซื้อ แสดงยอดส่งมอบแล้ว/คงเหลือของสัญญา
// และคำนวณวันเกินกำหนดกับค่าปรับให้อัตโนมัติจาก "วันสิ้นสุดสัญญา/กำหนดส่งมอบ" และ "ค่าปรับต่อวัน" ของสัญญา (แก้ไขได้)

import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, confirmWarning, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ChevronLeftIcon, PencilIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { createDelivery, deleteDelivery, updateDelivery } from "../../deliveries/actions";

type Contract = {
  id: string;
  contract_type: string;
  contract_no: string;
  vendor_name: string;
  amount: number;
  end_date: string | null;
  penalty_rate: number | null;
  inspector_name: string | null;
};
type Delivery = {
  id: string;
  contract_id: string;
  installment_no: number | null;
  delivery_date: string;
  period_month: string | null;
  amount: number;
  late_days: number | null;
  penalty_amount: number | null;
  withholding_tax: number | null;
  inspector_name: string | null;
  note: string | null;
};

function formatBaht(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

/** "2026-09-01" → "กันยายน 2569" */
function formatPeriod(iso: string | null) {
  if (!iso) return "-";
  const [y, m] = iso.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** ค่าปรับต่อวัน = อัตรา% × ฐาน — สัญญาจ้างคิดจากค่าจ้างทั้งสัญญา, สัญญาซื้อคิดจากราคาพัสดุที่ส่งมอบล่าช้า (งวดนี้) */
function suggestPenalty(contract: Contract, deliveryAmount: number, lateDays: number) {
  if (!contract.penalty_rate || lateDays <= 0) return 0;
  const base = contract.contract_type === "ซื้อ" ? deliveryAmount : Number(contract.amount);
  return Math.round(base * (contract.penalty_rate / 100) * lateDays * 100) / 100;
}

// รายละเอียดการส่งมอบงวดนี้ พร้อมข้อมูลสัญญาและยอดส่งมอบสะสม/คงเหลือ ณ งวดนี้
function DeliveryDetailModal({ delivery: d, contract: c, deliveries }: { delivery: Delivery; contract: Contract | undefined; deliveries: Delivery[] }) {
  const sameContract = deliveries.filter((x) => x.contract_id === d.contract_id);
  const upToThis = sameContract.filter(
    (x) => x.delivery_date < d.delivery_date || (x.delivery_date === d.delivery_date && (x.installment_no ?? 0) <= (d.installment_no ?? 0)),
  );
  const cumulative = upToThis.reduce((sum, x) => sum + Number(x.amount), 0);
  const net = Number(d.amount) - Number(d.penalty_amount ?? 0) - Number(d.withholding_tax ?? 0);
  const rows: [string, React.ReactNode][] = [
    ["สัญญา", c ? `สัญญา${c.contract_type} เลขที่ ${c.contract_no}` : "-"],
    ["คู่สัญญา", c?.vendor_name ?? "-"],
    ["มูลค่าสัญญา", c ? `${formatBaht(Number(c.amount))} บาท` : "-"],
    ["วันสิ้นสุดสัญญา / กำหนดส่งมอบ", c?.end_date ? formatThaiDate(c.end_date) : "-"],
    ["งวดที่", d.installment_no ?? "-"],
    ["ประจำเดือน", formatPeriod(d.period_month)],
    ["วันที่ส่งมอบ", formatThaiDate(d.delivery_date)],
    ["จำนวนเงินงวดนี้", `${formatBaht(Number(d.amount))} บาท`],
    ["เกินกำหนด", d.late_days ? `${d.late_days} วัน` : "ไม่เกินกำหนด"],
    ["ค่าปรับ", d.penalty_amount ? `${formatBaht(Number(d.penalty_amount))} บาท` : "-"],
    ["ภาษีหัก ณ ที่จ่าย", d.withholding_tax ? `${formatBaht(Number(d.withholding_tax))} บาท` : "-"],
    ["คงเหลือจ่ายงวดนี้", `${formatBaht(net)} บาท`],
    ["ส่งมอบสะสมถึงงวดนี้", `${formatBaht(cumulative)} บาท (${upToThis.length} งวด)`],
    ["คงเหลือตามสัญญา", c ? `${formatBaht(Number(c.amount) - cumulative)} บาท` : "-"],
    ["ผู้ตรวจรับ", d.inspector_name || "-"],
    ["หมายเหตุ", d.note || "-"],
  ];
  return (
    <Modal
      title={`ส่งมอบ ${c?.contract_no ?? ""} งวดที่ ${d.installment_no ?? "-"}`}
      wide
      lazy
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
            <dd className="whitespace-pre-line text-slate-900 sm:col-span-2">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

function DeliveryModal({
  delivery,
  contracts,
  deliveries,
  teachers,
  onSaved,
}: {
  delivery: Delivery | null;
  contracts: Contract[];
  deliveries: Delivery[];
  teachers: string[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const modalRef = useRef<ModalHandle>(null);
  const [saving, setSaving] = useState(false);
  const [contractId, setContractId] = useState(delivery?.contract_id ?? "");
  const [date, setDate] = useState<string | null>(delivery?.delivery_date ?? null);
  // งวดเดือน (YYYY-MM) — ตั้งตามเดือนของวันที่ส่งมอบอัตโนมัติจนกว่าผู้ใช้จะเลือกเอง (ส่งมอบต้นเดือนถัดไปของงวดเดือนก่อนได้)
  const [period, setPeriod] = useState<string>(delivery?.period_month?.slice(0, 7) ?? "");
  const [periodTouched, setPeriodTouched] = useState(!!delivery);
  const periodValue = periodTouched ? period : (date?.slice(0, 7) ?? "");
  const [pYear, pMonth] = periodValue ? periodValue.split("-").map(Number) : [0, 0];
  const yearChoices = (() => {
    const base = pYear || new Date().getFullYear();
    return [base - 1, base, base + 1];
  })();
  function changePeriod(year: number, month: number) {
    setPeriodTouched(true);
    setPeriod(`${year}-${String(month).padStart(2, "0")}`);
  }
  const [amount, setAmount] = useState(delivery ? String(delivery.amount) : "");
  const [penalty, setPenalty] = useState(delivery?.penalty_amount != null ? String(delivery.penalty_amount) : "");
  const [penaltyTouched, setPenaltyTouched] = useState(!!delivery);
  const contract = contracts.find((c) => c.id === contractId) ?? null;

  const others = deliveries.filter((d) => d.contract_id === contractId && d.id !== delivery?.id);
  const deliveredOthers = others.reduce((s, d) => s + Number(d.amount), 0);
  const remaining = contract ? Number(contract.amount) - deliveredOthers : 0;
  const lateDays = contract?.end_date && date ? Math.max(daysBetween(contract.end_date, date), 0) : 0;
  const suggested = contract ? suggestPenalty(contract, parseFloat(amount) || 0, lateDays) : 0;
  const penaltyValue = penaltyTouched ? penalty : suggested ? String(suggested) : "";

  function selectContract(id: string) {
    setContractId(id);
    const c = contracts.find((x) => x.id === id);
    if (c && !delivery) {
      // มีงวดก่อนแล้ว (เช่น จ้างรายเดือน) ใช้ยอดเท่างวดล่าสุด ไม่เกินคงเหลือ; ยังไม่มีงวด ใช้ยอดคงเหลือทั้งหมด
      const prev = deliveries.filter((d) => d.contract_id === id);
      const left = Number(c.amount) - prev.reduce((s, d) => s + Number(d.amount), 0);
      const last = [...prev].sort((a, b) => b.delivery_date.localeCompare(a.delivery_date))[0];
      const suggestion = last ? Math.min(Number(last.amount), left) : left;
      setAmount(suggestion > 0 ? String(Math.round(suggestion * 100) / 100) : "");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (!date) {
      await toastError("กรุณาเลือกวันที่ส่งมอบ");
      return;
    }
    if ((parseFloat(amount) || 0) > remaining + 0.005) {
      await toastError(`จำนวนเงินที่ส่งมอบเกินยอดคงเหลือของสัญญา (${formatBaht(remaining)} บาท)`);
      return;
    }
    formData.set("period_month", periodValue);
    formData.set("late_days", String(lateDays));
    formData.set("penalty_amount", penaltyValue);
    setSaving(true);
    try {
      const res = delivery ? await updateDelivery(delivery.id, formData) : await createDelivery(formData);
      if (res.error) {
        await toastError(res.error);
        return;
      }
      modalRef.current?.close();
      if (!delivery) {
        form.reset();
        setContractId("");
        setDate(null);
        setPeriod("");
        setPeriodTouched(false);
        setAmount("");
        setPenalty("");
        setPenaltyTouched(false);
      }
      onSaved();
      if (delivery || !res.id) {
        await toastSuccess(delivery ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "บันทึกการส่งมอบเรียบร้อยแล้ว");
        return;
      }
      // ส่งมอบใหม่ — ถามต่อว่าจะทำบันทึกขออนุมัติ (เบิกจ่าย) เลยไหม ถ้าตกลงเปิดฟอร์มที่กรอกข้อมูลจากสัญญา/งวดนี้ไว้ให้
      const goApproval = await confirmWarning({
        title: "บันทึกการส่งมอบเรียบร้อยแล้ว",
        text: "ต้องการทำบันทึกขออนุมัติต่อเลยไหม? ระบบจะกรอกข้อมูลจากสัญญาและงวดนี้ไว้ให้",
        confirmButtonText: "ทำบันทึกขออนุมัติ",
      });
      if (goApproval) router.push(`/approvals/new?delivery=${res.id}`);
    } finally {
      setSaving(false);
    }
  }

  const groups: [string, Contract[]][] = [
    ["สัญญาจ้าง", contracts.filter((c) => c.contract_type === "จ้าง")],
    ["สัญญาซื้อ", contracts.filter((c) => c.contract_type === "ซื้อ")],
  ];

  return (
    <Modal
      ref={modalRef}
      title={delivery ? "แก้ไขการส่งมอบ" : "บันทึกการส่งมอบใหม่"}
      wide
      lazy
      trigger={
        delivery ? (
          <span className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
            แก้ไข
          </span>
        ) : (
          <span className="btn-gold inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกการส่งมอบ
          </span>
        )
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">
            สัญญา <span className="text-red-600">*</span>
          </label>
          <select name="contract_id" value={contractId} onChange={(e) => selectContract(e.target.value)} required className="input w-full">
            <option value="" disabled>
              -- เลือกสัญญา --
            </option>
            {groups.map(([label, list]) =>
              list.length ? (
                <optgroup key={label} label={label}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_no} : {c.vendor_name}
                    </option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
        </div>

        {contract && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-3 text-sm sm:col-span-2 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">ตามสัญญา</p>
              <p className="font-semibold">{formatBaht(Number(contract.amount))}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ส่งมอบงวดอื่นแล้ว</p>
              <p className="font-semibold">{formatBaht(deliveredOthers)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">คงเหลือ</p>
              <p className="font-semibold text-emerald-700">{formatBaht(remaining)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">กำหนดส่งมอบ</p>
              <p className="font-semibold">{contract.end_date ? formatThaiDate(contract.end_date) : "ไม่ระบุ"}</p>
            </div>
          </div>
        )}

        <div>
          <label className="label">งวดที่</label>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            name="installment_no"
            key={`inst-${contractId}`}
            defaultValue={delivery?.installment_no ?? (contractId ? others.length + 1 : "")}
            className="input w-full"
          />
        </div>
        <div>
          <label className="label">
            วันที่ส่งมอบ <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker name="delivery_date" value={date} onChange={setDate} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">งวดเดือน</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={pMonth || ""}
              onChange={(e) => changePeriod(pYear || new Date().getFullYear(), Number(e.target.value))}
              aria-label="เดือนของงวด"
              className="input w-full"
            >
              <option value="" disabled>
                -- เดือน --
              </option>
              {THAI_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={pYear || ""}
              onChange={(e) => changePeriod(Number(e.target.value), pMonth || new Date().getMonth() + 1)}
              aria-label="ปี พ.ศ. ของงวด"
              className="input w-full"
            >
              <option value="" disabled>
                -- ปี พ.ศ. --
              </option>
              {yearChoices.map((y) => (
                <option key={y} value={y}>
                  {y + 543}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1 text-xs text-slate-500">ตั้งตามวันที่ส่งมอบให้อัตโนมัติ — เปลี่ยนได้ เช่น ส่งมอบ 1 พ.ย. สำหรับงวดเดือน ต.ค.</p>
        </div>
        <div>
          <label className="label">
            จำนวนเงินที่ส่งมอบ (บาท) <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="input w-full text-right font-semibold"
          />
        </div>
        <div>
          <label className="label">ผู้ตรวจรับ</label>
          <input
            name="inspector_name"
            key={`insp-${contractId}`}
            defaultValue={delivery?.inspector_name ?? contract?.inspector_name ?? ""}
            list="delivery-teacher-names"
            autoComplete="off"
            className="input w-full"
          />
          <datalist id="delivery-teacher-names">
            {teachers.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">ส่งมอบเกินกำหนด (วัน)</label>
          <input readOnly value={contract && date ? lateDays : ""} className="input w-full bg-slate-50 text-right" />
        </div>
        <div>
          <label className="label">ค่าปรับ (บาท)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={penaltyValue}
            onChange={(e) => {
              setPenaltyTouched(true);
              setPenalty(e.target.value);
            }}
            className="input w-full text-right"
          />
          {lateDays > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {contract?.penalty_rate
                ? `คำนวณ: ร้อยละ ${contract.penalty_rate} ต่อวัน × ${lateDays} วัน = ${formatBaht(suggested)} บาท`
                : "สัญญานี้ไม่ได้ระบุอัตราค่าปรับ กรอกเองได้"}
            </p>
          )}
        </div>
        <div>
          <label className="label">หักภาษี ณ ที่จ่าย (บาท)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            name="withholding_tax"
            defaultValue={delivery?.withholding_tax ?? ""}
            placeholder="ไม่มี"
            className="input w-full text-right"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">หมายเหตุ</label>
          <textarea name="note" defaultValue={delivery?.note ?? ""} rows={2} className="input w-full" />
        </div>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <button type="button" onClick={() => modalRef.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? "กำลังบันทึก..." : delivery ? "บันทึกการแก้ไข" : "บันทึกการส่งมอบ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContractDeliveryPage() {
  const { isAdmin, isProcStaff } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // งวดที่ทำบันทึกขออนุมัติแล้ว → เลขที่บันทึก (งวดละครั้งเดียว)
  const [approvalByDelivery, setApprovalByDelivery] = useState<Map<string, string>>(new Map());
  const reload = useCallback(async () => {
    const supabase = createClient();
    const [{ data: d, error }, { data: c }, { data: t }, { data: ap }] = await Promise.all([
      supabase
        .from("proc_deliveries")
        .select("id, contract_id, installment_no, delivery_date, period_month, amount, late_days, penalty_amount, withholding_tax, inspector_name, note")
        .order("delivery_date", { ascending: false }),
      supabase
        .from("proc_contracts")
        .select("id, contract_type, contract_no, vendor_name, amount, end_date, penalty_rate, inspector_name")
        .in("contract_type", ["จ้าง", "ซื้อ"])
        .order("contract_date", { ascending: false }),
      supabase.from("plan_teachers").select("name").eq("is_active", true).order("sort_order"),
      supabase.from("proc_approvals").select("delivery_id, doc_number").not("delivery_id", "is", null),
    ]);
    setApprovalByDelivery(new Map((ap ?? []).map((a) => [a.delivery_id as string, a.doc_number ?? "-"])));
    setError(error?.message ?? null);
    setDeliveries((d as Delivery[]) ?? []);
    setContracts((c as Contract[]) ?? []);
    setTeachers((t ?? []).map((x) => x.name));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const contractById = useMemo(() => new Map(contracts.map((c) => [c.id, c])), [contracts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (deliveries ?? []).filter((d) => {
      if (!q) return true;
      const c = contractById.get(d.contract_id);
      return [c?.contract_no, c?.vendor_name, d.inspector_name].some((v) => v?.toLowerCase().includes(q));
    });
  }, [deliveries, query, contractById]);
  const total = filtered.reduce((s, d) => s + Number(d.amount), 0);

  async function handleDelete(d: Delivery) {
    const c = contractById.get(d.contract_id);
    const ok = await confirmDelete({ title: "ลบการส่งมอบนี้?", text: `${c?.contract_no ?? ""} งวดที่ ${d.installment_no ?? "-"}` });
    if (!ok) return;
    const res = await deleteDelivery(d.id);
    if (res.error) {
      await toastError(res.error);
      return;
    }
    await toastSuccess("ลบเรียบร้อยแล้ว");
    reload();
  }

  function actions(d: Delivery) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <DeliveryDetailModal delivery={d} contract={contractById.get(d.contract_id)} deliveries={deliveries ?? []} />
        <a href={`/contracts/delivery/${d.id}/pdf`} target="_blank" rel="noopener" className="btn-secondary btn-sm">
          <PrinterIcon className="h-3.5 w-3.5" />
          พิมพ์เอกสาร
        </a>
        {isProcStaff &&
          (approvalByDelivery.has(d.id) ? (
            <button
              type="button"
              disabled
              title="งวดนี้มีบันทึกขออนุมัติแล้ว"
              className="btn-secondary btn-sm cursor-not-allowed opacity-60"
            >
              มีบันทึกขออนุมัติแล้ว ({approvalByDelivery.get(d.id)})
            </button>
          ) : (
            <Link href={`/approvals/new?delivery=${d.id}`} className="btn-secondary btn-sm">
              สร้างบันทึกขออนุมัติ
            </Link>
          ))}
        {isProcStaff && <DeliveryModal delivery={d} contracts={contracts} deliveries={deliveries ?? []} teachers={teachers} onSaved={reload} />}
        {isAdmin && (
          <button type="button" onClick={() => handleDelete(d)} className="btn-danger btn-sm">
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
          <Link href="/contracts" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            งานสัญญา
          </Link>
          <h1 className="page-title">ส่งมอบตามสัญญา</h1>
          <p className="page-subtitle">บันทึกการส่งมอบและตรวจรับตามสัญญาจ้าง/สัญญาซื้อ</p>
        </div>
        {isProcStaff && <DeliveryModal delivery={null} contracts={contracts} deliveries={deliveries ?? []} teachers={teachers} onSaved={reload} />}
      </div>

      {deliveries === null ? (
        <PageLoadingSkeleton />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาเลขที่สัญญา คู่สัญญา ผู้ตรวจรับ" className="input w-full pl-9" />
            </div>
            <p className="text-sm text-slate-500">
              {filtered.length} รายการ · รวม <span className="font-semibold text-slate-800">{formatBaht(total)}</span> บาท
            </p>
          </div>

          <div className="table-shell @container">
            {error && <p className="p-4 text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
            <div className="divide-y divide-slate-100 @min-[56rem]:hidden">
              {filtered.map((d) => {
                const c = contractById.get(d.contract_id);
                return (
                  <div key={d.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {c && <span className="badge-navy">สัญญา{c.contract_type}</span>}
                      <span className="font-medium text-slate-900">{c?.contract_no ?? "-"}</span>
                      <span className="text-sm text-slate-500">
                        งวดที่ {d.installment_no ?? "-"} · {formatPeriod(d.period_month)}
                      </span>
                      {(d.late_days ?? 0) > 0 && <span className="badge-red">เกินกำหนด {d.late_days} วัน</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-700">{c?.vendor_name}</p>
                    <p className="text-xs text-slate-500">
                      ส่งมอบ {formatThaiDate(d.delivery_date)}
                      {d.inspector_name ? ` · ผู้ตรวจรับ ${d.inspector_name}` : ""}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatBaht(Number(d.amount))} บาท
                      {d.penalty_amount ? <span className="ml-2 font-normal text-red-600">ค่าปรับ {formatBaht(Number(d.penalty_amount))}</span> : null}
                    </p>
                    <div className="mt-2">{actions(d)}</div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="table-empty">{query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีการส่งมอบ"}</p>}
            </div>

            <table className="hidden table-base w-full min-w-0 @min-[56rem]:table [&_td]:px-3 [&_th]:px-3">
              <thead>
                <tr>
                  <th>สัญญา</th>
                  <th>งวด</th>
                  <th>วันที่ส่งมอบ</th>
                  <th>ผู้ตรวจรับ</th>
                  <th className="text-right">จำนวนเงิน</th>
                  <th className="text-right">ค่าปรับ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const c = contractById.get(d.contract_id);
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="font-medium text-slate-900">{c?.contract_no ?? "-"}</div>
                        <div className="text-slate-500">{c?.vendor_name}</div>
                      </td>
                      <td>
                        <div>งวดที่ {d.installment_no ?? "-"}</div>
                        <div className="text-slate-500">{formatPeriod(d.period_month)}</div>
                      </td>
                      <td>
                        <div>{formatThaiDate(d.delivery_date)}</div>
                        {(d.late_days ?? 0) > 0 && <span className="badge-red text-sm">เกินกำหนด {d.late_days} วัน</span>}
                      </td>
                      <td>{d.inspector_name ?? "-"}</td>
                      <td className="text-right font-semibold text-slate-900">{formatBaht(Number(d.amount))}</td>
                      <td className="text-right text-red-600">{d.penalty_amount ? formatBaht(Number(d.penalty_amount)) : "-"}</td>
                      <td className="text-right">{actions(d)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      {query ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีการส่งมอบ"}
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
