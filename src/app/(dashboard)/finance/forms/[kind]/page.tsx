"use client";

// ใบสำคัญรับเงิน (นักเรียน) / แบบ 8708 — รายการที่บันทึกไว้ + ฟอร์มสร้าง/แก้ไข
// ครูทุกคนสร้างได้ แก้/ลบได้เฉพาะของตัวเอง (เจ้าหน้าที่การเงิน/แอดมินแก้ได้ทุกฉบับ — ตรงกับ RLS fin_receipt_forms)

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { confirmDelete, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import type { StudentReceipt } from "@/lib/pdf/receipt-forms-document";
import type { TravelClaim } from "@/lib/travel-claim";
import { TravelForm } from "../travel-form";
import { StudentForm, type FormDefaults } from "../receipt-forms";
import { deleteReceiptForm } from "../form-store";

const TITLES = {
  student: "ใบสำคัญรับเงินค่าใช้จ่ายในการจัดกิจกรรมสำหรับนักเรียน",
  travel: "รายงานการเดินทางไปราชการ (แบบ 8708)",
} as const;
const SUBTITLE = { student: "เอกสารแนบ ๒", travel: "ใบเบิกค่าใช้จ่ายในการเดินทางไปราชการ (ส่วนที่ 1) + หลักฐานการจ่ายเงิน (ส่วนที่ 2)" } as const;
type Kind = keyof typeof TITLES;
type Saved = { id: string; title: string; data: StudentReceipt | TravelClaim; created_by: string | null; updated_at: string; loan_id?: string | null };

export default function ReceiptKindPage() {
  const kind = useParams<{ kind: string }>().kind as Kind;
  const { role, user } = useAuth();
  const canAll = role === "admin" || role === "finance_officer";
  const [list, setList] = useState<Saved[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [defaults, setDefaults] = useState<FormDefaults>({ school: "", area: "", officer: "", director: "" });
  // null = ไม่เปิดฟอร์ม, "new" = สร้างใหม่, อื่นๆ = id ที่แก้
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  // เปิดจากสัญญายืมเงิน (?loan=<id>): มีแบบ 8708 ที่ผูกสัญญานี้แล้ว → เปิดแก้ฉบับนั้น, ยังไม่มี → สร้างใหม่ผูกสัญญา
  const [linkLoan, setLinkLoan] = useState<string | null>(null);
  const [loanHandled, setLoanHandled] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    // รายงานการเดินทางไปราชการเก็บแยกตาราง fin_travel_forms (สิทธิ์แบบเดียวกัน)
    const { data } =
      kind === "travel"
        ? await supabase.from("fin_travel_forms").select("id, title, data, created_by, updated_at, loan_id").order("updated_at", { ascending: false })
        : await supabase.from("fin_receipt_forms").select("id, title, data, created_by, updated_at").eq("kind", kind).order("updated_at", { ascending: false });
    const rows = (data ?? []) as unknown as Saved[];
    setList(rows);
    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((x): x is string => !!x)));
    if (ids.length) {
      const { data: prof } = await supabase.from("proc_profiles").select("user_id, full_name").in("user_id", ids);
      setNames(new Map((prof ?? []).map((p) => [p.user_id, p.full_name ?? ""])));
    }
  }, [kind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    const supabase = createClient();
    Promise.all([
      supabase.from("proc_school_settings").select("school_name, education_area").eq("id", true).maybeSingle(),
      supabase.from("fin_settings").select("key, value").eq("key", "fin_officer_name"),
      supabase.from("proc_app_settings").select("key, value").in("key", ["approval_signer_finance", "approval_signer_director"]),
    ]).then(([s, f, a]) => {
      const app = new Map((a.data ?? []).map((r) => [r.key, r.value ?? ""]));
      setDefaults({ school: s.data?.school_name ?? "", area: s.data?.education_area ?? "", officer: f.data?.[0]?.value || app.get("approval_signer_finance") || "", director: app.get("approval_signer_director") || "" });
    });
  }, [reload]);

  useEffect(() => {
    if (list === null || loanHandled || kind !== "travel") return;
    const loan = new URLSearchParams(window.location.search).get("loan");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoanHandled(true);
    if (!loan) return;
    const hit = list.find((r) => r.loan_id === loan);
    setLinkLoan(hit ? null : loan);
    setEditing(hit ? hit.id : "new");
    setFormKey((k) => k + 1);
  }, [list, loanHandled, kind]);

  if (!(kind in TITLES)) notFound();
  if (list === null) return <PageLoadingSkeleton />;
  const current = editing && editing !== "new" ? list.find((x) => x.id === editing) ?? null : null;
  const canEdit = (r: Saved) => canAll || (!!user && r.created_by === user.userId);

  function open(id: string) {
    setLinkLoan(null);
    setEditing(id);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remove(r: Saved) {
    if (!(await confirmDelete({ title: "ลบใบสำคัญรับเงินนี้?", text: r.title || "(ไม่มีชื่อ)" }))) return;
    const res = await deleteReceiptForm(r.id, kind);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    if (editing === r.id) setEditing(null);
    reload();
  }

  const formProps = {
    id: current?.id ?? null,
    defaults,
    onSaved: (id: string) => {
      setEditing(id);
      reload();
    },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/finance/forms" className="back-link mb-2">
            <ChevronLeftIcon className="h-4 w-4" />
            แบบฟอร์มการเงิน
          </Link>
          <h1 className="page-title">{TITLES[kind]}</h1>
          <p className="page-subtitle">{SUBTITLE[kind]} — บันทึกไว้แก้ไข/พิมพ์ซ้ำได้ · ช่องที่เว้นว่างพิมพ์เป็นจุดไข่ปลาให้เขียนเอง</p>
        </div>
        {editing === null && (
          <button type="button" onClick={() => open("new")} className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            สร้างใหม่
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">{current ? `แก้ไข: ${current.title || "(ไม่มีชื่อ)"}` : "สร้างใหม่"}</h2>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary btn-sm">
              ปิดฟอร์ม
            </button>
          </div>
          {current && !canEdit(current) && <p className="mb-2 text-sm text-amber-700">ฉบับนี้เป็นของผู้อื่น — พิมพ์ได้ แต่บันทึกการแก้ไขไม่ได้</p>}
          {kind === "travel" ? (
            <TravelForm key={`${formKey}-${defaults.school}`} initial={(current?.data as TravelClaim) ?? null} loanId={current ? current.loan_id ?? null : linkLoan} {...formProps} />
          ) : (
            <StudentForm key={`${formKey}-${defaults.school}`} initial={(current?.data as StudentReceipt) ?? null} {...formProps} />
          )}
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? (
          <div className="table-empty">ยังไม่มีฉบับที่บันทึกไว้ — กด &quot;สร้างใหม่&quot;</div>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>ผู้สร้าง</th>
                <th>แก้ไขล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  <td className="text-slate-900">{r.title || <span className="text-slate-400">(ไม่มีชื่อ)</span>}</td>
                  <td>{(r.created_by && names.get(r.created_by)) || "-"}</td>
                  <td className="whitespace-nowrap">{new Date(r.updated_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}</td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => open(r.id)} className="btn-secondary btn-sm" title={canEdit(r) ? "แก้ไข/พิมพ์" : "เปิดดู/พิมพ์"}>
                        <PencilIcon className="h-3.5 w-3.5" />
                        {canEdit(r) ? "แก้ไข/พิมพ์" : "เปิด/พิมพ์"}
                      </button>
                      {canEdit(r) && (
                        <button type="button" onClick={() => remove(r)} className="btn-danger btn-sm" title="ลบ">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
