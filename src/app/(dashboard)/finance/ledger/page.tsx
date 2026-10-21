"use client";

// บัญชีรับ-จ่ายเงิน — แทนไฟล์ Excel "โปรแกรมการเงินโรงเรียน" (ชีต DATA / คงเหลือประจำวัน / ทะเบียนคุมรายเดือน / ใบสำคัญคู่จ่าย / สรุปงบโครงการ)
// เจ้าหน้าที่การเงิน (และแอดมิน) บันทึก/แก้ไข — ผอ. และครูดูอย่างเดียว (RLS fin_can_write)

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/AuthContext";
import { formatThaiDate } from "@/lib/thai";
import { confirmDelete, toastError, toastSuccess } from "@/lib/swal";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { ChevronLeftIcon, CoinsIcon, FileTextIcon, FolderIcon, PrinterIcon, SearchIcon, SettingsIcon, TrashIcon } from "@/components/icons";
import { HubCardGrid, type HubCard } from "@/components/hub-cards";
import {
  balancesByType,
  docLabel,
  fiscalMonths,
  fiscalYearOf,
  groupByCategory,
  KIND_LABEL,
  POCKET_SHORT,
  sortTxns,
  thaiMonthLabel,
  total,
  zero,
  addBal,
  type Balance,
  type FinTxn,
  type MoneyType,
  type Opening,
} from "@/lib/finance-ledger";
import { loadProjectSpending, projectBudget } from "@/lib/project-spending";
import { deleteTxn } from "./actions";
import { TxnForm, type ProjectOption } from "./txn-form";

// หน้ารวมเป็นการ์ด (แบบเดียวกับงานสัญญา) — กดการ์ดเปิดส่วนนั้นด้วย ?view= (ปีงบที่เลือกคงอยู่เพราะเป็นหน้าเดิม)
type Tab = "txns" | "balance" | "projects" | "reports";
const TABS: { key: Tab; label: string }[] = [
  { key: "txns", label: "รายการรับ-จ่าย" },
  { key: "balance", label: "ยอดคงเหลือ" },
  { key: "projects", label: "งบโครงการ" },
  { key: "reports", label: "พิมพ์รายงาน" },
];
const ICON = "h-6 w-6";

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// งบ/อนุมัติแล้ว/จ่ายจริง ตามนิยามเดียวกับเมนูโครงการและแดชบอร์ด (src/lib/project-spending.ts) — คงเหลือ = งบ − อนุมัติแล้ว
type Spend = { budget: number; approved: number; paid: number };
type ProjectRow = Omit<ProjectOption, "activities"> & Spend & { activities: ({ id: string; name: string } & Spend)[] };

export default function LedgerPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <LedgerContent />
    </Suspense>
  );
}

function LedgerContent() {
  const { role } = useAuth();
  const view = useSearchParams().get("view");
  const tab = TABS.find((x) => x.key === view)?.key ?? null;
  const canWrite = role === "admin" || role === "finance_officer";
  const [fy, setFy] = useState<number>(fiscalYearOf(todayLocal()));
  const [years, setYears] = useState<number[]>([]);
  const [types, setTypes] = useState<MoneyType[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [txns, setTxns] = useState<FinTxn[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [month, setMonth] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [asOf, setAsOf] = useState<string | null>(todayLocal());

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: by } = await supabase.from("plan_budget_years").select("id, year, is_open").order("year", { ascending: false });
    const yearRow = by?.find((y) => y.year === fy);
    setYears(Array.from(new Set([fiscalYearOf(todayLocal()), ...(by ?? []).map((y) => y.year)])).sort((a, b) => b - a));
    const [{ data: mt }, { data: op }, { data: tx }, { data: pj }] = await Promise.all([
      supabase.from("fin_money_types").select("id, name, category, account_id, sort_order, is_active").order("sort_order"),
      supabase.from("fin_opening_balances").select("fiscal_year, money_type_id, cash, bank, gov").eq("fiscal_year", fy),
      supabase.from("fin_transactions").select("*").eq("fiscal_year", fy).order("txn_date").order("created_at"),
      yearRow
        ? supabase.from("plan_projects").select("id, name, budget, sort_order, plan_activities(id, name, budget, sort_order)").eq("budget_year_id", yearRow.id).order("sort_order")
        : Promise.resolve({ data: [] }),
    ]);
    setTypes((mt ?? []) as MoneyType[]);
    setOpenings(((op ?? []) as Opening[]).map((o) => ({ ...o, cash: Number(o.cash), bank: Number(o.bank), gov: Number(o.gov) })));
    setTxns(((tx ?? []) as unknown as FinTxn[]).map((t) => ({ ...t, amount: Number(t.amount) })));
    const pjRows = (pj ?? []) as unknown as { id: string; name: string; budget: number | null; plan_activities: { id: string; name: string; budget: number | null; sort_order: number }[] }[];
    const spend = await loadProjectSpending(supabase, pjRows.map((p) => p.id));
    setProjects(
      pjRows.map((p) => ({
        id: p.id,
        name: p.name,
        budget: projectBudget(p.budget, p.plan_activities),
        approved: spend.byProject.get(p.id)?.approved ?? 0,
        paid: spend.byProject.get(p.id)?.paid ?? 0,
        activities: [...(p.plan_activities ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((a) => ({ id: a.id, name: a.name, budget: Number(a.budget ?? 0), approved: spend.approvedForActivity(p.id, a.name), paid: spend.paidByActivity.get(a.id) ?? 0 })),
      })),
    );
  }, [fy]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const typeName = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const activityName = useMemo(() => new Map(projects.flatMap((p) => p.activities.map((a) => [a.id, a.name] as const))), [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortTxns(txns ?? [])
      .filter((t) => (!month || t.txn_date.startsWith(month)) && (!typeFilter || t.money_type_id === typeFilter))
      .filter((t) => !q || [t.description, t.payee, docLabel(t), t.note].some((v) => v?.toLowerCase().includes(q)))
      .reverse();
  }, [txns, month, typeFilter, query]);

  const balances = useMemo(() => balancesByType(openings, txns ?? [], asOf ?? undefined), [openings, txns, asOf]);
  // ยอดวันนี้สำหรับการ์ดหน้ารวม (แท็บยอดคงเหลือเลือกวันที่เองได้)
  const grand = useMemo(() => [...balancesByType(openings, txns ?? [], todayLocal()).values()].reduce((s, b) => addBal(s, b), zero()), [openings, txns]);
  const projectTotals = useMemo(
    () => ({
      budget: projects.reduce((s, p) => s + p.budget, 0),
      approved: projects.reduce((s, p) => s + p.approved, 0),
      paid: projects.reduce((s, p) => s + p.paid, 0),
    }),
    [projects],
  );
  const yearTotals = useMemo(() => {
    const list = txns ?? [];
    return {
      receive: list.filter((t) => t.kind === "receive").reduce((s, t) => s + t.amount, 0),
      pay: list.filter((t) => t.kind === "pay").reduce((s, t) => s + t.amount, 0),
    };
  }, [txns]);

  async function remove(t: FinTxn) {
    if (!(await confirmDelete({ title: "ลบรายการนี้?", text: `${docLabel(t)} ${t.description}` }))) return;
    const res = await deleteTxn(t.id);
    if (res.error) return void (await toastError(res.error));
    await toastSuccess("ลบแล้ว");
    reload();
  }

  if (txns === null) return <PageLoadingSkeleton />;
  const noOpening = openings.length === 0;

  return (
    <div>
      <div className="page-header">
        <div>
          {tab && (
            <Link href="/finance/ledger" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-800">
              <ChevronLeftIcon className="h-4 w-4" />
              บัญชีรับ-จ่ายเงิน
            </Link>
          )}
          <h1 className="page-title">{tab ? TABS.find((x) => x.key === tab)!.label : "บัญชีรับ-จ่ายเงิน"}</h1>
          <p className="page-subtitle">
            {tab ? `ปีงบประมาณ ${fy}` : "บันทึกรับ-จ่ายแยกประเภทเงิน · รายงานเงินคงเหลือประจำวัน · ทะเบียนคุมเงิน · ทะเบียนคุมใบสำคัญคู่จ่าย"}
            {canWrite ? "" : " — ดูได้อย่างเดียว (เจ้าหน้าที่การเงินเป็นผู้บันทึก)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={fy} onChange={(e) => setFy(Number(e.target.value))} className="input w-auto" aria-label="ปีงบประมาณ">
            {years.map((y) => (
              <option key={y} value={y}>
                ปีงบประมาณ {y}
              </option>
            ))}
          </select>
          {canWrite && (
            <Link href="/finance/ledger/settings" className="btn-secondary inline-flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              ตั้งค่า
            </Link>
          )}
          {canWrite && <TxnForm types={types} projects={projects} onSaved={reload} />}
        </div>
      </div>

      {canWrite && noOpening && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ยังไม่ได้บันทึกยอดยกมาของปีงบประมาณ {fy} — ตั้งได้ที่{" "}
          <Link href="/finance/ledger/settings" className="font-semibold underline">
            ตั้งค่า → ยอดยกมา
          </Link>{" "}
          (ถ้าเริ่มปีใหม่ทั้งหมด ยอดยกมาเป็น 0 ได้)
        </p>
      )}

      {!tab && (
        <HubCardGrid
          cards={[
            {
              key: "txns",
              title: "รายการรับ-จ่าย",
              description: "บันทึก ค้นหา และแก้ไขรายการรับ-จ่ายแยกประเภทเงิน (บร. / บค. / บจ.)",
              href: "/finance/ledger?view=txns",
              icon: <FileTextIcon className={ICON} />,
              value: txns.length.toLocaleString("th-TH"),
              sub: `รายการ · รับ ${baht(yearTotals.receive)} · จ่าย ${baht(yearTotals.pay)} บาท`,
            },
            {
              key: "balance",
              title: "ยอดคงเหลือ",
              description: "ยอดเงินแยกประเภทเงิน ณ วันที่เลือก — เงินสด / เงินฝากธนาคาร / เงินฝากส่วนราชการ",
              href: "/finance/ledger?view=balance",
              icon: <CoinsIcon className={ICON} />,
              value: `${baht(total(grand))} บาท`,
              sub: `วันนี้ · เงินสด ${baht(grand.cash)} · ธนาคาร ${baht(grand.bank)} · ส่วนราชการ ${baht(grand.gov)}`,
            },
            {
              key: "projects",
              title: "งบโครงการ",
              description: "งบประมาณ / อนุมัติแล้ว / จ่ายจริง / คงเหลือ รายโครงการและกิจกรรม",
              href: "/finance/ledger?view=projects",
              icon: <FolderIcon className={ICON} />,
              value: projects.length.toLocaleString("th-TH"),
              sub: `โครงการ · งบ ${baht(projectTotals.budget)} · อนุมัติแล้ว ${baht(projectTotals.approved)} · จ่ายจริง ${baht(projectTotals.paid)} บาท`,
            },
            {
              key: "reports",
              title: "พิมพ์รายงาน",
              description: "รายงานเงินคงเหลือประจำวัน · ทะเบียนคุมเงินรายเดือน · ทะเบียนคุมใบสำคัญคู่จ่าย (PDF)",
              href: "/finance/ledger?view=reports",
              icon: <PrinterIcon className={ICON} />,
            },
            ...(canWrite
              ? [
                  {
                    key: "settings",
                    title: "ตั้งค่า",
                    description: "ประเภทเงิน · สมุดบัญชีเงินฝาก · ยอดยกมาต้นปีงบ · ผู้ลงนามรายงาน",
                    href: "/finance/ledger/settings",
                    icon: <SettingsIcon className={ICON} />,
                  } satisfies HubCard,
                ]
              : []),
          ]}
        />
      )}

      {tab === "txns" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหารายการ/เลขที่/ผู้รับ" className="input w-full pl-9" />
            </div>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-auto" aria-label="เดือน">
              <option value="">ทุกเดือน</option>
              {fiscalMonths(fy).map((m) => (
                <option key={m} value={m}>
                  {thaiMonthLabel(m)}
                </option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input w-auto max-w-xs" aria-label="ประเภทเงิน">
              <option value="">ทุกประเภทเงิน</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="card table-empty">ยังไม่มีรายการ{canWrite ? " — กด \"บันทึกรับ-จ่าย\" เพื่อเริ่ม" : ""}</div>
          ) : (
            <>
              {/* มือถือ: การ์ด */}
              <div className="space-y-2 md:hidden">
                {filtered.map((t) => (
                  <div key={t.id} className="card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{t.description}</p>
                        <p className="text-xs text-slate-500">
                          {formatThaiDate(t.txn_date)} · {docLabel(t) || "-"} · {typeName.get(t.money_type_id)}
                        </p>
                      </div>
                      <span className={`shrink-0 font-semibold tabular-nums ${t.kind === "receive" ? "text-emerald-700" : t.kind === "pay" ? "text-red-600" : "text-slate-600"}`}>
                        {t.kind === "pay" ? "-" : t.kind === "receive" ? "+" : ""}
                        {baht(t.amount)}
                      </span>
                    </div>
                    {canWrite && (
                      <div className="mt-2 flex justify-end gap-1">
                        <TxnForm txn={t} types={types} projects={projects} onSaved={reload} />
                        <button type="button" onClick={() => remove(t)} title="ลบ" className="btn-danger btn-sm">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* จอกว้าง: ตาราง */}
              <div className="card hidden overflow-x-auto p-0 md:block">
                <table className="table-base w-full">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>เลขที่</th>
                      <th>รายการ</th>
                      <th>ประเภทเงิน</th>
                      <th className="text-right">รับ</th>
                      <th className="text-right">จ่าย</th>
                      <th>ช่อง</th>
                      {canWrite && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">{formatThaiDate(t.txn_date)}</td>
                        <td className="whitespace-nowrap">{docLabel(t) || "-"}</td>
                        <td>
                          <div className="text-slate-900">{t.description}</div>
                          {(t.payee || t.project_id) && (
                            <div className="text-slate-500">
                              {t.payee}
                              {t.payee && t.project_id ? " · " : ""}
                              {t.project_id && projectName.get(t.project_id)}
                              {t.activity_id && ` / ${activityName.get(t.activity_id) ?? ""}`}
                            </div>
                          )}
                        </td>
                        <td>{typeName.get(t.money_type_id)}</td>
                        <td className="whitespace-nowrap text-right tabular-nums text-emerald-700">{t.kind === "receive" ? baht(t.amount) : ""}</td>
                        <td className="whitespace-nowrap text-right tabular-nums text-red-600">{t.kind === "pay" ? baht(t.amount) : ""}</td>
                        <td className="whitespace-nowrap text-slate-600">
                          {t.kind === "transfer" ? `${POCKET_SHORT[t.from_pocket!]} → ${POCKET_SHORT[t.to_pocket!]} ${baht(t.amount)}` : POCKET_SHORT[(t.kind === "receive" ? t.to_pocket : t.from_pocket)!]}
                        </td>
                        {canWrite && (
                          <td className="whitespace-nowrap text-right">
                            <div className="flex justify-end gap-1">
                              <TxnForm txn={t} types={types} projects={projects} onSaved={reload} />
                              <button type="button" onClick={() => remove(t)} title="ลบ" className="btn-danger btn-sm">
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {tab === "balance" && <BalanceTab types={types} balances={balances} asOf={asOf} setAsOf={setAsOf} />}
      {tab === "projects" && <ProjectsTab projects={projects} />}
      {tab === "reports" && <ReportsTab fy={fy} types={types} />}

      <p className="mt-4 text-xs text-slate-400">ประเภทรายการ: {Object.values(KIND_LABEL).join(" / ")} — โอน/ถอน/ฝาก ย้ายเงินระหว่างเงินสด ธนาคาร และส่วนราชการ ไม่นับเป็นรับ/จ่าย</p>
    </div>
  );
}

function BalanceTab({ types, balances, asOf, setAsOf }: { types: MoneyType[]; balances: Map<string, Balance>; asOf: string | null; setAsOf: (d: string | null) => void }) {
  const groups = groupByCategory(types.filter((t) => t.is_active || total(balances.get(t.id) ?? zero()) !== 0));
  const grand = [...balances.values()].reduce((s, b) => addBal(s, b), zero());
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label className="label">ยอดคงเหลือ ณ สิ้นวันที่</label>
          <ThaiDatePicker value={asOf} onChange={setAsOf} />
        </div>
        {asOf && (
          <a href={`/finance/ledger/daily/pdf?date=${asOf}`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2">
            <PrinterIcon className="h-4 w-4" />
            พิมพ์รายงานเงินคงเหลือประจำวัน
          </a>
        )}
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>ประเภทเงิน</th>
              <th className="text-right">เงินสด</th>
              <th className="text-right">เงินฝากธนาคาร</th>
              <th className="text-right">เงินฝากส่วนราชการ</th>
              <th className="text-right">รวม</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) =>
              g.types.map((t, ti) => {
                const b = balances.get(t.id) ?? zero();
                const showHead = g.types.length > 1 && ti === 0;
                return [
                  showHead && (
                    <tr key={`${g.category}-h`}>
                      <td colSpan={5} className="font-semibold text-slate-700">
                        {gi + 1}. {g.category}
                      </td>
                    </tr>
                  ),
                  <tr key={t.id}>
                    <td className={g.types.length > 1 ? "pl-8" : ""}>{g.types.length > 1 ? t.name : `${gi + 1}. ${t.name}`}</td>
                    <td className="text-right tabular-nums">{baht(b.cash)}</td>
                    <td className="text-right tabular-nums">{baht(b.bank)}</td>
                    <td className="text-right tabular-nums">{baht(b.gov)}</td>
                    <td className="text-right font-semibold tabular-nums">{baht(total(b))}</td>
                  </tr>,
                ];
              }),
            )}
            <tr>
              <td className="font-semibold">รวมทั้งสิ้น</td>
              <td className="text-right font-semibold tabular-nums">{baht(grand.cash)}</td>
              <td className="text-right font-semibold tabular-nums">{baht(grand.bank)}</td>
              <td className="text-right font-semibold tabular-nums">{baht(grand.gov)}</td>
              <td className="text-right font-bold tabular-nums">{baht(total(grand))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: ProjectRow[] }) {
  if (projects.length === 0) return <div className="card table-empty">ยังไม่มีโครงการของปีงบประมาณนี้ (เมนูโครงการ)</div>;
  const pct = (used: number, budget: number) => (budget > 0 ? `${((used / budget) * 100).toFixed(1)}%` : "-");
  const cells = (x: Spend, muted: boolean) => {
    const tone = muted ? "text-slate-600" : "";
    const left = x.budget - x.approved;
    return (
      <>
        <td className={`text-right tabular-nums ${tone}`}>{baht(x.budget)}</td>
        <td className={`text-right tabular-nums ${muted ? "text-slate-600" : "text-emerald-700"}`}>{baht(x.approved)}</td>
        <td className={`text-right tabular-nums ${muted ? "text-slate-600" : "text-sky-700"}`}>{baht(x.paid)}</td>
        <td className={`text-right tabular-nums ${left < 0 ? "text-red-600" : muted ? "text-slate-600" : "font-semibold text-amber-700"}`}>{baht(left)}</td>
        <td className={`text-right tabular-nums ${tone}`}>{pct(x.approved, x.budget)}</td>
      </>
    );
  };
  const sum = projects.reduce((s, p) => ({ budget: s.budget + p.budget, approved: s.approved + p.approved, paid: s.paid + p.paid }), { budget: 0, approved: 0, paid: 0 });
  return (
    <div className="card overflow-x-auto p-0">
      <p className="px-4 pt-3 text-xs text-slate-500">อนุมัติแล้ว = บันทึกขออนุมัติที่ ผอ. อนุมัติ · จ่ายจริง = รายการจ่ายในบัญชีรับ-จ่ายเงิน · คงเหลือ = งบประมาณ − อนุมัติแล้ว (ตัวเลขเดียวกับเมนูโครงการ)</p>
      <table className="table-base w-full">
        <thead>
          <tr>
            <th>โครงการ / กิจกรรม</th>
            <th className="text-right">งบประมาณ</th>
            <th className="text-right">อนุมัติแล้ว</th>
            <th className="text-right">จ่ายจริง</th>
            <th className="text-right">คงเหลือ</th>
            <th className="text-right">ใช้ไป</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => [
            <tr key={p.id}>
              <td className="font-semibold text-slate-900">{p.name}</td>
              {cells(p, false)}
            </tr>,
            ...p.activities.map((a) => (
              <tr key={a.id}>
                <td className="pl-8 text-slate-600">{a.name}</td>
                {cells(a, true)}
              </tr>
            )),
          ])}
          <tr>
            <td className="font-bold">รวมทั้งสิ้น</td>
            {cells(sum, false)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportsTab({ fy, types }: { fy: number; types: MoneyType[] }) {
  const [typeId, setTypeId] = useState("");
  const [month, setMonth] = useState("all");
  const [date, setDate] = useState<string | null>(todayLocal());
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="card">
        <div className="card-title">รายงานเงินคงเหลือประจำวัน</div>
        <p className="mb-3 text-sm text-slate-500">ยอดเงินสด/ธนาคาร/ส่วนราชการ แยกประเภทเงิน พร้อมช่องลงนามเจ้าหน้าที่การเงิน คณะกรรมการเก็บรักษาเงิน และหัวหน้าหน่วยงาน</p>
        <label className="label">ณ วันที่</label>
        <ThaiDatePicker value={date} onChange={setDate} />
        <a href={date ? `/finance/ledger/daily/pdf?date=${date}` : undefined} target="_blank" rel="noreferrer" className="btn-secondary mt-3 inline-flex items-center gap-2">
          <PrinterIcon className="h-4 w-4" />
          พิมพ์ PDF
        </a>
      </div>
      <div className="card">
        <div className="card-title">ทะเบียนคุมเงิน (แยกประเภทเงิน)</div>
        <p className="mb-3 text-sm text-slate-500">ยอดยกมา · รับ · จ่าย · คงเหลือ (เงินสด/ธนาคาร/ส่วนราชการ) · รวมตั้งแต่ต้นเดือน/ต้นปี · ยอดยกไป</p>
        <label className="label">ประเภทเงิน</label>
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="input mb-2 w-full">
          <option value="">ทุกประเภท (แยกหน้า)</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="label">เดือน</label>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-full">
          <option value="all">ทั้งปีงบประมาณ {fy} (เดือนละหน้า)</option>
          {fiscalMonths(fy).map((m) => (
            <option key={m} value={m}>
              {thaiMonthLabel(m)}
            </option>
          ))}
        </select>
        <a href={`/finance/ledger/register/pdf?fy=${fy}&month=${month}${typeId ? `&type=${typeId}` : ""}`} target="_blank" rel="noreferrer" className="btn-secondary mt-3 inline-flex items-center gap-2">
          <PrinterIcon className="h-4 w-4" />
          พิมพ์ PDF
        </a>
      </div>
      <div className="card">
        <div className="card-title">ทะเบียนคุมใบสำคัญคู่จ่าย</div>
        <p className="mb-3 text-sm text-slate-500">รายการจ่ายที่มีเลขที่ บค. / บจ. ของปีงบประมาณ {fy} เรียงตามวันที่</p>
        <a href={`/finance/ledger/vouchers/pdf?fy=${fy}`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-2">
          <PrinterIcon className="h-4 w-4" />
          พิมพ์ PDF
        </a>
      </div>
    </div>
  );
}
