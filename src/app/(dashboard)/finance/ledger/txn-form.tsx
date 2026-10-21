"use client";

// ฟอร์มบันทึกรายการรับ-จ่าย (แทนการพิมพ์แถวในชีต DATA) — เลขที่ บค/บจ เสนอเลขถัดไปของปีงบให้ แก้ได้

import { useRef, useState } from "react";
import { confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";
import { Modal, type ModalHandle } from "@/components/modal";
import { ThaiDatePicker } from "@/components/thai-date-picker";
import { CopyIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { DOC_KINDS, docLabel, effect, type DocFormats, fiscalYearOf, SOURCE_LABEL, type Balance, type SourceKind, KIND_LABEL, POCKET_LABEL, POCKETS, type DocKind, type FinTxn, type MoneyType, type Pocket, type TxnKind } from "@/lib/finance-ledger";
import { saveTxn, suggestDocSeq } from "./actions";

/** budget/approved (ถ้ามี) ใช้แสดงงบคงเหลือ = งบ − อนุมัติแล้ว ใต้ช่องโครงการ/กิจกรรม */
type BudgetInfo = { budget?: number; approved?: number };
export type ProjectOption = { id: string; name: string; activities: ({ id: string; name: string } & BudgetInfo)[] } & BudgetInfo;

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function BudgetLine({ info }: { info: BudgetInfo | undefined }) {
  if (!info || info.budget === undefined) return null;
  const left = info.budget - (info.approved ?? 0);
  return (
    <p className={`mt-1 text-xs ${left < 0 ? "text-red-600" : "text-slate-500"}`}>
      งบ {baht(info.budget)} · อนุมัติแล้ว {baht(info.approved ?? 0)} · <b>คงเหลือ {baht(left)}</b> บาท
    </p>
  );
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** balances = ยอดคงเหลือล่าสุดของปีงบแยกประเภทเงิน — ใช้เตือนเมื่อจ่าย/โอนออกเกินยอดคงเหลือ */
export type TxnSuggest = { payees: string[]; descriptions: string[]; balances: Map<string, Balance>; fmt?: DocFormats };

/** txn = แก้ไขรายการเดิม · copyFrom = รายการใหม่ที่คัดลอกค่าจากรายการเดิม (วันที่ = วันนี้, เลขที่ บค/บจ = เลขถัดไป)
 *  source = บันทึกจากงานต้นทาง (ระยะที่ 2) — copyFrom เป็นค่าที่เติมจากงานนั้น (รวมวันที่) และผูก source_kind/source_id ไว้ */
export function TxnForm({
  txn,
  copyFrom,
  source,
  types,
  projects,
  suggest,
  onSaved,
}: {
  txn?: FinTxn;
  copyFrom?: Partial<FinTxn>;
  /** minDate = วันที่งานต้นทางเสร็จสิ้น — วันที่จ่ายจริงต้องไม่ก่อนวันนี้ */
  source?: { kind: SourceKind; id: string; ref: string; minDate: string };
  types: MoneyType[];
  projects: ProjectOption[];
  suggest: TxnSuggest;
  onSaved: () => void;
}) {
  const ref = useRef<ModalHandle>(null);
  const tpl = txn ?? copyFrom;
  // บันทึกจากงานต้นทาง: ไม่ดึงวันที่ของงานนั้นมา (เป็นวันที่จัดซื้อ/จัดจ้าง ไม่ใช่วันจ่ายจริง) — เสนอวันนี้ถ้าไม่ก่อนวันที่งานเสร็จ
  const [date, setDate] = useState<string | null>(txn?.txn_date ?? (source ? (todayLocal() >= source.minDate ? todayLocal() : null) : todayLocal()));
  const [kind, setKind] = useState<TxnKind>(tpl?.kind ?? "pay");
  const [docKind, setDocKind] = useState<DocKind | "">(tpl?.doc_kind ?? (tpl ? "" : "บจ"));
  const [docSeq, setDocSeq] = useState<string>(txn?.doc_seq ? String(txn.doc_seq) : "");
  const [projectId, setProjectId] = useState(tpl?.project_id ?? "");
  const [activityId, setActivityId] = useState(tpl?.activity_id ?? "");
  const [typeId, setTypeId] = useState(tpl?.money_type_id ?? "");
  const [fromPocket, setFromPocket] = useState<Pocket>(tpl?.from_pocket ?? "bank");
  const [toPocket, setToPocket] = useState<Pocket>(tpl?.to_pocket ?? (tpl?.kind === "transfer" ? "cash" : "bank"));
  // "บันทึกและเพิ่มต่อ" — remount ฟอร์มให้ช่องรายการ/จำนวนเงิน/ผู้รับว่าง แต่คงวันที่ ประเภท ประเภทเงิน ช่อง โครงการ ไว้
  const [formKey, setFormKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const activeTypes = types.filter((t) => t.is_active || t.id === tpl?.money_type_id);
  const project = projects.find((p) => p.id === projectId);
  const activities = project?.activities ?? [];
  const activity = activities.find((a) => a.id === activityId);
  const seqKind = docKind === "บค" || docKind === "บจ";

  async function refreshSeq(d: string | null, k: DocKind | "") {
    // แก้ไขรายการเดิมที่ยังอยู่ปีงบ/ชนิดเอกสารเดิม — คงเลขเดิม
    if (txn && txn.doc_kind === k && d && fiscalYearOf(d) === txn.fiscal_year) return setDocSeq(txn.doc_seq ? String(txn.doc_seq) : "");
    if (!d || (k !== "บค" && k !== "บจ")) return setDocSeq("");
    const r = await suggestDocSeq(d, k);
    setDocSeq(r.seq ? String(r.seq) : "");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const addNext = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "next";
    const fd = new FormData(e.currentTarget);
    // เตือน (ไม่บังคับ) เมื่อจ่าย/โอนออกเกินยอดคงเหลือของประเภทเงินนั้น — ไม่นับผลของรายการเดิมที่กำลังแก้
    const from = String(fd.get("from_pocket") ?? "") as Pocket;
    const typeId = String(fd.get("money_type_id") ?? "");
    const amount = Number(fd.get("amount")) || 0;
    if (kind !== "receive" && typeId && from) {
      const bal = { ...(suggest.balances.get(typeId) ?? { cash: 0, bank: 0, gov: 0 }) };
      if (txn && txn.money_type_id === typeId) {
        const old = effect(txn);
        bal.cash -= old.cash;
        bal.bank -= old.bank;
        bal.gov -= old.gov;
      }
      if (amount > bal[from] + 0.001) {
        const typeName = types.find((t) => t.id === typeId)?.name ?? "";
        const ok = await confirmWarning({
          title: "ยอดเงินไม่พอ",
          text: `${typeName} — ${POCKET_LABEL[from]} คงเหลือ ${bal[from].toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท แต่จะ${kind === "pay" ? "จ่าย" : "โอนออก"} ${amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท ยอดจะติดลบ — ตรวจสอบยอดยกมา/ประเภทเงิน/ช่องที่จ่าย ก่อนบันทึก`,
          confirmButtonText: "บันทึกต่อ",
        });
        if (!ok) return;
      }
    }
    setSaving(true);
    try {
      const res = await saveTxn(txn?.id ?? null, fd);
      if (res.error) return void (await toastError(res.error));
      await toastSuccess(`บันทึกแล้ว${res.docSeq && date ? ` — เลขที่ ${docLabel({ doc_kind: docKind as DocKind, doc_seq: res.docSeq, doc_no: null, fiscal_year: fiscalYearOf(date) }, suggest?.fmt)}` : ""}`);
      onSaved();
      if (addNext) {
        setFormKey((k) => k + 1);
        await refreshSeq(date, docKind);
      } else ref.current?.close();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pocketSelect = (name: "from_pocket" | "to_pocket", label: string) => (
    <div>
      <label className="label">
        {label} <span className="text-red-600">*</span>
      </label>
      <select
        name={name}
        value={name === "from_pocket" ? fromPocket : toPocket}
        onChange={(e) => (name === "from_pocket" ? setFromPocket : setToPocket)(e.target.value as Pocket)}
        className="input w-full"
      >
        {POCKETS.map((p) => (
          <option key={p} value={p}>
            {POCKET_LABEL[p]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Modal
      ref={ref}
      title={txn ? "แก้ไขรายการรับ-จ่าย" : source ? `บันทึกจาก${SOURCE_LABEL[source.kind]}` : copyFrom ? "บันทึกรายการรับ-จ่าย (คัดลอกจากรายการเดิม)" : "บันทึกรายการรับ-จ่าย"}
      wide
      lazy
      onOpenChange={(open) => {
        if (open && !txn && seqKind) refreshSeq(date, docKind);
      }}
      trigger={
        txn ? (
          <span title="แก้ไข" className="btn-secondary btn-sm">
            <PencilIcon className="h-3.5 w-3.5" />
          </span>
        ) : source ? (
          <span title={`บันทึกในบัญชีรับ-จ่าย — ${source.ref}`} className="btn-primary btn-sm">
            <PlusIcon className="h-3.5 w-3.5" />
            บันทึก
          </span>
        ) : copyFrom ? (
          <span title="คัดลอกเป็นรายการใหม่" className="btn-secondary btn-sm">
            <CopyIcon className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="btn-primary inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            บันทึกรับ-จ่าย
          </span>
        )
      }
    >
      <form key={formKey} onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {source && (
          <>
            <input type="hidden" name="source_kind" value={source.kind} />
            <input type="hidden" name="source_id" value={source.id} />
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 sm:col-span-2">
              ผูกกับ <b>{source.ref}</b> — ระบบเติมข้อมูลจากงานต้นทางให้แล้ว ตรวจสอบประเภทเงิน ช่องที่จ่าย และวันที่จ่ายจริงก่อนบันทึก
            </p>
          </>
        )}
        <div>
          <label className="label">
            วันที่ <span className="text-red-600">*</span>
          </label>
          <ThaiDatePicker
            name="txn_date"
            minDate={source?.minDate || undefined}
            maxDate={source ? todayLocal() : undefined}
            value={date}
            onChange={(d) => {
              setDate(d);
              refreshSeq(d, docKind);
            }}
            required
          />
          {date && <p className="mt-1 text-xs text-slate-500">ปีงบประมาณ {fiscalYearOf(date)}</p>}
          {source && (
            <p className={`mt-1 text-xs ${source.minDate > todayLocal() ? "text-red-600" : "text-slate-500"}`}>
              {source.minDate > todayLocal()
                ? `งานต้นทางยังไม่เสร็จ (ขั้นตอนล่าสุดลงวันที่ ${source.minDate.split("-").reverse().map((v, i) => (i === 2 ? String(Number(v) + 543) : v)).join("/")}) — บันทึกได้ตั้งแต่วันนั้น`
                : `วันที่จ่าย/รับจริง — ต้องไม่ก่อนวันที่งานต้นทางเสร็จสิ้น (${source.minDate.split("-").reverse().map((v, i) => (i === 2 ? String(Number(v) + 543) : v)).join("/")}) และไม่เกินวันนี้`}
            </p>
          )}
        </div>
        <div>
          <label className="label">
            ประเภทรายการ <span className="text-red-600">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(["receive", "pay", "transfer"] as TxnKind[]).map((k) => (
              <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${kind === k ? "border-navy-800 bg-navy-800/[0.06] font-semibold text-navy-900" : "border-slate-200"}`}>
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    if (k === "transfer" && fromPocket === toPocket) setToPocket(fromPocket === "bank" ? "cash" : "bank");
                    const nextDoc: DocKind | "" = k === "receive" ? "บร" : k === "pay" ? "บจ" : "";
                    if (!txn) {
                      setDocKind(nextDoc);
                      refreshSeq(date, nextDoc);
                    }
                  }}
                />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
          {kind === "transfer" && <p className="mt-1 text-xs text-slate-500">เช่น ถอนเงินฝากธนาคารมาเป็นเงินสด หรือนำเงินสดฝากธนาคาร — ไม่นับเป็นรับ/จ่ายในทะเบียนคุม</p>}
        </div>

        {kind !== "receive" && pocketSelect("from_pocket", kind === "transfer" ? "โอนออกจาก" : "จ่ายจาก")}
        {kind !== "pay" && pocketSelect("to_pocket", kind === "transfer" ? "โอนเข้า" : "รับเข้า")}

        <div>
          <label className="label">
            ประเภทเงิน <span className="text-red-600">*</span>
          </label>
          <select name="money_type_id" value={typeId} onChange={(e) => setTypeId(e.target.value)} required className="input w-full">
            <option value="">— เลือกประเภทเงิน —</option>
            {activeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">
            จำนวนเงิน (บาท) <span className="text-red-600">*</span>
          </label>
          <input name="amount" type="number" min="0.01" step="0.01" defaultValue={tpl?.amount ?? ""} required className="input w-full text-right" />
        </div>

        <div>
          <label className="label">เอกสาร</label>
          <select
            name="doc_kind"
            value={docKind}
            onChange={(e) => {
              const k = e.target.value as DocKind | "";
              setDocKind(k);
              refreshSeq(date, k);
            }}
            className="input w-full"
          >
            <option value="">— ไม่มี/อื่นๆ —</option>
            {DOC_KINDS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {docKind && <p className="mt-1 text-xs text-slate-500">{DOC_KINDS.find((d) => d.value === docKind)?.hint}</p>}
        </div>
        <div>
          <label className="label">เลขที่</label>
          {seqKind ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-slate-600">{docKind}</span>
              <input name="doc_seq" type="number" min="1" step="1" value={docSeq} onChange={(e) => setDocSeq(e.target.value)} className="input w-full text-right" />
              <span className="shrink-0 text-sm text-slate-600">/{date ? fiscalYearOf(date) : "...."}</span>
            </div>
          ) : (
            <input name="doc_no" defaultValue={(txn ?? (source ? copyFrom : undefined))?.doc_no ?? ""} placeholder={docKind === "บร" ? "เช่น 27ก 26785/1 (เล่มที่/เลขที่)" : "เลขที่เอกสาร (ถ้ามี)"} className="input w-full" />
          )}
          {seqKind && (
            <p className="mt-1 text-xs text-slate-500">
              ระบบเสนอเลขถัดไปของปีงบให้ แก้ได้ (ห้ามซ้ำ)
              {Number(docSeq) > 0 && date ? ` — แสดงเป็น "${docLabel({ doc_kind: docKind as DocKind, doc_seq: Number(docSeq), doc_no: null, fiscal_year: fiscalYearOf(date) }, suggest.fmt)}"` : ""}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="label">
            รายการ <span className="text-red-600">*</span>
          </label>
          <input name="description" list={`fin-desc-${txn?.id ?? "new"}`} defaultValue={tpl?.description ?? ""} required placeholder="เช่น จ่ายเงินค่าวัตถุดิบประกอบอาหารกลางวัน 5 วัน" className="input w-full" />
          <datalist id={`fin-desc-${txn?.id ?? "new"}`}>
            {suggest.descriptions.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div className="sm:col-span-2">
          <label className="label">{kind === "receive" ? "รับจาก" : "จ่ายให้"}</label>
          <input
            name="payee"
            list={`fin-payee-${txn?.id ?? "new"}`}
            defaultValue={tpl?.payee ?? ""}
            placeholder={kind === "receive" ? "เช่น สพฐ., ผู้บริจาค" : "พิมพ์เพื่อค้นหาร้านค้า/ผู้ขาย/ครู หรือกรอกชื่อเอง"}
            className="input w-full"
          />
          <datalist id={`fin-payee-${txn?.id ?? "new"}`}>
            {suggest.payees.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">ช่วยกรอกจากเมนูร้านค้า/ผู้ขาย รายชื่อครู และชื่อที่เคยบันทึก — ไม่มีในรายการพิมพ์เองได้</p>
        </div>

        <div>
          <label className="label">โครงการ</label>
          <select
            name="project_id"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setActivityId("");
            }}
            className="input w-full"
          >
            <option value="">— ไม่ระบุ —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <BudgetLine info={project} />
        </div>
        <div>
          <label className="label">กิจกรรม</label>
          <select name="activity_id" value={activityId} onChange={(e) => setActivityId(e.target.value)} disabled={!projectId} className="input w-full">
            <option value="">— ไม่ระบุ —</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <BudgetLine info={activity} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">หมายเหตุ</label>
          <input name="note" defaultValue={tpl?.note ?? ""} className="input w-full" />
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
            ยกเลิก
          </button>
          {!txn && !source && (
            <button type="submit" value="next" disabled={saving} className="btn-secondary" title="บันทึกแล้วเปิดฟอร์มว่างต่อ — คงวันที่ ประเภทเงิน ช่อง และโครงการไว้">
              บันทึกและเพิ่มต่อ
            </button>
          )}
          <button type="submit" value="close" disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
