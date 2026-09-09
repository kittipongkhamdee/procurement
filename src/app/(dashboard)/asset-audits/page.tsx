"use client";

// หน้า "ตรวจสอบพัสดุประจำปี" (ระเบียบกระทรวงการคลังฯ ข้อ 213) — แยกเป็นหน้าใหม่ ไม่ใช่แท็บใน
// /asset-register เพราะเป็นกระบวนการคนละชุดสิทธิ์ (ผู้ตรวจสอบที่ได้รับแต่งตั้งอาจเป็นครู ไม่ใช่
// เจ้าหน้าที่พัสดุ) — RLS (asset_audit_rounds_select) กรองให้อัตโนมัติอยู่แล้ว: staff เห็นทุกรอบ
// ส่วนผู้ตรวจสอบเห็นเฉพาะรอบที่ตนได้รับแต่งตั้ง จึงดึงข้อมูลมาแสดงตรงๆ ได้เลยไม่ต้องกรองเพิ่มฝั่งนี้

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { PlusIcon } from "@/components/icons";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { formatThaiDate } from "@/lib/thai";
import { createAuditRound } from "./actions";

type AuditRound = {
  id: string;
  fiscal_year: number;
  start_date: string;
  due_date: string;
  status: string;
};

type Profile = { user_id: string; full_name: string; role: string };

function statusBadge(status: string) {
  if (status === "submitted") return { cls: "badge-amber", label: "ส่งรายงานแล้ว" };
  if (status === "acknowledged") return { cls: "badge-emerald", label: "รับทราบผลแล้ว" };
  if (status === "in_progress") return { cls: "badge-slate", label: "กำลังตรวจนับ" };
  return { cls: "badge-slate", label: "แบบร่าง" };
}

// พ.ศ. ของปีงบประมาณเริ่ม 1 ต.ค. ของปีก่อนหน้า (ปีงบ 2569 เริ่ม 1 ต.ค. 2568) แปลงเป็น ค.ศ. ลบ 544
function fiscalYearStartIso(fiscalYearBE: number): string {
  const adYear = fiscalYearBE - 544;
  return `${adYear}-10-01`;
}

// +30 วันทำการ (เว้นเสาร์-อาทิตย์ ไม่หักวันหยุดราชการ — ผู้ใช้ปรับแก้เองได้ในฟอร์ม)
function addBusinessDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function CreateAuditRoundModal({ profiles, onCreated }: { profiles: Profile[]; onCreated: () => void }) {
  const router = useRouter();
  const modalRef = useRef<ModalHandle>(null);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() + 543 + 1);
  const [startDate, setStartDate] = useState(fiscalYearStartIso(new Date().getFullYear() + 543 + 1));
  const [dueDate, setDueDate] = useState(addBusinessDays(fiscalYearStartIso(new Date().getFullYear() + 543 + 1), 30));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function handleFiscalYearChange(value: number) {
    setFiscalYear(value);
    const start = fiscalYearStartIso(value);
    setStartDate(start);
    setDueDate(addBusinessDays(start, 30));
  }

  function toggleInspector(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("start_date", startDate);
      formData.set("due_date", dueDate);
      for (const id of selectedIds) {
        const profile = profiles.find((p) => p.user_id === id);
        formData.append("inspector_user_id", id);
        formData.append("inspector_full_name", profile?.full_name ?? "");
      }
      const roundId = await createAuditRound(formData);
      await toastSuccess("เริ่มรอบตรวจสอบพัสดุประจำปีเรียบร้อยแล้ว");
      modalRef.current?.close();
      onCreated();
      router.push(`/asset-audits/${roundId}`);
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      ref={modalRef}
      trigger={
        <>
          <PlusIcon className="h-4 w-4" />
          เริ่มรอบตรวจสอบใหม่
        </>
      }
      triggerClassName="btn-primary"
      title="เริ่มรอบตรวจสอบพัสดุประจำปี"
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">ปีงบประมาณ (พ.ศ.)</label>
            <input
              type="number"
              value={fiscalYear}
              onChange={(e) => handleFiscalYearChange(Number(e.target.value))}
              required
              className="input"
            />
          </div>
          <div>
            <label className="label">เลขที่คำสั่งแต่งตั้งผู้ตรวจสอบ</label>
            <input name="appointment_doc_ref" placeholder="เลขที่คำสั่ง" className="input" />
          </div>
          <div>
            <label className="label">วันที่คำสั่ง</label>
            <ThaiDatePicker name="appointment_date" defaultValue={null} />
          </div>
          <div>
            <label className="label">วันเริ่มตรวจสอบ</label>
            <ThaiDatePicker value={startDate} onChange={(v) => setStartDate(v ?? startDate)} required />
          </div>
          <div>
            <label className="label">วันครบกำหนดส่งรายงาน (30 วันทำการ)</label>
            <ThaiDatePicker value={dueDate} onChange={(v) => setDueDate(v ?? dueDate)} required />
          </div>
        </div>

        <div>
          <label className="label">
            ผู้ตรวจสอบพัสดุ (ตามระเบียบควรไม่ใช่เจ้าหน้าที่พัสดุ — เลือกได้มากกว่า 1 คน)
          </label>
          <div className="table-shell max-h-64 overflow-y-auto">
            <table className="table-base">
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.user_id}>
                    <td className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.user_id)}
                        onChange={() => toggleInspector(p.user_id)}
                        aria-label={`เลือก ${p.full_name} เป็นผู้ตรวจสอบ`}
                      />
                    </td>
                    <td>{p.full_name}</td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td className="table-empty">ไม่มีข้อมูลผู้ใช้</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "กำลังบันทึก..." : "เริ่มรอบตรวจสอบ"}
        </button>
      </form>
    </Modal>
  );
}

export default function AssetAuditsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const canManage = isAdmin || user?.role === "supply_officer";
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<AuditRound[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: roundsData }, { data: profilesData }] = await Promise.all([
      supabase
        .from("asset_audit_rounds")
        .select("id, fiscal_year, start_date, due_date, status")
        .order("fiscal_year", { ascending: false }),
      canManage
        ? supabase.from("proc_profiles").select("user_id, full_name, role").eq("status", "approved").order("full_name")
        : Promise.resolve({ data: [] }),
    ]);
    setRounds(roundsData ?? []);
    setProfiles(profilesData ?? []);
    setLoading(false);
  }, [canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  if (authLoading || loading) return <PageLoadingSkeleton />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ตรวจสอบพัสดุประจำปี</h1>
          <p className="page-subtitle">
            ตรวจสอบพัสดุประจำปีตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ
            พ.ศ. 2560 ข้อ 213
          </p>
        </div>
        {canManage && <CreateAuditRoundModal profiles={profiles} onCreated={reload} />}
      </div>

      <div className="table-shell mt-4">
        <table className="table-base">
          <thead>
            <tr>
              <th className="whitespace-nowrap">ปีงบประมาณ</th>
              <th className="whitespace-nowrap">วันเริ่มตรวจ</th>
              <th className="whitespace-nowrap">วันครบกำหนด</th>
              <th className="text-center">สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const sb = statusBadge(r.status);
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">{r.fiscal_year}</td>
                  <td className="whitespace-nowrap">{formatThaiDate(r.start_date)}</td>
                  <td className="whitespace-nowrap">{formatThaiDate(r.due_date)}</td>
                  <td className="text-center">
                    <span className={sb.cls}>{sb.label}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/asset-audits/${r.id}`} className="btn-secondary btn-sm">
                      เปิดรอบตรวจสอบ
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rounds.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  ยังไม่มีรอบตรวจสอบพัสดุ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
